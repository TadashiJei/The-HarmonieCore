# HarmonieCore Payment Service

A comprehensive payment processing microservice for the HarmonieCore platform, supporting cryptocurrency payments, tipping, and fiat payments via Xendit and Stripe.

## 🚀 Features

### 💳 **Payment Processing**
- **Cryptocurrency Payments**: Ethereum (ETH, USDC, USDT) and Solana (SOL, USDC, USDT)
- **Fiat Payments**: USD, IDR, PHP, VND, THB, MYR, SGD via Xendit
- **Stripe Integration**: Credit/debit card processing
- **Real-time Payment Tracking**: WebSocket support for live updates

### 💰 **Tipping System**
- **Artist Tipping**: Direct tipping to artists with custom messages
- **Multi-currency Support**: Crypto and fiat tipping options
- **Tipping Analytics**: Track tips, top tippers, and trends
- **Instant Notifications**: Real-time updates via WebSocket

### 🏦 **Payout System**
- **Artist Payouts**: Automated payouts to artists
- **Multiple Methods**: Xendit bank transfers, crypto payouts
- **Payout Thresholds**: Configurable minimum payout amounts
- **Payout Scheduling**: Automated daily/weekly/monthly payouts

### 🔒 **Security & Compliance**
- **Rate Limiting**: API abuse protection
- **Webhook Security**: Signature verification for all webhooks
- **Transaction Validation**: Input validation and sanitization
- **Audit Logging**: Comprehensive transaction logging

## 📋 API Reference

### **Tipping Endpoints**

#### Create Tipping Request
```http
POST /api/tips
Content-Type: application/json

{
  "artistId": "artist_123",
  "fanId": "fan_456",
  "amount": 10.50,
  "currency": "USD",
  "message": "Amazing performance!",
  "network": "xendit"
}
```

#### Get Tipping Analytics
```http
GET /api/analytics/tips/:artistId?period=30d
```

### **Payment Endpoints**

#### Process Crypto Payment
```http
POST /api/payments
Content-Type: application/json

{
  "amount": 0.1,
  "currency": "ETH",
  "recipientAddress": "0x123...",
  "senderAddress": "0x456...",
  "network": "ethereum",
  "metadata": {
    "type": "tip",
    "artistId": "artist_123"
  }
}
```

#### Create Xendit Invoice
```http
POST /api/invoices
Content-Type: application/json

{
  "amount": 100000,
  "currency": "IDR",
  "description": "Tip for artist performance",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+6281234567890"
  },
  "metadata": {
    "artistId": "artist_123",
    "type": "tip"
  }
}
```

### **Payout Endpoints**

#### Process Artist Payout
```http
POST /api/payouts
Content-Type: application/json

{
  "artistId": "artist_123",
  "amount": 500000,
  "currency": "IDR",
  "payoutMethod": "xendit",
  "destination": {
    "accountNumber": "1234567890",
    "bankCode": "BCA",
    "accountHolderName": "Artist Name"
  }
}
```

### **Utility Endpoints**

#### Get Payment Status
```http
GET /api/payments/:paymentId
```

#### Get Balance
```http
GET /api/balance/:currency
```

