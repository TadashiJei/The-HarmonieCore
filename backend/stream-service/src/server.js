const express = require('express');
const http = require('http');
const logger = require('./utils/logger');
const rateLimiter = require('./middleware/rateLimiter');
const AdaptiveBitrateController = require('./utils/adaptiveBitrateController');
const StreamOptimizer = require('./utils/streamOptimizer');
const { getOptimizedQuality, calculateDataUsage } = require('./config/optimized-webrtc');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Import new services
const LiveStreamService = require('./services/liveStreamService');
const ChatService = require('./services/chatService');
const RecordingService = require('./services/recordingService');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const apiRateLimiter = new RateLimiterMemory({
  keyPrefix: 'stream_api',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));

// Initialize services
const adaptiveBitrate = new AdaptiveBitrateController();
const streamOptimizer = new StreamOptimizer();
const liveStreamService = new LiveStreamService();
const chatService = new ChatService();
const recordingService = new RecordingService();

// Start cache cleanup every 5 minutes
setInterval(() => {
  streamOptimizer.cleanupCache();
}, 300000);
app.use(express.json({ limit: '10mb' }));

// Redis client
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

// Active streams storage
const activeStreams = new Map();
const streamRooms = new Map();

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    await apiRateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.round(rejRes.msBeforeNext) || 1
    });
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeStreams: activeStreams.size,
    activeRooms: streamRooms.size
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    activeStreams: activeStreams.size,
    activeRooms: streamRooms.size,
    totalConnections: io.engine.clientsCount,
    redisConnected: redisClient.connected
  });
});

// Optimized WebRTC configuration endpoint
app.get('/api/webrtc/config', (req, res) => {
  const { deviceType = 'desktop', connectionType = 'wifi' } = req.query;
  
  const config = require('./config/optimized-webrtc');
  const optimizedConfig = config.getFastConnectionConfig(deviceType === 'mobile');
  
  res.json({
    iceServers: optimizedConfig.iceServers,
    mediaConstraints: optimizedConfig.mediaConstraints,
    connectionOptimization: optimizedConfig.connectionOptimization,
    qualityTiers: config.optimizedWebRTCConfig.qualityTiers,
    recommended: config.getOptimizedQuality(connectionType, 50, 1000000)
  });
});

// Data usage estimation endpoint
app.get('/api/data-usage', (req, res) => {
  const { duration = 60, quality = 'medium' } = req.query;
  const durationMinutes = parseInt(duration);
  
  const config = require('./config/optimized-webrtc');
  const usage = config.calculateDataUsage(durationMinutes, quality);
  
  res.json({
    duration: durationMinutes,
    quality,
    estimatedUsage: usage,
    recommendations: {
      ultraLow: config.calculateDataUsage(durationMinutes, 'ultraLow'),
      low: config.calculateDataUsage(durationMinutes, 'low'),
      medium: config.calculateDataUsage(durationMinutes, 'medium'),
      high: config.calculateDataUsage(durationMinutes, 'high')
    }
  });
});

// Network optimization endpoint
app.post('/api/network/optimize', (req, res) => {
  const { streamId, metrics } = req.body;
  
  if (!streamId) {
    return res.status(400).json({ error: 'streamId is required' });
  }

  // Update adaptive bitrate with new metrics
  adaptiveBitrate.updateNetworkMetrics(streamId, metrics);
  
  const currentQuality = adaptiveBitrate.getStreamQuality(streamId);
  const dataUsage = adaptiveBitrate.getDataUsageEstimate(streamId, 1);
  
  res.json({
    currentQuality,
    dataUsage,
    recommendations: {
      nextQuality: currentQuality.networkScore > 75 ? 'higher' : 'lower',
      estimatedSavings: 'up to 60% with ultra-low quality'
    }
  });
});

