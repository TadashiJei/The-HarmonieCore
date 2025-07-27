const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

class StreamManager {
  constructor() {
    this.activeStreams = new Map();
    this.streamRooms = new Map();
    this.viewerSessions = new Map();
    this.qualityProfiles = new Map();
  }

  // Create a new stream
  createStream(artistId, streamData) {
    const streamId = uuidv4();
    const streamKey = uuidv4();
    
    const stream = {
      id: streamId,
      artistId,
      title: streamData.title || 'HarmonieCore Stream',
      description: streamData.description || '',
      category: streamData.category || 'general',
      streamKey,
      status: 'created',
      isLive: false,
      viewers: 0,
      maxViewers: 0,
      totalTips: 0,
      peakViewers: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      duration: 0,
      quality: 'auto',
      bitrate: 2500000,
      resolution: '1280x720',
      frameRate: 30,
      audioBitrate: 128000,
      chatMessages: [],
      tips: [],
      bannedUsers: new Set(),
      moderators: new Set(),
      settings: {
        allowChat: true,
        allowTips: true,
        allowRecording: false,
        maxViewers: 1000,
        qualityOptions: ['auto', '720p', '480p', '360p'],
        chatModeration: 'auto'
      }
    };

    this.activeStreams.set(streamId, stream);
    this.streamRooms.set(streamId, new Set());
    this.qualityProfiles.set(streamId, new Map());
    
    logger.info(`Stream created: ${streamId} by artist: ${artistId}`);
    return stream;
  }

  // Start a stream
  startStream(streamId, streamKey) {
    const stream = this.activeStreams.get(streamId);
    if (!stream || stream.streamKey !== streamKey) {
      throw new Error('Invalid stream credentials');
    }

    stream.status = 'live';
    stream.isLive = true;
    stream.startedAt = new Date().toISOString();
    
    logger.info(`Stream ${streamId} started`);
    return stream;
  }

  // End a stream
  endStream(streamId, streamKey) {
    const stream = this.activeStreams.get(streamId);
    if (!stream || stream.streamKey !== streamKey) {
      throw new Error('Invalid stream credentials');
    }

    stream.status = 'ended';
    stream.isLive = false;
    stream.endedAt = new Date().toISOString();
    stream.duration = Date.now() - new Date(stream.startedAt).getTime();
    
    logger.info(`Stream ${streamId} ended`);
    return stream;
  }

  // Add viewer to stream
  addViewer(streamId, userId, socketId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return false;

    if (stream.bannedUsers.has(userId)) {
      logger.warn(`Banned user ${userId} attempted to join stream ${streamId}`);
      return false;
    }

    if (stream.viewers >= stream.settings.maxViewers) {
      logger.warn(`Stream ${streamId} is at capacity`);
      return false;
    }

    stream.viewers += 1;
    stream.maxViewers = Math.max(stream.maxViewers, stream.viewers);
    
    if (!this.viewerSessions.has(streamId)) {
      this.viewerSessions.set(streamId, new Map());
    }
    
    this.viewerSessions.get(streamId).set(userId, {
      socketId,
      joinedAt: new Date().toISOString(),
      lastActivity: Date.now()
    });

    const room = this.streamRooms.get(streamId);
    if (room) {
      room.add(socketId);
    }

    logger.info(`User ${userId} joined stream ${streamId}`);
    return true;
  }

  // Remove viewer from stream
  removeViewer(streamId, userId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return false;

    stream.viewers = Math.max(0, stream.viewers - 1);
    
    if (this.viewerSessions.has(streamId)) {
      this.viewerSessions.get(streamId).delete(userId);
    }

    const room = this.streamRooms.get(streamId);
    if (room) {
      room.delete(userId);
    }

    logger.info(`User ${userId} left stream ${streamId}`);
    return true;
  }

  // Add tip to stream
  addTip(streamId, tipData) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return false;

    const tip = {
      id: uuidv4(),
      ...tipData,
      timestamp: new Date().toISOString()
    };

    stream.tips.push(tip);
    stream.totalTips += tip.amount;
    
    logger.info(`Tip of ${tip.amount} $CORE received for stream ${streamId}`);
    return tip;
  }

  // Add chat message
  addChatMessage(streamId, messageData) {
    const stream = this.activeStreams.get(streamId);
    if (!stream || !stream.settings.allowChat) return false;

    const message = {
      id: uuidv4(),
      ...messageData,
      timestamp: new Date().toISOString(),
      moderated: false
    };

    // Basic moderation
    if (this.isMessageInappropriate(message.message)) {
      message.moderated = true;
      message.message = '[Message moderated]';
    }

    stream.chatMessages.push(message);
    
    // Keep only last 100 messages
    if (stream.chatMessages.length > 100) {
      stream.chatMessages = stream.chatMessages.slice(-100);
    }

    return message;
  }

  // Ban user from stream
  banUser(streamId, userId, moderatorId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return false;

    if (!stream.moderators.has(moderatorId)) {
      logger.warn(`Non-moderator ${moderatorId} attempted to ban user ${userId}`);
      return false;
    }

    stream.bannedUsers.add(userId);
    
    // Remove banned user from stream
    this.removeViewer(streamId, userId);
    
    logger.info(`User ${userId} banned from stream ${streamId} by moderator ${moderatorId}`);
    return true;
  }

  // Get stream statistics
  getStreamStats(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return null;

    const viewerSessions = this.viewerSessions.get(streamId) || new Map();
    const activeViewers = Array.from(viewerSessions.entries()).map(([userId, session]) => ({
      userId,
      joinedAt: session.joinedAt,
      lastActivity: new Date(session.lastActivity).toISOString()
    }));

    return {
      ...stream,
      activeViewers,
      totalViewers: viewerSessions.size,
      averageTip: stream.tips.length > 0 ? stream.totalTips / stream.tips.length : 0,
      chatMessageCount: stream.chatMessages.length
    };
  }

  // Update stream quality
  updateStreamQuality(streamId, qualityData) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return false;

    Object.assign(stream, qualityData);
    logger.info(`Stream ${streamId} quality updated: ${JSON.stringify(qualityData)}`);
    return true;
  }

  // Get all active streams
  getActiveStreams() {
    return Array.from(this.activeStreams.values()).filter(stream => stream.isLive);
  }

  // Clean up inactive streams
  cleanupInactiveStreams(maxAge = 3600000) { // 1 hour
    const now = Date.now();
    let cleanedCount = 0;

    for (const [streamId, stream] of this.activeStreams.entries()) {
      if (!stream.isLive && stream.endedAt) {
        const endedTime = new Date(stream.endedAt).getTime();
        if (now - endedTime > maxAge) {
          this.activeStreams.delete(streamId);
          this.streamRooms.delete(streamId);
          this.viewerSessions.delete(streamId);
          this.qualityProfiles.delete(streamId);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} inactive streams`);
    }

    return cleanedCount;
  }

  // Basic message moderation
  isMessageInappropriate(message) {
    const inappropriateWords = [
      'spam', 'scam', 'fake', 'bot', 'hate', 'violence',
      // Add more inappropriate words as needed
    ];
    
    const lowerMessage = message.toLowerCase();
    return inappropriateWords.some(word => lowerMessage.includes(word));
  }

  // Health check
  getHealth() {
    return {
      activeStreams: this.activeStreams.size,
      streamRooms: this.streamRooms.size,
      viewerSessions: Array.from(this.viewerSessions.values()).reduce((total, sessions) => total + sessions.size, 0),
      uptime: process.uptime()
    };
  }
}

module.exports = StreamManager;
