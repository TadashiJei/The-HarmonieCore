# HarmonieCORE Streaming Features Documentation

## Overview

This document provides comprehensive documentation for the live streaming, chat system, and recording features implemented in the HarmonieCORE WebRTC streaming backend.

## Features Implemented

### 1. Live Streaming Service

The live streaming service provides complete stream lifecycle management with ultra-optimization for mobile and low-bandwidth environments.

#### Key Features:
- **Stream Creation**: Create new live streams with metadata
- **Stream Management**: Start, join, leave, and end streams
- **Viewer Tracking**: Real-time viewer count and participation
- **Mobile Optimization**: Automatic quality adjustment based on device type
- **Redis Persistence**: Stream state and metadata storage
- **Event-Driven**: Real-time updates via Socket.IO

#### API Endpoints:
```
POST   /api/streams/create          - Create new stream
GET    /api/streams                 - Get active streams
GET    /api/streams/:streamId       - Get stream details
GET    /api/streams/:streamId/stats - Get stream statistics
```

#### Socket.IO Events:
```javascript
// Client → Server
socket.emit('create-stream', { artistId, title, description, category })
socket.emit('start-stream', { streamId, userId })
socket.emit('join-stream', { streamId, userData })
socket.emit('leave-stream', { streamId, userId })
socket.emit('end-stream', { streamId, userId })

// Server → Client
socket.on('stream-created', (stream) => {})
socket.on('stream-started', (stream) => {})
socket.on('joined-stream', (data) => {})
socket.on('viewer-joined', (data) => {})
socket.on('viewer-left', (data) => {})
socket.on('stream-ended', (data) => {})
```

### 2. Chat System

Ultra-optimized real-time chat system designed for mobile data efficiency.

#### Key Features:
- **Real-time Messaging**: Instant message delivery
- **Mobile Optimization**: Message compression and truncation
- **Emoji Support**: Compressed emoji handling
- **Rate Limiting**: Prevents spam (10 messages/minute)
- **Moderation Tools**: Mute/unmute users
- **Tips System**: Integrated tipping with currency support
- **Typing Indicators**: Real-time typing status
- **Message History**: Configurable history retention

#### Optimization Features:
- **Message Compression**: Automatic emoji compression
- **Size Limits**: 500 character maximum
- **Smart Truncation**: Graceful handling of long messages
- **Data Efficiency**: Minimal bandwidth usage

#### Socket.IO Events:
```javascript
// Client → Server
socket.emit('send-message', { streamId, message })
socket.emit('send-tip', { streamId, amount, currency, message })
socket.emit('typing', { streamId, isTyping })
socket.emit('moderate-user', { streamId, targetUserId, action, reason })

// Server → Client
socket.on('new-message', (message) => {})
socket.on('new-tip', (tipMessage) => {})
socket.on('typing-indicator', (data) => {})
socket.on('user-moderated', (data) => {})
```

### 3. Recording Service

Ultra-optimized recording service with mobile-first design.

#### Key Features:
- **Chunk-based Recording**: 30-second chunks for reliability
- **Mobile Optimization**: Reduced quality for mobile devices
- **Compression**: Maximum compression (level 9)
- **Quality Tiers**: Separate mobile/desktop quality settings
- **Storage Management**: Automatic cleanup of old recordings
- **Metadata Tracking**: Comprehensive recording information

#### Quality Settings:

**Mobile Quality:**
- Video: 480p @ 20fps, 300kbps
- Audio: 16kHz, 32kbps, mono
- Max file size: 500MB

**Desktop Quality:**
- Video: 720p @ 30fps, 1Mbps
- Audio: 44.1kHz, 128kbps, stereo
- Max file size: 500MB

#### API Endpoints:
```
POST   /api/streams/:streamId/recordings/start  - Start recording
POST   /api/streams/:streamId/recordings/stop   - Stop recording
GET    /api/streams/:streamId/recordings        - Get stream recordings
GET    /api/recordings/:recordingId             - Get recording details
DELETE /api/recordings/:recordingId             - Delete recording
```

