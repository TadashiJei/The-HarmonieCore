# HarmonieCORE WebRTC API Documentation

## 📋 Table of Contents
- [REST API Endpoints](#rest-api-endpoints)
- [WebSocket Events](#websocket-events)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## 🌐 REST API Endpoints

### Base URL
```
http://localhost:3001
```

### Health & Metrics

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-07-25T16:00:00.000Z",
  "uptime": 12345,
  "memory": {
    "used": 45678912,
    "total": 134217728
  }
}
```

#### Enhanced Metrics
```http
GET /metrics
```

**Response:**
```json
{
  "activeStreams": 5,
  "activeRooms": 3,
  "totalConnections": 127,
  "optimizationStats": {
    "totalBytesSaved": 52428800,
    "compressionRatio": 0.65,
    "cacheHits": 1234,
    "cacheMisses": 567
  },
  "adaptiveBitrateStats": {
    "activeStreams": 5,
    "qualityDistribution": {
      "ultraLow": 2,
      "low": 2,
      "medium": 1,
      "high": 0
    }
  }
}
```

### WebRTC Configuration

#### Get Optimized Configuration
```http
GET /api/webrtc/config?deviceType=mobile&connectionType=4g
```

**Parameters:**
- `deviceType` (optional): `mobile` | `desktop` (default: desktop)
- `connectionType` (optional): `slow-2g` | `2g` | `3g` | `4g` | `wifi` | `ethernet` (default: wifi)

**Response:**
```json
{
  "iceServers": [
    {
      "urls": "stun:stun.l.google.com:19302"
    },
    {
      "urls": "turn:openrelay.metered.ca:80?transport=udp",
      "username": "openrelayproject",
      "credential": "openrelayproject"
    }
  ],
  "mediaConstraints": {
    "audio": {
      "echoCancellation": true,
      "noiseSuppression": true,
      "sampleRate": 16000,
      "channelCount": 1,
      "bitrate": 16000
    },
    "video": {
      "width": { "ideal": 320, "max": 640 },
      "height": { "ideal": 240, "max": 480 },
      "frameRate": { "ideal": 15, "max": 24 }
    }
  },
  "qualityTiers": {
    "ultraLow": {
      "name": "Ultra Low Data",
      "video": { "width": 320, "height": 240, "fps": 15, "bitrate": 150000 },
      "audio": { "bitrate": 16000 },
      "dataUsage": "~0.2 MB/min"
    }
  },
  "recommended": {
    "videoBitrate": 300000,
    "audioBitrate": 32000,
    "fps": 20
  }
}
```

### Data Usage Estimation

#### Calculate Data Usage
```http
GET /api/data-usage?duration=60&quality=ultraLow
```

**Parameters:**
- `duration` (optional): Duration in minutes (default: 60)
- `quality` (optional): `ultraLow` | `low` | `medium` | `high` (default: medium)

**Response:**
```json
{
  "duration": 60,
  "quality": "ultraLow",
  "estimatedUsage": "12.00 MB",
  "recommendations": {
    "ultraLow": "12.00 MB",
    "low": "30.00 MB",
    "medium": "60.00 MB",
    "high": "120.00 MB"
  }
}
```

### Network Optimization

#### Optimize Network Settings
```http
POST /api/network/optimize
```

**Request Body:**
```json
{
  "streamId": "stream-12345",
  "metrics": {
    "packetLoss": 0.02,
    "rtt": 150,
    "bandwidth": 500000,
    "bufferLevel": 0.7
  }
}
```

**Response:**
```json
{
  "currentQuality": {
    "currentQuality": "low",
    "currentBitrate": 300000,
    "networkScore": 75,
    "packetLoss": 0.02,
    "rtt": 150,
    "bufferLevel": 0.7
  },
  "dataUsage": {
    "estimatedMB": "18.00",
    "quality": "low",
    "bitrate": 300000
  },
  "recommendations": {
    "nextQuality": "higher",
    "estimatedSavings": "up to 60% with ultra-low quality"
  }
}
```

### Stream Management

#### Create Stream
```http
POST /api/streams/create
```

**Request Body:**
```json
{
  "artistId": "artist-123",
  "title": "Live Art Session",
  "description": "Creating digital art live",
  "category": "art"
}
```

**Response:**
```json
{
  "streamId": "uuid-here",
  "streamKey": "uuid-key-here",
  "status": "created",
  "createdAt": "2024-07-25T16:00:00.000Z"
}
```

#### Get Stream Info
```http
GET /api/streams/:streamId
```

**Response:**
```json
{
  "id": "stream-12345",
  "artistId": "artist-123",
  "title": "Live Art Session",
  "status": "live",
  "viewers": 42,
  "totalTips": 125.50,
  "startedAt": "2024-07-25T16:00:00.000Z",
  "optimizationEnabled": true,
  "currentQuality": "medium"
}
```

---

## 🔌 WebSocket Events

### Connection Events

#### Client Connection
```javascript
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected to streaming server');
});
```

### Stream Events

#### Join Stream
```javascript
socket.emit('join-stream', {
  streamId: 'stream-12345',
  userId: 'user-67890',
  userType: 'viewer' // or 'artist'
});
```

**Response Events:**
```javascript
socket.on('viewer-joined', (data) => {
  console.log('New viewer:', data.userId, 'Total:', data.viewerCount);
});
```

#### Start Optimized Stream
```javascript
socket.emit('start-stream', {
  streamId: 'stream-12345',
  streamKey: 'secret-key-123',
  deviceType: 'mobile', // or 'desktop'
  connectionType: '4g'  // 'slow-2g', '2g', '3g', '4g', 'wifi', 'ethernet'
});
```

**Response Events:**
```javascript
socket.on('stream-started', (data) => {
  console.log('Stream started:', {
    streamId: data.streamId,
    optimization: data.optimization
  });
});
```

#### Send Network Metrics
```javascript
socket.emit('network-metrics', {
  streamId: 'stream-12345',
  metrics: {
    packetLoss: 0.01,
    rtt: 100,
    bandwidth: 800000,
    bufferLevel: 0.8
  }
});
```

**Response Events:**
```javascript
socket.on('quality-update', (data) => {
  console.log('Quality optimized:', data);
});
```

#### Request Quality Change
```javascript
socket.emit('request-quality-change', {
  streamId: 'stream-12345',
  requestedQuality: 'ultraLow' // 'ultraLow', 'low', 'medium', 'high'
});
```

**Response Events:**
```javascript
socket.on('quality-changed', (data) => {
  console.log('Quality changed:', {
    previous: data.previousQuality,
    current: data.newQuality,
    savings: data.estimatedSavings
  });
});
```

### Chat Events

#### Send Chat Message
```javascript
socket.emit('send-message', {
  streamId: 'stream-12345',
  message: 'Great artwork!',
  userId: 'user-67890',
  username: 'ArtFan123'
});
```

#### Receive Chat Messages
```javascript
socket.on('chat-message', (data) => {
  console.log(`${data.username}: ${data.message}`);
});
```

### Tipping Events

#### Send Tip
```javascript
socket.emit('send-tip', {
  streamId: 'stream-12345',
  amount: 5.00,
  currency: 'USD',
  userId: 'user-67890',
  message: 'Love your work!'
});
```

#### Receive Tips
```javascript
socket.on('tip-received', (data) => {
  console.log(`Received $${data.amount} tip from ${data.username}`);
});
```

### Optimization Events

#### Get Optimization Statistics
```javascript
socket.emit('get-optimization-stats');
```

**Response Events:**
```javascript
socket.on('optimization-stats', (stats) => {
  console.log('Optimization statistics:', {
    adaptiveBitrate: stats.adaptiveBitrate,
    streamOptimizer: stats.streamOptimizer,
    timestamp: stats.timestamp
  });
});
```

---

## 📊 Data Models

### Stream Object
```typescript
interface Stream {
  id: string;
  artistId: string;
  title: string;
  description: string;
  category: string;
  streamKey: string;
  status: 'created' | 'live' | 'ended';
  viewers: number;
  totalTips: number;
  startedAt?: string;
  endedAt?: string;
  deviceType: 'mobile' | 'desktop';
  connectionType: string;
  optimizationEnabled: boolean;
  currentQuality: 'ultraLow' | 'low' | 'medium' | 'high';
}
```

### Chat Message
```typescript
interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}
```

### Tip Transaction
```typescript
interface TipTransaction {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  amount: number;
  currency: string;
  message?: string;
  timestamp: string;
}
```

### Network Metrics
```typescript
interface NetworkMetrics {
  packetLoss: number;    // 0.0 to 1.0
  rtt: number;          // milliseconds
  bandwidth: number;    // bits per second
  bufferLevel: number;  // 0.0 to 1.0
}
```

---

## ❌ Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific error detail"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `STREAM_NOT_FOUND` | Stream does not exist | 404 |
| `INVALID_STREAM_KEY` | Stream key is invalid | 401 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `VALIDATION_ERROR` | Invalid request data | 400 |
| `NETWORK_ERROR` | Connection issues | 503 |

### Error Handling Example
```javascript
// Client-side error handling
socket.on('error', (error) => {
  switch(error.code) {
    case 'STREAM_NOT_FOUND':
      showError('Stream not found');
      break;
    case 'RATE_LIMIT_EXCEEDED':
      showError('Too many requests, please wait');
      break;
    default:
      showError(error.message);
  }
});
```

---

## ⚡ Rate Limiting

### Limits
- **API endpoints**: 100 requests per 15 minutes per IP
- **WebSocket events**: 50 events per minute per socket
- **Stream creation**: 10 streams per hour per IP

### Rate Limit Response
```json
{
  "error": "Too many requests",
  "retryAfter": 30
}
```

### Handling Rate Limits
```javascript
// Client-side rate limit handling
socket.on('error', (error) => {
  if (error.error === 'Too many requests') {
    setTimeout(() => {
      // Retry after delay
      retryOperation();
    }, error.retryAfter * 1000);
  }
});
```

---

## 🧪 Testing Examples

### Complete Integration Test
```javascript
const io = require('socket.io-client');

