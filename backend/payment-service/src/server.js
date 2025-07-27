/**
 * Payment Service REST API Server
 * Handles tipping, payments, and transaction processing endpoints
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { Server } = require('socket.io');
const http = require('http');
const PaymentService = require('./services/paymentService');
const logger = require('./utils/logger');

class PaymentServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    });
    
    this.paymentService = new PaymentService();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.'
      }
    });
    this.app.use('/api/', limiter);

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            redis: await this.checkRedis(),
            mongodb: await this.checkMongoDB(),
            xendit: await this.checkXendit()
          }
        };
        res.json(health);
      } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
      }
    });

    // Create tipping request
    this.app.post('/api/tips', async (req, res) => {
      try {
        const { artistId, fanId, amount, currency, message, network } = req.body;
        
        if (!artistId || !fanId || !amount || !currency) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const tippingRequest = await this.paymentService.createTippingRequest({
          artistId,
          fanId,
          amount,
          currency,
          message,
          network
        });

        // Emit real-time update
        this.io.to(`artist:${artistId}`).emit('newTip', tippingRequest);

        res.json({
          success: true,
          data: tippingRequest,
          message: 'Tipping request created successfully'
        });
      } catch (error) {
        logger.error('Error creating tipping request:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Process payment
    this.app.post('/api/payments', async (req, res) => {
      try {
        const { amount, currency, recipientAddress, senderAddress, network, metadata } = req.body;
        
        const payment = await this.paymentService.processCryptoPayment({
          amount,
          currency,
          recipientAddress,
          senderAddress,
          network,
          metadata
        });

        res.json({
          success: true,
          data: payment,
          message: 'Payment processed successfully'
        });
      } catch (error) {
        logger.error('Error processing payment:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Create Xendit invoice
    this.app.post('/api/invoices', async (req, res) => {
      try {
        const { amount, currency, description, customer, metadata } = req.body;
        
        const invoice = await this.paymentService.createInvoice({
          amount,
          currency,
          description,
          customer,
          metadata
        });

        res.json({
          success: true,
          data: invoice,
          message: 'Invoice created successfully'
        });
      } catch (error) {
        logger.error('Error creating invoice:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get payment status
    this.app.get('/api/payments/:paymentId', async (req, res) => {
      try {
        const { paymentId } = req.params;
        const status = await this.paymentService.getPaymentStatus(paymentId);
        
        if (!status) {
          return res.status(404).json({ error: 'Payment not found' });
        }

        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        logger.error('Error getting payment status:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Process artist payout
    this.app.post('/api/payouts', async (req, res) => {
      try {
        const { artistId, amount, currency, payoutMethod, destination } = req.body;
        
        const payout = await this.paymentService.processArtistPayout({
          artistId,
          amount,
          currency,
          payoutMethod,
          destination
        });

        res.json({
          success: true,
          data: payout,
          message: 'Payout initiated successfully'
        });
      } catch (error) {
        logger.error('Error processing payout:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get balance
    this.app.get('/api/balance/:currency', async (req, res) => {
      try {
        const { currency } = req.params;
        const balance = await this.paymentService.getBalance(currency.toUpperCase());
        
        res.json({
          success: true,
          data: { currency: currency.toUpperCase(), balance }
        });
      } catch (error) {
        logger.error('Error getting balance:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Estimate fees
    this.app.post('/api/fees/estimate', async (req, res) => {
      try {
        const { amount, currency, network } = req.body;
        const fees = await this.paymentService.estimateFees({ amount, currency, network });
        
        res.json({
          success: true,
          data: { estimatedFee: fees }
        });
      } catch (error) {
        logger.error('Error estimating fees:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Webhook endpoint for Xendit
    this.app.post('/api/webhooks/xendit', express.raw({ type: 'application/json' }), (req, res) => {
      try {
        // Verify Xendit webhook signature
        const signature = req.headers['x-callback-token'];
        if (signature !== process.env.XENDIT_WEBHOOK_TOKEN) {
          return res.status(401).json({ error: 'Invalid signature' });
        }

        const webhookData = JSON.parse(req.body);
        this.handleXenditWebhook(webhookData);
        
        res.json({ success: true });
      } catch (error) {
        logger.error('Error processing Xendit webhook:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get tipping analytics
    this.app.get('/api/analytics/tips/:artistId', async (req, res) => {
      try {
        const { artistId } = req.params;
        const { period = '30d' } = req.query;
        
        const analytics = await this.getTippingAnalytics(artistId, period);
        
        res.json({
          success: true,
          data: analytics
        });
      } catch (error) {
        logger.error('Error getting tipping analytics:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('Client connected to payment service:', socket.id);

      socket.on('join_artist_room', (artistId) => {
        socket.join(`artist:${artistId}`);
        logger.info(`Client ${socket.id} joined artist room: ${artistId}`);
      });

      socket.on('subscribe_payment', (paymentId) => {
        socket.join(`payment:${paymentId}`);
        logger.info(`Client ${socket.id} subscribed to payment: ${paymentId}`);
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected from payment service:', socket.id);
      });
    });
  }

  async checkRedis() {
    try {
      await this.paymentService.redis.ping();
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  async checkMongoDB() {
    try {
      await mongoose.connection.db.admin().ping();
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  async checkXendit() {
    try {
      await this.paymentService.balance.getBalance({
        accountID: process.env.XENDIT_ACCOUNT_ID
      });
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  async handleXenditWebhook(webhookData) {
    try {
      const { event, data } = webhookData;
      
      switch (event) {
        case 'invoice.paid':
          await this.handleInvoicePaid(data);
          break;
        case 'payout.paid':
          await this.handlePayoutPaid(data);
          break;
        case 'invoice.expired':
          await this.handleInvoiceExpired(data);
          break;
        default:
          logger.info('Unhandled Xendit webhook event:', event);
      }
    } catch (error) {
      logger.error('Error handling Xendit webhook:', error);
    }
  }

  async handleInvoicePaid(invoiceData) {
    const { externalID, status, metadata } = invoiceData;
    
    if (metadata?.type === 'tip') {
      this.io.to(`artist:${metadata.artistId}`).emit('tip_paid', {
        artistId: metadata.artistId,
        amount: invoiceData.amount,
        currency: invoiceData.currency,
        message: metadata.message || 'Thank you for your support!'
      });
    }

    logger.info('Invoice paid:', { externalID, status });
  }

  async handlePayoutPaid(payoutData) {
    const { externalID, status } = payoutData;
    logger.info('Payout completed:', { externalID, status });
  }

  async handleInvoiceExpired(invoiceData) {
    const { externalID } = invoiceData;
    logger.info('Invoice expired:', { externalID });
  }

  async getTippingAnalytics(artistId, period) {
    // Implementation for tipping analytics
    return {
      totalTips: 0,
      totalAmount: 0,
      averageTip: 0,
      topTippers: [],
      dailyStats: [],
      currencyBreakdown: {}
    };
  }

  start(port = process.env.PORT || 3006) {
    this.server.listen(port, () => {
      logger.info(`Payment service listening on port ${port}`);
    });
  }
}

module.exports = PaymentServer;
