# HarmonieCORE WebRTC Streaming Service - Developer Documentation

## 🎯 Overview

This is the **ultra-optimized WebRTC streaming backend** for HarmonieCORE, designed for **maximum speed** and **minimum data usage** on mobile devices. Features **adaptive bitrate**, **real-time optimization**, and **zero-cost infrastructure**.

## 🚀 Quick Start

### Prerequisites
```bash
Node.js 16+ (recommended: 18+)
Redis server running locally
docker-compose (for containerized setup)
```

### Installation
```bash
cd backend/stream-service
npm install

# Copy environment file
copy .env.example .env

# Start Redis (if using Docker)
docker-compose up -d redis

# Start development server
npm run dev
```

### Environment Setup
```bash
# Core settings
PORT=3001
NODE_ENV=development

# Redis configuration
REDIS_URL=redis://localhost:6379

# WebRTC optimization
TURN_SERVER_URL=turn:openrelay.metered.ca:80
TURN_USERNAME=openrelayproject
TURN_PASSWORD=openrelayproject
```

## 📁 Project Structure

```
backend/stream-service/
├── src/
│   ├── server.js                 # Main Express/Socket.IO server
│   ├── config/
│   │   ├── webrtc.js            # Standard WebRTC config
│   │   └── optimized-webrtc.js  # Ultra-optimized settings
│   ├── utils/
│   │   ├── streamManager.js     # Stream lifecycle management
│   │   ├── logger.js           # Winston logging
│   │   ├── adaptiveBitrateController.js  # Real-time optimization
│   │   └── streamOptimizer.js  # Compression & caching
│   └── middleware/
│       └── rateLimiter.js      # Rate limiting middleware
├── docs/
│   ├── DEVELOPMENT.md          # This file
│   └── API.md                  # API documentation
├── logs/                       # Application logs
├── .env.example               # Environment template
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## 🔧 Core Architecture

### Ultra-Optimized Components

#### 1. Adaptive Bitrate Controller (`adaptiveBitrateController.js`)
- **Real-time monitoring** every 1 second
- **4 quality tiers**: ultraLow → low → medium → high
- **Network prediction** prevents quality drops
- **Emergency fallback** for critical situations

#### 2. Stream Optimizer (`streamOptimizer.js`)
- **Video compression** with configurable levels
- **Delta frame compression** (only send changes)
- **Intelligent caching** with LRU eviction
- **Priority-based transmission** for critical data

#### 3. Optimized WebRTC Config (`optimized-webrtc.js`)
- **Mobile-first settings** (320x240, 15fps, 16kbps audio)
- **Connection-aware adaptation** (2G/3G/4G/WiFi)
- **Ultra-fast ICE gathering** (1-3 second connections)
- **Zero-cost TURN/STUN servers**

## 📊 Data Usage Comparison

| Quality Tier | Resolution | FPS | Audio Bitrate | Data Usage | Use Case |
|-------------|------------|-----|---------------|------------|----------|
| **UltraLow** | 320x240 | 15 | 16kbps | **0.2 MB/min** | Mobile 2G/3G |
| **Low** | 480x360 | 20 | 32kbps | **0.5 MB/min** | Mobile 4G |
| **Medium** | 640x480 | 24 | 64kbps | **1.0 MB/min** | WiFi mobile |
| **High** | 1280x720 | 30 | 128kbps | **2.0 MB/min** | Desktop/WiFi |

## 🛠️ Development Workflow

### 1. Starting the Server

**Development Mode** (with auto-restart):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

**With Docker**:
```bash
docker-compose up --build
```

### 2. Testing Endpoints

#### Get Optimized WebRTC Configuration
```bash
# Mobile optimization
curl "http://localhost:3001/api/webrtc/config?deviceType=mobile&connectionType=4g"

# Desktop optimization
curl "http://localhost:3001/api/webrtc/config?deviceType=desktop&connectionType=wifi"
```

#### Calculate Data Usage
```bash
# 10-minute stream at ultra-low quality
curl "http://localhost:3001/api/data-usage?duration=10&quality=ultraLow"
```

#### Network Optimization
```bash
curl -X POST http://localhost:3001/api/network/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "test-stream-123",
    "metrics": {
      "packetLoss": 0.02,
      "rtt": 150,
      "bandwidth": 500000
    }
  }'
