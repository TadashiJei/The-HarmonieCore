/**
 * HarmonieCORE Live Streaming Service
 * Ultra-optimized for mobile with real-time features
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const redis = require('redis');
const StreamOptimizer = require('../utils/streamOptimizer');
const AdaptiveBitrateController = require('../utils/adaptiveBitrateController');

class LiveStreamService extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map();
    this.viewers = new Map();
    this.chatMessages = new Map();
    this.redis = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.streamOptimizer = new StreamOptimizer();
    this.adaptiveBitrate = new AdaptiveBitrateController();
    
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      await this.redis.connect();
      logger.info('LiveStreamService: Redis connected');
    } catch (error) {
      logger.error('LiveStreamService: Redis connection failed', error);
    }
  }

  /**
   * Create a new live stream with ultra-optimization
   */
  async createStream(streamData) {
    const streamId = uuidv4();
    const streamKey = uuidv4();
    
    const stream = {
      id: streamId,
      streamKey,
      artistId: streamData.artistId,
      title: streamData.title,
      description: streamData.description,
      category: streamData.category,
      status: 'created',
      viewers: 0,
      totalTips: 0,
      chatMessages: [],
      recordingEnabled: streamData.recordingEnabled || false,
      recordingUrl: null,
      startTime: null,
      endTime: null,
      optimization: {
        deviceType: streamData.deviceType || 'desktop',
        connectionType: streamData.connectionType || 'wifi',
        currentQuality: 'ultraLow',
        adaptiveBitrate: true,
        compressionEnabled: true
      },
      metadata: {
        createdAt: new Date().toISOString(),
        tags: streamData.tags || [],
        thumbnail: streamData.thumbnail || null
      }
    };

    this.streams.set(streamId, stream);
    this.chatMessages.set(streamId, []);
    
    // Store in Redis for persistence
    await this.redis.set(`stream:${streamId}`, JSON.stringify(stream));
    
    logger.info(`LiveStreamService: Created stream ${streamId}`, {
      artistId: streamData.artistId,
      optimization: stream.optimization
    });

    this.emit('stream-created', stream);
    return stream;
  }

  /**
   * Start live streaming with optimization
   */
  async startStream(streamId, streamKey, socket, optimization = {}) {
    const stream = this.streams.get(streamId);
    if (!stream || stream.streamKey !== streamKey) {
      throw new Error('Invalid stream or stream key');
    }

    stream.status = 'live';
    stream.startTime = new Date().toISOString();
    stream.optimization = { ...stream.optimization, ...optimization };
    
    // Initialize adaptive bitrate for this stream
    this.adaptiveBitrate.initializeStream(streamId, {
      initialQuality: stream.optimization.currentQuality,
      deviceType: stream.optimization.deviceType,
      connectionType: stream.optimization.connectionType
    });

    // Initialize stream optimizer
    this.streamOptimizer.initializeStream(streamId, {
      compressionLevel: stream.optimation?.compressionEnabled ? 9 : 0,
      deviceType: stream.optimization.deviceType
    });

    // Store socket reference for the streamer
    stream.streamerSocket = socket;
    
    await this.redis.set(`stream:${streamId}`, JSON.stringify(stream));
    
    logger.info(`LiveStreamService: Started stream ${streamId}`, {
      optimization: stream.optimization
    });

    this.emit('stream-started', stream);
    return stream;
  }

  /**
   * Join a live stream as viewer
   */
  async joinStream(streamId, userData, socket) {
    const stream = this.streams.get(streamId);
    if (!stream || stream.status !== 'live') {
      throw new Error('Stream not found or not live');
    }

    const viewerId = uuidv4();
    const viewer = {
      id: viewerId,
      userId: userData.userId,
      username: userData.username,
      socket,
      joinedAt: new Date().toISOString(),
      deviceType: userData.deviceType || 'desktop',
      connectionType: userData.connectionType || 'wifi'
    };

    // Track viewer
    if (!this.viewers.has(streamId)) {
      this.viewers.set(streamId, new Map());
    }
    this.viewers.get(streamId).set(viewerId, viewer);

    // Update viewer count
    stream.viewers = this.viewers.get(streamId).size;
    await this.redis.set(`stream:${streamId}`, JSON.stringify(stream));

    // Send optimized configuration to viewer
    const optimizedConfig = await this.getOptimizedConfig(streamId, viewer);
    
    logger.info(`LiveStreamService: Viewer ${viewerId} joined stream ${streamId}`, {
      totalViewers: stream.viewers,
      deviceType: viewer.deviceType
    });

    this.emit('viewer-joined', { streamId, viewer, totalViewers: stream.viewers });
    
    return {
      stream,
      viewerId,
      optimizedConfig,
      chatHistory: this.chatMessages.get(streamId) || []
    };
  }

  /**
   * Leave a live stream
   */
  async leaveStream(streamId, viewerId) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    const viewers = this.viewers.get(streamId);
    if (viewers && viewers.has(viewerId)) {
      viewers.delete(viewerId);
      stream.viewers = viewers.size;
      
      await this.redis.set(`stream:${streamId}`, JSON.stringify(stream));
      
      logger.info(`LiveStreamService: Viewer ${viewerId} left stream ${streamId}`, {
        remainingViewers: stream.viewers
      });

      this.emit('viewer-left', { streamId, viewerId, totalViewers: stream.viewers });
    }
  }

  /**
   * End live stream
   */
  async endStream(streamId, streamKey) {
    const stream = this.streams.get(streamId);
    if (!stream || stream.streamKey !== streamKey) {
      throw new Error('Invalid stream or stream key');
    }

    stream.status = 'ended';
    stream.endTime = new Date().toISOString();
    
    // Clean up viewers
    const viewers = this.viewers.get(streamId);
    if (viewers) {
      viewers.forEach(viewer => {
        if (viewer.socket && viewer.socket.connected) {
          viewer.socket.emit('stream-ended', { streamId });
        }
      });
      viewers.clear();
    }

    // Clean up optimization services
    this.adaptiveBitrate.cleanupStream(streamId);
    this.streamOptimizer.cleanupStream(streamId);

    await this.redis.set(`stream:${streamId}`, JSON.stringify(stream));
    await this.redis.expire(`stream:${streamId}`, 3600); // 1 hour TTL

    logger.info(`LiveStreamService: Ended stream ${streamId}`, {
      duration: new Date(stream.endTime) - new Date(stream.startTime),
      totalViewers: stream.viewers,
      totalTips: stream.totalTips
    });

    this.emit('stream-ended', stream);
    return stream;
  }

  /**
   * Get optimized configuration for viewer
   */
  async getOptimizedConfig(streamId, viewer) {
    const stream = this.streams.get(streamId);
    if (!stream) return null;

    const config = await this.adaptiveBitrate.getOptimizedConfig(streamId, {
      deviceType: viewer.deviceType,
      connectionType: viewer.connectionType
    });

    return {
      ...config,
      streamId,
      streamKey: stream.streamKey,
      optimization: stream.optimization
    };
  }

  /**
   * Update stream optimization based on network metrics
   */
  async updateStreamOptimization(streamId, metrics) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    const recommendation = await this.adaptiveBitrate.updateNetworkMetrics(
      streamId, 
      metrics
    );

    if (recommendation.qualityChanged) {
      stream.optimization.currentQuality = recommendation.newQuality;
      await this.redis.set(`stream:${streamId}`, JSON.stringify(stream));

      // Notify all viewers
      const viewers = this.viewers.get(streamId);
      if (viewers) {
        viewers.forEach(viewer => {
          if (viewer.socket && viewer.socket.connected) {
            viewer.socket.emit('quality-update', {
              streamId,
              quality: recommendation.newQuality,
              reason: recommendation.reason
            });
          }
        });
      }

      this.emit('quality-updated', { streamId, ...recommendation });
    }

    return recommendation;
  }

  /**
   * Get stream information
   */
  async getStream(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      // Try to get from Redis
      const streamData = await this.redis.get(`stream:${streamId}`);
      if (streamData) {
        return JSON.parse(streamData);
      }
      return null;
    }
    return stream;
  }

  /**
   * Get all active streams
   */
  async getActiveStreams() {
    const activeStreams = [];
    
    for (const [streamId, stream] of this.streams) {
      if (stream.status === 'live') {
        activeStreams.push(stream);
      }
    }

    return activeStreams;
  }

  /**
   * Get stream statistics
   */
  async getStreamStats(streamId) {
    const stream = await this.getStream(streamId);
    if (!stream) return null;

    const duration = stream.endTime 
      ? new Date(stream.endTime) - new Date(stream.startTime)
      : Date.now() - new Date(stream.startTime);

    return {
      ...stream,
      duration: Math.floor(duration / 1000), // seconds
      averageViewers: stream.viewers,
      dataUsage: await this.adaptiveBitrate.getDataUsage(streamId),
      optimization: await this.adaptiveBitrate.getOptimizationStats(streamId)
    };
  }
}

module.exports = LiveStreamService;
