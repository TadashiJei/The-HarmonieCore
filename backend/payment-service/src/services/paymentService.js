/**
 * Tipping & Payment Processing Service
 * Handles cryptocurrency payments, tipping, fiat payments via Xendit, and transaction processing for HarmonieCore
 */

const Web3 = require('web3');
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { ethers } = require('ethers');
const Xendit = require('xendit-node');
const BigNumber = require('bignumber.js');
const crypto = require('crypto');
const redis = require('redis');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    this.web3 = new Web3(process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/your-infura-key');
    this.solanaConnection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.xendit = new Xendit({
      secretKey: process.env.XENDIT_SECRET_KEY,
      xenditURL: process.env.XENDIT_URL || 'https://api.xendit.co'
    });
    
    this.redis = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || ''
    });

    this.setupXenditServices();
    this.setupBlockchainConnections();
  }

  setupXenditServices() {
    const { Invoice, Payout, Balance, PaymentRequest } = this.xendit;
    
    this.invoice = new Invoice({});
    this.payout = new Payout({});
    this.balance = new Balance({});
    this.paymentRequest = new PaymentRequest({});
  }

  setupBlockchainConnections() {
    this.ethereumProvider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    this.solanaConnection = new Connection(process.env.SOLANA_RPC_URL);
  }

  /**
   * Create payment invoice via Xendit
   */
  async createInvoice({ amount, currency, description, customer, metadata = {} }) {
    try {
      const invoice = await this.invoice.createInvoice({
        externalID: `harmonie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        currency,
        description,
        customer: {
          given_names: customer.name,
          email: customer.email,
          mobile_number: customer.phone
        },
        invoiceDuration: 86400, // 24 hours
        shouldSendEmail: true,
        metadata: {
          ...metadata,
          platform: 'harmoniecore',
          type: 'tipping'
        }
      });

      logger.info('Xendit invoice created:', { invoiceID: invoice.id, amount, currency });
      
      return {
        id: invoice.id,
        externalID: invoice.externalID,
        amount: invoice.amount,
        currency: invoice.currency,
        invoiceURL: invoice.invoiceURL,
        status: invoice.status,
        expiryDate: invoice.expiryDate,
        created: invoice.created
      };
    } catch (error) {
      logger.error('Error creating Xendit invoice:', error);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  /**
   * Process cryptocurrency payment/tip
   */
  async processCryptoPayment({ amount, currency, recipientAddress, senderAddress, network, metadata = {} }) {
    try {
      const paymentId = crypto.randomUUID();
      const paymentData = {
        id: paymentId,
        amount,
        currency,
        recipientAddress,
        senderAddress,
        network,
        status: 'pending',
        metadata,
        createdAt: new Date()
      };

      // Store payment in Redis for tracking
      await this.redis.setEx(`payment:${paymentId}`, 3600, JSON.stringify(paymentData));

      if (network === 'ethereum') {
        return await this.processEthereumPayment(paymentData);
      } else if (network === 'solana') {
        return await this.processSolanaPayment(paymentData);
      } else {
        throw new Error('Unsupported network');
      }
    } catch (error) {
      logger.error('Error processing crypto payment:', error);
      throw error;
    }
  }

  /**
   * Process Ethereum payment
   */
  async processEthereumPayment(paymentData) {
    try {
      const { amount, recipientAddress, currency } = paymentData;
      
      if (currency === 'ETH') {
        // ETH transfer
        const tx = {
          to: recipientAddress,
          value: ethers.parseEther(amount.toString())
        };
        
        return {
          ...paymentData,
          transaction: tx,
          estimatedGas: await this.estimateEthereumGas(tx)
        };
      } else if (currency === 'USDC' || currency === 'USDT') {
        // ERC20 token transfer
        const tokenAddress = this.getTokenAddress(currency, 'ethereum');
        const contract = new ethers.Contract(tokenAddress, this.getERC20ABI(), this.ethereumProvider);
        
        const decimals = await contract.decimals();
        const amountInWei = ethers.parseUnits(amount.toString(), decimals);
        
        return {
          ...paymentData,
          tokenAddress,
          amountInWei,
          contract
        };
      }
    } catch (error) {
      logger.error('Error processing Ethereum payment:', error);
      throw error;
    }
  }

  /**
   * Process Solana payment
   */
  async processSolanaPayment(paymentData) {
    try {
      const { amount, recipientAddress, currency } = paymentData;
      
      if (currency === 'SOL') {
        // SOL transfer
        const recipientPubkey = new PublicKey(recipientAddress);
        const lamports = amount * LAMPORTS_PER_SOL;
        
        return {
          ...paymentData,
          recipientPubkey,
          lamports,
          instruction: SystemProgram.transfer({
            fromPubkey: new PublicKey(paymentData.senderAddress),
            toPubkey: recipientPubkey,
            lamports
          })
        };
      } else {
        // SPL token transfer
        const mintAddress = new PublicKey(this.getTokenAddress(currency, 'solana'));
        const recipientTokenAccount = await this.getOrCreateAssociatedTokenAccount(mintAddress, new PublicKey(recipientAddress));
        
        return {
          ...paymentData,
          mintAddress,
          recipientTokenAccount,
          amount: amount * Math.pow(10, 6) // Assuming 6 decimals
        };
      }
    } catch (error) {
      logger.error('Error processing Solana payment:', error);
      throw error;
    }
  }

  /**
   * Create payment request for tipping
   */
  async createTippingRequest({ artistId, fanId, amount, currency, message, network }) {
    try {
      const tippingId = crypto.randomUUID();
      
      const tippingData = {
        id: tippingId,
        artistId,
        fanId,
        amount,
        currency,
        message,
        network,
        status: 'pending',
        type: 'tip',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in Redis for immediate processing
      await this.redis.setEx(`tip:${tippingId}`, 7200, JSON.stringify(tippingData));

      // Create invoice if fiat currency
      if (['USD', 'IDR', 'PHP', 'VND', 'THB', 'MYR', 'SGD'].includes(currency)) {
        const invoice = await this.createInvoice({
          amount,
          currency,
          description: `Tip for artist ${artistId}`,
          customer: { name: `Fan ${fanId}`, email: 'fan@example.com' },
          metadata: { tippingId, artistId, fanId, type: 'tip' }
        });

        return {
          ...tippingData,
          invoice
        };
      }

      return tippingData;
    } catch (error) {
      logger.error('Error creating tipping request:', error);
      throw error;
    }
  }

  /**
   * Process payout to artist
   */
  async processArtistPayout({ artistId, amount, currency, payoutMethod, destination }) {
    try {
      const payoutId = crypto.randomUUID();
      
      if (payoutMethod === 'xendit') {
        return await this.processXenditPayout({ payoutId, artistId, amount, currency, destination });
      } else if (['ethereum', 'solana'].includes(payoutMethod)) {
        return await this.processCryptoPayout({ payoutId, artistId, amount, currency, destination, network: payoutMethod });
      }
    } catch (error) {
      logger.error('Error processing artist payout:', error);
      throw error;
    }
  }

  /**
   * Process Xendit payout
   */
  async processXenditPayout({ payoutId, artistId, amount, currency, destination }) {
    try {
      const payout = await this.payout.createPayout({
        externalID: `payout_${artistId}_${Date.now()}`,
        amount,
        currency,
        channelCode: 'PH_GCASH', // Example for Philippines GCash
        destination: destination.accountNumber,
        description: `Artist payout for ${artistId}`,
        metadata: {
          artistId,
          payoutId,
          type: 'artist_payout'
        }
      });

      return {
        payoutId,
        xenditPayoutId: payout.id,
        status: payout.status,
        amount,
        currency,
        destination,
        estimatedArrival: payout.estimatedArrival
      };
    } catch (error) {
      logger.error('Error processing Xendit payout:', error);
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      const paymentData = await this.redis.get(`payment:${paymentId}`);
      if (paymentData) {
        return JSON.parse(paymentData);
      }

      // Check Xendit for invoice status
      const invoice = await this.invoice.getInvoice(paymentId);
      if (invoice) {
        return {
          id: invoice.id,
          status: invoice.status,
          amount: invoice.amount,
          currency: invoice.currency,
          externalID: invoice.externalID
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting payment status:', error);
      throw error;
    }
  }

  /**
   * Get balance for different currencies
   */
  async getBalance(currency) {
    try {
      if (['USD', 'IDR', 'PHP', 'VND', 'THB', 'MYR', 'SGD'].includes(currency)) {
        const balance = await this.balance.getBalance({
          accountID: process.env.XENDIT_ACCOUNT_ID
        });
        return balance[currency] || 0;
      }

      // For crypto balances, implement blockchain-specific balance checking
      return 0;
    } catch (error) {
      logger.error('Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees({ amount, currency, network }) {
    try {
      if (network === 'ethereum') {
        const gasPrice = await this.web3.eth.getGasPrice();
        const gasLimit = currency === 'ETH' ? 21000 : 65000;
        const fee = new BigNumber(gasPrice).multipliedBy(gasLimit).dividedBy(1e18);
        return fee.toString();
      } else if (network === 'solana') {
        const fee = 0.000005; // Typical Solana transaction fee
        return fee.toString();
      } else if (['USD', 'IDR', 'PHP', 'VND', 'THB', 'MYR', 'SGD'].includes(currency)) {
        const xenditFee = amount * 0.025; // 2.5% Xendit fee
        return xenditFee.toString();
      }

      return '0';
    } catch (error) {
      logger.error('Error estimating fees:', error);
      return '0';
    }
  }

  /**
   * Helper methods
   */
  getTokenAddress(currency, network) {
    const tokenAddresses = {
      ethereum: {
        USDC: '0xA0b86a33E6441f5b6C7B6eD4c8e4B8B8e8E8B8B8',
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
      },
      solana: {
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
      }
    };

    return tokenAddresses[network]?.[currency];
  }

  getERC20ABI() {
    return [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address account) view returns (uint256)'
    ];
  }

  async getOrCreateAssociatedTokenAccount(mint, owner) {
    // Implementation for creating/getting associated token account
    return new PublicKey(''); // Placeholder
  }

  async estimateEthereumGas(transaction) {
    try {
      return await this.web3.eth.estimateGas(transaction);
    } catch (error) {
      logger.error('Error estimating gas:', error);
      return 21000; // Default gas limit
    }
  }
}

module.exports = PaymentService;