async function testCompleteFlow() {
  const socket = io('http://localhost:3001');
  
  // 1. Create stream
  const createResponse = await fetch('http://localhost:3001/api/streams/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artistId: 'test-artist',
      title: 'Test Stream',
      category: 'test'
    })
  });
  
  const { streamId, streamKey } = await createResponse.json();
  
  // 2. Get optimized config
  const configResponse = await fetch(
    `/api/webrtc/config?deviceType=mobile&connectionType=4g`
  );
  const config = await configResponse.json();
  
  // 3. Start optimized stream
  socket.emit('start-stream', {
    streamId,
    streamKey,
    deviceType: 'mobile',
    connectionType: '4g'
  });
  
  // 4. Send network metrics
  setInterval(() => {
    socket.emit('network-metrics', {
      streamId,
      metrics: {
        packetLoss: Math.random() * 0.05,
        rtt: 50 + Math.random() * 100,
        bandwidth: 500000 + Math.random() * 500000,
        bufferLevel: 0.5 + Math.random() * 0.5
      }
    });
  }, 5000);
  
  // 5. Handle optimization updates
  socket.on('quality-update', (data) => {
    console.log('Quality optimized:', data);
  });
}
```

---

## 📱 Client SDK Examples

### JavaScript/Node.js
```javascript
import { HarmonieWebRTC } from '@harmoniecore/webrtc-sdk';

const client = new HarmonieWebRTC({
  serverUrl: 'http://localhost:3001',
  deviceType: 'mobile',
  autoOptimize: true
});

await client.connect();
const stream = await client.createStream({
  title: 'My Art Stream',
  quality: 'ultraLow'
});
```

### React Hook
```javascript
import { useHarmonieStream } from '@harmoniecore/react-webrtc';

function StreamComponent() {
  const { 
    stream, 
    quality, 
    viewers, 
    sendMessage, 
    sendTip 
  } = useHarmonieStream('stream-12345');
  
  return (
    <div>
      <h3>{stream?.title}</h3>
      <p>Quality: {quality}</p>
      <p>Viewers: {viewers}</p>
    </div>
  );
}
```

---

**🔗 Next**: See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup and development workflow.