#### Estimate Fees
```http
POST /api/fees/estimate
Content-Type: application/json

{
  "amount": 10,
  "currency": "ETH",
  "network": "ethereum"
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Payment Service                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Xendit API    │  │   Crypto APIs   │              │
│  │   (Fiat)        │  │   (ETH/SOL)     │              │
│  └─────────────────┘  └─────────────────┘              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Payment       │  │   Tipping       │              │
│  │   Service       │  │   Service       │              │
│  └─────────────────┘  └─────────────────┘              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Payout        │  │   Analytics     │              │
│  │   Service       │  │   Service       │              │
│  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3006` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/harmoniecore_payments` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `XENDIT_SECRET_KEY` | Xendit API secret key | Required |
| `ETHEREUM_RPC_URL` | Ethereum RPC endpoint | Required |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Required |
| `JWT_SECRET` | JWT secret for authentication | Required |

### Supported Networks & Currencies

#### **Cryptocurrency**
- **Ethereum**: ETH, USDC, USDT
- **Solana**: SOL, USDC, USDT
- **Polygon**: MATIC, USDC, USDT

#### **Fiat via Xendit**
- **Indonesia**: IDR
- **Philippines**: PHP
- **Vietnam**: VND
- **Thailand**: THB
- **Malaysia**: MYR
- **Singapore**: SGD
- **United States**: USD

## 🔄 Webhooks

### **Xendit Webhooks**

#### Invoice Paid
```json
{
  "event": "invoice.paid",
  "data": {
    "id": "invoice_id",
    "externalID": "harmonie_123",
    "status": "PAID",
    "amount": 100000,
    "currency": "IDR"
  }
}
```

#### Payout Completed
```json
{
  "event": "payout.paid",
  "data": {
    "id": "payout_id",
    "externalID": "payout_artist_123",
    "status": "COMPLETED"
  }
}
```

### **Crypto Webhooks**
- **Transaction Confirmation**: Real-time blockchain confirmations
- **Payment Status**: Track payment completion
- **Error Handling**: Failed transaction notifications

## 📊 Analytics

### **Tipping Analytics**
- **Total Tips**: Total amount tipped to artists
- **Top Tippers**: Most generous fans
- **Daily Trends**: Tip patterns over time
- **Currency Breakdown**: Tips by currency/network
- **Geographic Distribution**: Tips by location

### **Payment Metrics**
- **Transaction Volume**: Total processed amount
- **Success Rate**: Payment completion rate
- **Average Transaction**: Average payment size
- **Network Fees**: Gas/transaction fees by network

## 🚀 Quick Start

### **1. Installation**
```bash
cd backend/payment-service
npm install
```

### **2. Configuration**
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

### **3. Start Service**
```bash
npm run dev    # Development mode
npm start      # Production mode
npm test       # Run tests
```

### **4. Test Integration**
```bash
# Test Xendit connection
curl http://localhost:3006/health

# Create test invoice
curl -X POST http://localhost:3006/api/invoices \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "currency": "IDR", "description": "Test tip"}'
```

## 🔧 Development

### **Testing**
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

### **Docker**
```bash
docker build -t harmoniecore-payment-service .
docker run -p 3006:3006 --env-file .env harmoniecore-payment-service
```

### **Docker Compose**
```bash
docker-compose up -d
```

## 📱 Mobile Integration

### **React Native Example**
```javascript
import { PaymentService } from '@harmoniecore/payment-client';

const payment = new PaymentService({
  baseURL: 'https://payments.harmoniecore.com',
  apiKey: 'your-api-key'
});

// Create tip
const tip = await payment.createTip({
  artistId: 'artist_123',
  amount: 50000,
  currency: 'IDR',
  message: 'Great performance!'
});

// Process payment
const result = await payment.processPayment({
  invoiceUrl: tip.invoice.invoiceURL,
  method: 'xendit'
});
```

## 🔍 Monitoring

### **Health Checks**
- **Database Connection**: MongoDB and Redis
- **API Status**: Xendit, Ethereum, Solana
- **Service Health**: Payment processing pipeline

### **Alerts**
- **Failed Payments**: Real-time notifications
- **Payout Issues**: Artist payout failures
- **Service Downtime**: Health check failures

## 🛡️ Security

### **Authentication**
- **JWT Tokens**: Secure API access
- **API Keys**: Service-to-service authentication
- **Webhook Signatures**: Verify webhook authenticity

### **Rate Limiting**
- **Request Limits**: 100 requests per 15 minutes
- **IP-based**: Per-IP rate limiting
- **Endpoint-specific**: Different limits per endpoint

## 📞 Support

For issues and questions:
- **Documentation**: Check this README
- **API Reference**: Visit `/api/docs` (when implemented)
- **Discord**: Join our community server
- **Issues**: Create GitHub issues

## 🔄 Integration

### **Frontend Integration**
- **React Native**: Full SDK available
- **Web**: REST API endpoints
- **WebSocket**: Real-time updates

### **Other Services**
- **Analytics**: Payment event tracking
- **Notification**: Payment confirmations
- **CDN**: Receipt generation and storage
