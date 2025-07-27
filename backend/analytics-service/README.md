# HarmonieCORE Analytics Service

Ultra-optimized analytics system for the HarmonieCore Web3 artist platform. Provides real-time streaming analytics, user behavior tracking, revenue analytics, and performance insights with mobile-first optimization.

## Features

### 📊 **Real-Time Analytics**
- **Live streaming metrics** with sub-second updates
- **User behavior tracking** with session analytics
- **Revenue tracking** with Web3 integration
- **Performance monitoring** for mobile optimization
- **Artist dashboard** with comprehensive insights

### 📱 **Mobile-First Design**
- **Ultra-low data usage** (< 1KB per event)
- **Efficient event sampling** for mobile devices
- **Battery-conscious** tracking strategies
- **Offline capability** with sync support
- **Adaptive sampling** based on network conditions

### 🔧 **Advanced Analytics**
- **Multi-dimensional tracking** (user, content, revenue, performance)
- **Custom report generation** with export capabilities
- **Real-time WebSocket updates**
- **Historical data analysis** with retention policies
- **A/B testing support**
- **Predictive insights**

### ⚡ **Performance Optimizations**
- **Batch processing** for efficient data collection
- **In-memory caching** for real-time queries
- **Data compression** for mobile transmission
- **Sampling strategies** for large datasets
- **Connection pooling** for database efficiency

## Quick Start

### Installation

```bash
cd backend/analytics-service
npm install
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Required Environment Variables

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/harmoniecore_analytics

# Redis (for caching)
REDIS_HOST=localhost
REDIS_PORT=6379

# Analytics Settings
MOBILE_DATA_THRESHOLD=1024
SAMPLING_RATE=0.1
RETENTION_DAYS=90
```

### Running the Service

```bash
# Development
npm run dev

# Production
npm start

# Testing
npm test

# Load test data
npm run seed
```

## API Reference

### Track Event

```http
POST /api/events/track
Content-Type: application/json

{
  "userId": "user123",
  "type": "streaming_start",
  "data": {
    "streamId": "stream456",
    "bitrate": 300,
    "quality": "low",
    "networkType": "cellular"
  }
}
```

### Track Streaming Event

```http
POST /api/events/streaming
Content-Type: application/json

{
  "userId": "user123",
  "streamId": "stream456",
  "eventType": "start",
  "data": {
    "duration": 3600,
    "quality": "auto",
    "bufferEvents": 2,
    "mobileData": true
  }
}
```

### Track Revenue Event

```http
POST /api/events/revenue
Content-Type: application/json

{
  "userId": "user123",
  "eventType": "tip",
  "revenueData": {
    "amount": 5.0,
    "currency": "USD",
    "artistId": "artist789",
    "transactionHash": "0x123...",
    "blockchain": "ethereum"
  }
}
```

### Real-time Dashboard

```http
GET /api/dashboard/realtime
```

### Artist Analytics

```http
GET /api/analytics/artist/:artistId?timeRange=7d
```

### User Behavior Analytics

```http
GET /api/analytics/user/:userId?timeRange=30d
```

## Analytics Categories

### 📈 **Streaming Analytics**
```javascript
{
  type: 'streaming_start',
  data: {
    streamId: 'stream123',
    bitrate: 300,
    quality: 'low',
    duration: 3600,
    bufferEvents: 2,
    droppedFrames: 0,
    networkType: 'cellular',
    mobileData: true,
    batteryLevel: 85
  }
}
```

### 💰 **Revenue Analytics**
```javascript
{
  type: 'revenue_tip',
  data: {
    amount: 5.0,
    currency: 'USD',
    artistId: 'artist123',
    transactionHash: '0x123...',
    blockchain: 'ethereum',
    gasUsed: 21000,
    networkFee: 0.001,
    platformFee: 0.1,
    artistEarnings: 4.9
  }
}
```

### 👥 **User Engagement**
```javascript
{
  type: 'engagement',
  data: {
    action: 'like',
    targetId: 'content123',
    targetType: 'track',
    timeSpent: 180,
    scrollDepth: 75,
    interactions: 5
  }
}
```

### 📱 **Mobile Optimization**
```javascript
{
  type: 'performance',
  data: {
    loadTime: 2.5,
    dataUsage: 512,
    batteryDrain: 5,
    networkEfficiency: 0.85,
    crashCount: 0
  }
}
```

## Mobile Optimization Features

### 📊 **Data Usage Optimization**
- **Event compression** (< 1KB per event)
- **Smart sampling** (5% for mobile, 10% for desktop)
- **Batch processing** (25 events for mobile, 50 for desktop)
- **Selective tracking** based on network type
- **Offline queue** with sync support