#### Socket.IO Events:
```javascript
// Client → Server
socket.emit('start-recording', { streamId, deviceType })
socket.emit('stop-recording', { streamId })

// Server → Client
socket.on('recording-started', (recording) => {})
socket.on('recording-stopped', (recording) => {})
socket.on('recording-status', (status) => {})
```

## Integration Workflow

### Complete Streaming Workflow

1. **Create Stream**
   ```javascript
   const stream = await fetch('/api/streams/create', {
     method: 'POST',
     body: JSON.stringify({
       artistId: 'artist123',
       title: 'Live Concert',
       category: 'music',
       recordingEnabled: true
     })
   });
   ```

2. **Start Stream**
   ```javascript
   socket.emit('start-stream', { 
     streamId: stream.id, 
     userId: 'artist123' 
   });
   ```

3. **Viewers Join**
   ```javascript
   socket.emit('join-stream', {
     streamId: stream.id,
     userData: { userId: 'viewer1', username: 'Fan1' }
   });
   ```

4. **Chat Interaction**
   ```javascript
   socket.emit('send-message', {
     streamId: stream.id,
     message: 'Great performance!'
   });
   ```

5. **Recording**
   ```javascript
   socket.emit('start-recording', {
     streamId: stream.id,
     deviceType: 'mobile'
   });
   ```

6. **Tips**
   ```javascript
   socket.emit('send-tip', {
     streamId: stream.id,
     amount: 5.00,
     currency: 'USD',
     message: 'Amazing!'
   });
   ```

## Mobile Optimization Features

### Data Usage Optimization

1. **Adaptive Bitrate**: Automatically adjusts quality based on network conditions
2. **Message Compression**: Emojis compressed to short codes
3. **Smart Truncation**: Long messages truncated gracefully
4. **Efficient Recording**: Mobile-specific quality settings
5. **Rate Limiting**: Prevents excessive data usage

### Battery Optimization

1. **Reduced Processing**: Lower quality for mobile devices
2. **Efficient Compression**: Minimizes CPU usage
3. **Smart Polling**: Optimized network requests
4. **Background Handling**: Graceful degradation

## Error Handling

### Common Error Scenarios

1. **Rate Limiting**: Returns 429 with retry-after header
2. **Stream Not Found**: Returns 404 with clear message
3. **Permission Denied**: Returns 403 for unauthorized actions
4. **Storage Limit**: Returns 413 when recording size exceeded

### Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { "additional": "info" }
}
```

## Security Features

1. **Rate Limiting**: Applied to all endpoints
2. **Input Validation**: All inputs sanitized and validated
3. **Authentication**: Ready for JWT integration
4. **CORS**: Configured for frontend domains
5. **Helmet**: Security headers enabled

## Testing

### Running Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Test Coverage Areas
- Live streaming lifecycle
- Chat functionality
- Recording operations
- Mobile optimization
- Error handling
- Rate limiting
- Integration scenarios

## Monitoring and Analytics

### Key Metrics
- Active streams count
- Viewer engagement
- Chat message volume
- Recording storage usage
- Mobile vs desktop usage
- Data savings from optimization

### Logging
- All events logged with appropriate levels
- Performance metrics tracked
- Error details captured
- User actions audited

## Future Enhancements

1. **Advanced Moderation**: AI-powered content moderation
2. **Multi-language Support**: International chat
3. **Advanced Analytics**: Detailed engagement metrics
4. **CDN Integration**: Global content delivery
5. **Mobile SDK**: Native mobile integration
6. **WebRTC SFU**: Scalable media routing
7. **Recording Editing**: Post-processing capabilities

## Support and Troubleshooting

### Common Issues
1. **Connection Problems**: Check TURN/STUN server configuration
2. **Quality Issues**: Verify network conditions and device capabilities
3. **Recording Failures**: Check storage permissions and disk space
4. **Chat Delays**: Monitor Redis connection and rate limiting

### Debug Mode
Enable debug logging:
```bash
DEBUG=harmoniecore:* npm start
```

### Performance Monitoring
Monitor these key areas:
- CPU usage during recording
- Memory consumption
- Network bandwidth
- Storage I/O
- Redis performance