// Stream management endpoints
app.post('/api/streams/create', rateLimitMiddleware, async (req, res) => {
  try {
    const { artistId, title, description, category } = req.body;
    
    if (!artistId || !title) {
      return res.status(400).json({ error: 'Artist ID and title are required' });
    }

    const streamId = uuidv4();
    const streamKey = uuidv4();
    
    const streamData = {
      id: streamId,
      artistId,
      title,
      description: description || '',
      category: category || 'general',
      streamKey,
      status: 'created',
      createdAt: new Date().toISOString(),
      viewers: 0,
      totalTips: 0,
      isLive: false
    };

    // Store in Redis for persistence
    await redisClient.setEx(`stream:${streamId}`, 3600, JSON.stringify(streamData));
    
    // Store in memory
    activeStreams.set(streamId, streamData);
    
    logger.info(`Stream created: ${streamId} by artist: ${artistId}`);
    
    res.json({
      success: true,
      streamId,
      streamKey,
      streamData
    });
  } catch (error) {
    logger.error('Error creating stream:', error);
    res.status(500).json({ error: 'Failed to create stream' });
  }
});

// Get stream information
app.get('/api/streams/:streamId', async (req, res) => {
  try {
    const stream = await liveStreamService.getStream(req.params.streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    res.json(stream);
  } catch (error) {
    logger.error('Error getting stream:', error);
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

// Get active streams
app.get('/api/streams', async (req, res) => {
  try {
    const activeStreams = await liveStreamService.getActiveStreams();
    res.json(activeStreams);
  } catch (error) {
    logger.error('Error getting active streams:', error);
    res.status(500).json({ error: 'Failed to get streams' });
  }
});

// Get stream statistics
app.get('/api/streams/:streamId/stats', async (req, res) => {
  try {
    const stats = await liveStreamService.getStreamStats(req.params.streamId);
    if (!stats) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    res.json(stats);
  } catch (error) {
    logger.error('Error getting stream stats:', error);
    res.status(500).json({ error: 'Failed to get stream stats' });
  }
});

// ===== RECORDING API ENDPOINTS =====

// Start recording for a stream
app.post('/api/streams/:streamId/recordings/start', rateLimitMiddleware, async (req, res) => {
  try {
    const { deviceType = 'desktop' } = req.body;
    const { streamId } = req.params;
    
    const stream = await liveStreamService.getStream(streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const recording = await recordingService.startRecording(streamId, stream, { deviceType });
    res.json(recording);
  } catch (error) {
    logger.error('Error starting recording:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// Stop recording for a stream
app.post('/api/streams/:streamId/recordings/stop', rateLimitMiddleware, async (req, res) => {
  try {
    const recording = await recordingService.stopRecording(req.params.streamId);
    res.json(recording);
  } catch (error) {
    logger.error('Error stopping recording:', error);
    res.status(500).json({ error: 'Failed to stop recording' });
  }
});

// Get recordings for a stream
app.get('/api/streams/:streamId/recordings', async (req, res) => {
  try {
    const recordings = await recordingService.getStreamRecordings(req.params.streamId);
    res.json(recordings);
  } catch (error) {
    logger.error('Error getting recordings:', error);
    res.status(500).json({ error: 'Failed to get recordings' });
  }
});

// Get recording information
app.get('/api/recordings/:recordingId', async (req, res) => {
  try {
    const recording = await recordingService.getRecording(req.params.recordingId);
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    res.json(recording);
  } catch (error) {
    logger.error('Error getting recording:', error);
    res.status(500).json({ error: 'Failed to get recording' });
  }
});

// Delete recording
app.delete('/api/recordings/:recordingId', rateLimitMiddleware, async (req, res) => {
  try {
    await recordingService.deleteRecording(req.params.recordingId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting recording:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-stream', async (data) => {
    try {
      const { streamId, userId, userType } = data;
      
      if (!streamId) {
        socket.emit('error', { message: 'Stream ID is required' });
        return;
      }

      const stream = activeStreams.get(streamId);
      if (!stream) {
        socket.emit('error', { message: 'Stream not found' });
        return;
      }

      // Join the stream room
      socket.join(`stream:${streamId}`);
      
      // Update viewer count
      if (userType === 'viewer') {
        stream.viewers += 1;
        activeStreams.set(streamId, stream);
        
        // Update Redis
        await redisClient.setEx(`stream:${streamId}`, 3600, JSON.stringify(stream));
        
        // Notify others
        socket.to(`stream:${streamId}`).emit('viewer-joined', {
          userId,
          viewerCount: stream.viewers
        });
      }

      logger.info(`User ${userId} joined stream ${streamId}`);
      
    } catch (error) {
      logger.error('Error joining stream:', error);
      socket.emit('error', { message: 'Failed to join stream' });
    }
  });

  socket.on('start-stream', async (data) => {
    try {
      const { streamId, streamKey, deviceType = 'desktop', connectionType = 'wifi' } = data;
      
      const stream = activeStreams.get(streamId);
      if (!stream || stream.streamKey !== streamKey) {
        socket.emit('error', { message: 'Invalid stream credentials' });
        return;
      }

      stream.isLive = true;
      stream.startedAt = new Date().toISOString();
      stream.deviceType = deviceType;
      stream.connectionType = connectionType;
      stream.optimizationEnabled = true;
      activeStreams.set(streamId, stream);
      
      // Initialize adaptive bitrate for this stream
      adaptiveBitrate.initializeStream(streamId, { deviceType, connectionType });
      
      // Update Redis
      await redisClient.setEx(`stream:${streamId}`, 3600, JSON.stringify(stream));

      socket.join(`stream:${streamId}`);
      socket.emit('stream-started', { 
        streamId, 
        status: 'live',
        startedAt: stream.startedAt,
        optimization: {
          adaptiveBitrate: true,
          initialQuality: deviceType === 'mobile' ? 'ultraLow' : 'medium',
          estimatedDataUsage: calculateDataUsage(1, deviceType === 'mobile' ? 'ultraLow' : 'medium'),
          compressionEnabled: true
        }
      });

      logger.info(`Optimized stream ${streamId} started`, {
        deviceType,
        connectionType,
        optimizationEnabled: true
      });
    } catch (error) {
      logger.error('Error starting optimized stream:', error);
      socket.emit('error', { message: 'Failed to start optimized stream' });
    }
  });

  socket.on('webrtc-offer', (data) => {
    const { streamId, offer, targetId } = data;
    socket.to(targetId || `stream:${streamId}`).emit('webrtc-offer', {
      offer,
      senderId: socket.id,
      streamId
    });
  });

  socket.on('webrtc-answer', (data) => {
    const { streamId, answer, targetId } = data;
    socket.to(targetId).emit('webrtc-answer', {
      answer,
      senderId: socket.id,
      streamId
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const { streamId, candidate, targetId } = data;
    socket.to(targetId).emit('webrtc-ice-candidate', {
      candidate,
      senderId: socket.id,
      streamId
    });
  });

  socket.on('send-message', async (data) => {
    try {
      const { streamId, message, userId, username } = data;
      
      const chatMessage = {
        id: uuidv4(),
        userId,
        username,
        message,
        timestamp: new Date().toISOString()
      };
      
      logger.info(`User ${userId} left stream ${streamId}`);
    } catch (error) {
      logger.error('Error leaving stream:', error);
    }
  });

  // End stream
  socket.on('end-stream', async (data) => {
    try {
      const { streamId, userId } = data;
      const stream = await liveStreamService.endStream(streamId, userId);
      
      // Notify all viewers
      io.to(streamId).emit('stream-ended', { streamId, endedBy: userId });
      
      // Stop any active recording
      if (recordingService.isRecordingActive(streamId)) {
        await recordingService.stopRecording(streamId);
      }
      
      // Cleanup chat room
      await chatService.cleanupRoom(streamId);
      
      logger.info(`Stream ${streamId} ended by ${userId}`);
    } catch (error) {
      logger.error('Error ending stream:', error);
    }
  });

  // ===== CHAT EVENTS =====

  // Send chat message
  socket.on('send-message', async (data) => {
    try {
      const { streamId, message } = data;
      const participantId = socket.id;
      
      const chatMessage = await chatService.sendMessage(streamId, participantId, { message });
      
      // Broadcast to all participants in the stream
      io.to(streamId).emit('new-message', chatMessage);
      
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Send tip
  socket.on('send-tip', async (data) => {
    try {
      const { streamId, amount, currency, message } = data;
      const participantId = socket.id;
      
      const tipMessage = await chatService.sendTipMessage(streamId, participantId, {
        amount,
        currency,
        message
      });
      
      io.to(streamId).emit('new-tip', tipMessage);
      
    } catch (error) {
      logger.error('Error sending tip:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { streamId, isTyping } = data;
    chatService.sendTypingIndicator(streamId, socket.id, isTyping);
  });

  // Moderation
  socket.on('moderate-user', async (data) => {
    try {
      const { streamId, targetUserId, action, reason } = data;
      const moderatorId = socket.userId; // This would come from auth middleware
      
      const moderationMessage = await chatService.moderateUser(
        streamId,
        moderatorId,
        targetUserId,
        action,
        reason
      );
      
      io.to(streamId).emit('user-moderated', moderationMessage);
      
    } catch (error) {
      logger.error('Error moderating user:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // ===== RECORDING EVENTS =====

  // Start recording
  socket.on('start-recording', async (data) => {
    try {
      const { streamId, deviceType } = data;
      const stream = await liveStreamService.getStream(streamId);
      
      if (!stream) {
        return socket.emit('error', { message: 'Stream not found' });
      }
      
      const recording = await recordingService.startRecording(streamId, stream, { deviceType });
      socket.emit('recording-started', recording);
      
      // Notify stream owner
      io.to(streamId).emit('recording-status', {
        streamId,
        recording: true,
        recordingId: recording.id
      });
      
    } catch (error) {
      logger.error('Error starting recording:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Stop recording
  socket.on('stop-recording', async (data) => {
    try {
      const { streamId } = data;
      const recording = await recordingService.stopRecording(streamId);
      
      socket.emit('recording-stopped', recording);
      io.to(streamId).emit('recording-status', {
        streamId,
        recording: false,
        recordingId: recording.id
      });
      
    } catch (error) {
      logger.error('Error stopping recording:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // ===== WEBRTC EVENTS =====

  // Handle WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    socket.to(data.streamId).emit('webrtc-offer', data);
  });

  socket.on('webrtc-answer', (data) => {
    socket.to(data.streamId).emit('webrtc-answer', data);
  });

  socket.on('webrtc-ice-candidate', (data) => {
    socket.to(data.streamId).emit('webrtc-ice-candidate', data);
  });

  // Network optimization events
  socket.on('network-metrics', async (data) => {
    try {
      const { streamId, metrics } = data;
      const optimization = await adaptiveBitrate.processNetworkMetrics(streamId, metrics);
      
      socket.emit('quality-update', optimization);
      
      // Broadcast to other participants in the room
      socket.to(streamId).emit('peer-quality-update', {
        peerId: socket.id,
        quality: optimization.recommendedQuality
      });
    } catch (error) {
      logger.error('Error changing quality:', error);
    }
  });

  socket.on('get-optimization-stats', () => {
    const stats = {
      adaptiveBitrate: adaptiveBitrate.getOptimizationStats(),
      streamOptimizer: streamOptimizer.getOptimizationStats(),
      timestamp: new Date().toISOString()
    };
    
    socket.emit('optimization-stats', stats);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    
    // Cleanup optimization services for this client
    // (This would need streamId mapping to implement properly)
    
    // Clean up any active streams/rooms
    for (const [streamId, stream] of activeStreams.entries()) {
      if (stream.socketId === socket.id) {
        stream.status = 'ended';
        stream.isLive = false;
        stream.endedAt = new Date().toISOString();
        activeStreams.set(streamId, stream);
        
        socket.to(`stream:${streamId}`).emit('stream-ended', {
          streamId,
          endedAt: stream.endedAt
        });
      }
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    redisClient.quit();
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Stream service running on port ${PORT}`);
});