```

### 3. Socket.IO Testing

#### Client Connection Example
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3001');

// Connect with optimization
socket.on('connect', () => {
  console.log('Connected to optimized WebRTC server');
});

// Start optimized stream
socket.emit('start-stream', {
  streamId: 'stream123',
  streamKey: 'key123',
  deviceType: 'mobile',
  connectionType: '4g'
});

// Listen for quality updates
socket.on('quality-update', (data) => {
  console.log('Quality optimized:', data);
});

// Send network metrics
socket.emit('network-metrics', {
  streamId: 'stream123',
  metrics: {
    packetLoss: 0.01,
    rtt: 100,
    bufferLevel: 0.8
  }
});
```

## 🔍 Debugging & Monitoring

### Log Levels
```bash
# Debug mode for development
LOG_LEVEL=debug npm run dev

# Production logging
LOG_LEVEL=info npm start
```

### Log Files
- `logs/error.log` - Error events
- `logs/combined.log` - All events
- Console output for development

### Real-time Monitoring
```bash
# Watch logs in real-time
tail -f logs/combined.log

# Check optimization stats
curl http://localhost:3001/metrics
```

## 🧪 Testing Strategies

### 1. Network Simulation
```bash
# Simulate slow 3G
npm install --global throttled
throttled --up 500 --down 1000 --rtt 300

# Test with network conditions
node test/network-simulation.js
```

### 2. Load Testing
```bash
# Install load testing tools
npm install --global artillery

# Run load test
artillery run test/load-test.yml
```

### 3. Mobile Testing
```javascript
// Test mobile optimization
const mobileConfig = {
  deviceType: 'mobile',
  connectionType: '3g',
  quality: 'ultraLow'
};

// Verify data usage
const usage = calculateDataUsage(60, 'ultraLow');
console.log(`60-minute mobile stream: ${usage} MB`);
```

## 🐛 Common Issues & Solutions

### Issue: Server won't start
**Solution:**
```bash
# Check Redis connection
redis-cli ping
# Should return: PONG

# Check port availability
netstat -an | find "3001"
```

### Issue: High data usage
**Solution:**
- Ensure `deviceType: 'mobile'` is set
- Verify `quality: 'ultraLow'` for mobile
- Check network metrics are being sent

### Issue: Connection failures
**Solution:**
- Verify TURN server credentials
- Check firewall settings
- Test with different ICE servers

## 🚀 Performance Optimization Tips

### 1. Mobile-First Development
```javascript
// Always start with ultra-low settings
const initialConfig = {
  quality: 'ultraLow',
  deviceType: 'mobile',
  adaptiveBitrate: true
};
```

### 2. Network-Aware Streaming
```javascript
// Monitor and adapt in real-time
setInterval(() => {
  const metrics = getNetworkMetrics();
  socket.emit('network-metrics', {
    streamId: currentStreamId,
    metrics
  });
}, 1000);
```

### 3. Compression Best Practices
```javascript
// Use delta compression for video frames
const compressed = streamOptimizer.compressDeltaFrame(
  currentFrame,
  previousFrame
);

// Cache frequently used frames
const cacheKey = streamOptimizer.cacheFrame(frameId, frameData);
```

## 🔄 Continuous Integration

### GitHub Actions Workflow
```yaml
name: WebRTC Service CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

### Docker Development
```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up

# Production build
docker-compose up --build
```

## 📚 Additional Resources

### API Documentation
- [API Reference](./API.md)
- [WebRTC Configuration Guide](./WEBRTC_CONFIG.md)
- [Mobile Optimization Guide](./MOBILE_OPTIMIZATION.md)

### External Resources
- [WebRTC.org Documentation](https://webrtc.org/getting-started/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Redis Documentation](https://redis.io/documentation)

### Community
- [HarmonieCORE Discord](https://discord.gg/harmoniecore)
- [GitHub Issues](https://github.com/harmoniecore/backend/issues)
- [Developer Forum](https://forum.harmoniecore.com)

---

**🎯 Next Steps**: Check out [API.md](./API.md) for detailed endpoint documentation and [MOBILE_OPTIMIZATION.md](./MOBILE_OPTIMIZATION.md) for mobile-specific implementation guides.