### 🔋 **Battery Optimization**
- **Background tracking** with low power mode
- **Adaptive sampling** based on battery level
- **Efficient compression** algorithms
- **Connection pooling** for database efficiency

### 🌐 **Network Optimization**
- **Adaptive timeouts** based on network quality
- **Compression** for large payloads
- **CDN integration** for static assets
- **Connection reuse** for external services

## Real-Time Features

### WebSocket Events

#### Client → Server
```javascript
// Subscribe to dashboard updates
socket.emit('subscribe-dashboard');

// Subscribe to artist analytics
socket.emit('subscribe-artist', 'artist123');

// Track event in real-time
socket.emit('track-event', {
  userId: 'user123',
  type: 'streaming_start',
  data: { streamId: 'stream456' }
});
```

#### Server → Client
```javascript
// Real-time dashboard updates
socket.on('dashboard-update', (data) => {
  console.log('Realtime analytics:', data);
});

// Artist-specific updates
socket.on('artist-analytics', (data) => {
  console.log('Artist analytics:', data);
});
```

## Analytics Dashboards

### 📊 **Artist Dashboard**
- **Overview**: Total views, revenue, listeners, engagement
- **Streaming**: Stream time, peak concurrent, quality metrics
- **Revenue**: Tips, subscriptions, NFT sales, blockchain breakdown
- **Audience**: Demographics, geography, device types
- **Content**: Top tracks, albums, engagement by content

### 👤 **User Dashboard**
- **Profile**: Listening time, favorite artists, genres
- **Engagement**: Interaction rate, sharing, tipping behavior
- **Streaming**: Quality preference, network usage, patterns
- **Revenue**: Total spent, spending patterns, payment methods

### ⚡ **Performance Dashboard**
- **System**: Response time, error rate, throughput
- **Mobile**: Data usage, battery impact, network efficiency
- **Streaming**: Buffer ratio, quality adaptation, stability

## Time Ranges

| Range | Description |
|-------|-------------|
| `1h` | Last hour |
| `24h` | Last 24 hours |
| `7d` | Last 7 days |
| `30d` | Last 30 days |
| `90d` | Last 90 days |

## Batch Processing

### Batch Track Events

```http
POST /api/events/batch
Content-Type: application/json

{
  "events": [
    {
      "userId": "user1",
      "type": "streaming_start",
      "data": { "streamId": "stream1" }
    },
    {
      "userId": "user2", 
      "type": "revenue_tip",
      "data": { "amount": 5.0, "artistId": "artist1" }
    }
  ]
}
```

## Export Data

### Export Analytics

```http
GET /api/export/json?timeRange=7d&filters={"category":"streaming"}
```

```http
GET /api/export/csv?timeRange=30d&userId=user123
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

### Seed Test Data
```bash
npm run seed
```

## Monitoring

### Health Check
```http
GET /health
```

### Service Statistics
```http
GET /api/stats
```

### Real-time Metrics
- **Active users**: Real-time count
- **Active streams**: Live streaming count
- **Revenue**: 24-hour total
- **Performance**: System metrics

## Deployment

### Docker
```bash
docker build -t harmoniecore-analytics .
docker run -p 3004:3004 --env-file .env harmoniecore-analytics
```

### Docker Compose
```yaml
version: '3.8'
services:
  analytics-service:
    build: .
    ports:
      - "3004:3004"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - mongodb
      - redis
```

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3004 |
| `MONGODB_URI` | MongoDB connection string | - |
| `REDIS_HOST` | Redis server host | localhost |
| `MOBILE_DATA_THRESHOLD` | Max bytes per event | 1024 |
| `SAMPLING_RATE` | Event sampling rate | 0.1 |
| `RETENTION_DAYS` | Data retention period | 90 |

## Integration Examples

### Frontend Tracking
```javascript
// Connect to analytics service
const socket = io('http://localhost:3004');

// Track streaming event
await fetch('http://localhost:3004/api/events/streaming', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUserId,
    streamId: currentStreamId,
    eventType: 'start',
    data: { quality: 'auto', mobileData: true }
  })
});
```

### Backend Integration
```javascript
// Track revenue from payment service
await fetch('http://localhost:3004/api/events/revenue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: buyerId,
    eventType: 'nft_purchase',
    revenueData: {
      amount: 0.1,
      artistId: artistId,
      transactionHash: txHash
    }
  })
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new analytics
4. Ensure mobile optimization
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
