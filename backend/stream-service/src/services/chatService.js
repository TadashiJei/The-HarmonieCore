/**
 * HarmonieCORE Chat System
 * Ultra-optimized real-time chat with mobile data efficiency
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class ChatService extends EventEmitter {
  constructor() {
    super();
    this.chatRooms = new Map();
    this.messageHistory = new Map();
    this.rateLimit = new Map();
    this.messageQueue = new Map();
    
    // Mobile-optimized settings
    this.settings = {
      maxMessageLength: 500,
      maxMessagesPerMinute: 10,
      maxHistorySize: 100,
      compressionEnabled: true,
      emojiCompression: true,
      typingIndicatorTimeout: 3000
    };
  }

  /**
   * Create chat room for stream
   */
  createChatRoom(streamId, streamData) {
    if (this.chatRooms.has(streamId)) {
      return this.chatRooms.get(streamId);
    }

    const room = {
      id: streamId,
      title: streamData.title,
      artistId: streamData.artistId,
      participants: new Map(),
      activeUsers: 0,
      mutedUsers: new Set(),
      slowMode: false,
      slowModeDelay: 5000,
      createdAt: new Date().toISOString(),
      settings: {
        allowTips: true,
        allowEmojis: true,
        allowLinks: true,
        maxMessageLength: this.settings.maxMessageLength
      }
    };

    this.chatRooms.set(streamId, room);
    this.messageHistory.set(streamId, []);
    this.messageQueue.set(streamId, []);

    logger.info(`ChatService: Created room for stream ${streamId}`);
    this.emit('room-created', { streamId, room });

    return room;
  }

  /**
   * Join chat room
   */
  async joinChat(streamId, userData, socket) {
    const room = this.chatRooms.get(streamId);
    if (!room) {
      throw new Error('Chat room not found');
    }

    const participant = {
      id: uuidv4(),
      userId: userData.userId,
      username: userData.username,
      avatar: userData.avatar || null,
      isArtist: userData.userId === room.artistId,
      isModerator: userData.isModerator || false,
      socket,
      joinedAt: new Date().toISOString(),
      lastMessageAt: null,
      messageCount: 0,
      deviceType: userData.deviceType || 'desktop'
    };

    room.participants.set(participant.id, participant);
    room.activeUsers++;

    // Send welcome message
    const welcomeMessage = this.createSystemMessage(
      streamId,
      `${participant.username} joined the chat`,
      'join'
    );

    // Send recent history (mobile-optimized)
    const recentMessages = this.getRecentMessages(streamId, 20);

    logger.info(`ChatService: User ${participant.username} joined room ${streamId}`);

    this.emit('user-joined', { streamId, participant, activeUsers: room.activeUsers });

    return {
      participant,
      welcomeMessage,
      recentMessages,
      roomSettings: room.settings
    };
  }

  /**
   * Send message with ultra-optimization
   */
  async sendMessage(streamId, participantId, messageData) {
    const room = this.chatRooms.get(streamId);
    const participant = room?.participants.get(participantId);
    
    if (!room || !participant) {
      throw new Error('Invalid room or participant');
    }

    // Rate limiting
    if (this.isRateLimited(participant.userId)) {
      throw new Error('Rate limit exceeded');
    }

    // Check if user is muted
    if (room.mutedUsers.has(participant.userId)) {
      throw new Error('You are muted');
    }

    // Check slow mode
    if (room.slowMode && participant.lastMessageAt) {
      const timeSinceLastMessage = Date.now() - new Date(participant.lastMessageAt).getTime();
      if (timeSinceLastMessage < room.slowModeDelay) {
        throw new Error(`Slow mode active. Wait ${Math.ceil((room.slowModeDelay - timeSinceLastMessage) / 1000)}s`);
      }
    }

    // Process and optimize message
    const optimizedMessage = await this.optimizeMessage(messageData.message);

    const message = {
      id: uuidv4(),
      streamId,
      participantId: participant.id,
      userId: participant.userId,
      username: participant.username,
      avatar: participant.avatar,
      isArtist: participant.isArtist,
      isModerator: participant.isModerator,
      message: optimizedMessage.text,
      originalMessage: messageData.message,
      type: 'chat',
      timestamp: new Date().toISOString(),
      metadata: {
        compressed: optimizedMessage.compressed,
        compressionRatio: optimizedMessage.compressionRatio,
        emojiCount: optimizedMessage.emojiCount,
        wordCount: optimizedMessage.wordCount,
        deviceType: participant.deviceType
      }
    };

    // Add to history
    const history = this.messageHistory.get(streamId);
    history.push(message);
    
    // Keep only recent messages
    if (history.length > this.settings.maxHistorySize) {
      history.shift();
    }

    // Update participant stats
    participant.lastMessageAt = new Date().toISOString();
    participant.messageCount++;

    // Update rate limiting
    this.updateRateLimit(participant.userId);

    logger.debug(`ChatService: Message sent in ${streamId}`, {
      user: participant.username,
      length: message.message.length,
      compressed: optimizedMessage.compressed
    });

    this.emit('message-sent', { streamId, message });

    return message;
  }

  /**
   * Optimize message for mobile data efficiency
   */
  async optimizeMessage(text) {
    const originalLength = text.length;
    let optimizedText = text;
    let emojiCount = 0;

    // Count emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    emojiCount = (text.match(emojiRegex) || []).length;

    // Compress emojis if enabled
    if (this.settings.emojiCompression && emojiCount > 0) {
      optimizedText = this.compressEmojis(optimizedText);
    }

    // Truncate if too long
    if (optimizedText.length > this.settings.maxMessageLength) {
      optimizedText = optimizedText.substring(0, this.settings.maxMessageLength - 3) + '...';
    }

    // Calculate compression
    const compressionRatio = optimizedText.length / originalLength;
    const compressed = optimizedText.length < originalLength;

    return {
      text: optimizedText,
      originalLength,
      compressedLength: optimizedText.length,
      compressionRatio,
      compressed,
      emojiCount,
      wordCount: optimizedText.split(/\s+/).length
    };
  }

  /**
   * Compress emojis to short codes
   */
  compressEmojis(text) {
    const emojiMap = {
      '😊': ':smile:',
      '😂': ':joy:',
      '❤️': ':heart:',
      '👍': ':thumbsup:',
      '🎨': ':art:',
      '🔥': ':fire:',
      '✨': ':sparkles:',
      '💯': ':100:',
      '🙌': ':raised_hands:',
      '👏': ':clap:'
    };

    let compressed = text;
    Object.entries(emojiMap).forEach(([emoji, code]) => {
      compressed = compressed.replace(new RegExp(emoji, 'g'), code);
    });

    return compressed;
  }

  /**
   * Send system message
   */
  createSystemMessage(streamId, message, type = 'system') {
    const systemMessage = {
      id: uuidv4(),
      streamId,
      type,
      message,
      timestamp: new Date().toISOString(),
      system: true
    };

    const history = this.messageHistory.get(streamId);
    if (history) {
      history.push(systemMessage);
    }

    this.emit('system-message', { streamId, message: systemMessage });
    return systemMessage;
  }

  /**
   * Send tip message
   */
  async sendTipMessage(streamId, participantId, tipData) {
    const room = this.chatRooms.get(streamId);
    const participant = room?.participants.get(participantId);
    
    if (!room || !participant) {
      throw new Error('Invalid room or participant');
    }

    const tipMessage = {
      id: uuidv4(),
      streamId,
      participantId: participant.id,
      userId: participant.userId,
      username: participant.username,
      type: 'tip',
      amount: tipData.amount,
      currency: tipData.currency || 'USD',
      message: tipData.message || '',
      timestamp: new Date().toISOString(),
      metadata: {
        formattedAmount: this.formatCurrency(tipData.amount, tipData.currency),
        deviceType: participant.deviceType
      }
    };

    // Add to history
    const history = this.messageHistory.get(streamId);
    history.push(tipMessage);

    logger.info(`ChatService: Tip received in ${streamId}`, {
      user: participant.username,
      amount: tipData.amount,
      currency: tipData.currency
    });

    this.emit('tip-received', { streamId, message: tipMessage });

    return tipMessage;
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(streamId, participantId, isTyping) {
    const room = this.chatRooms.get(streamId);
    const participant = room?.participants.get(participantId);
    
    if (!participant) return;

    const typingData = {
      participantId,
      username: participant.username,
      isTyping,
      timestamp: new Date().toISOString()
    };

    this.emit('typing-indicator', { streamId, typingData });
  }

  /**
   * Moderation features
   */
  async moderateUser(streamId, moderatorId, targetUserId, action, reason) {
    const room = this.chatRooms.get(streamId);
    if (!room) throw new Error('Room not found');

    const moderator = Array.from(room.participants.values())
      .find(p => p.userId === moderatorId && p.isModerator);
    
    if (!moderator) {
      throw new Error('Not authorized to moderate');
    }

    switch (action) {
      case 'mute':
        room.mutedUsers.add(targetUserId);
        break;
      case 'unmute':
        room.mutedUsers.delete(targetUserId);
        break;
      default:
        throw new Error('Invalid moderation action');
    }

    const moderationMessage = this.createSystemMessage(
      streamId,
      `${targetUserId} has been ${action}ed${reason ? ': ' + reason : ''}`,
      'moderation'
    );

    this.emit('user-moderated', { 
      streamId, 
      targetUserId, 
      action, 
      reason, 
      moderator: moderator.username 
    });

    return moderationMessage;
  }

  /**
   * Get recent messages (mobile-optimized)
   */
  getRecentMessages(streamId, limit = 20) {
    const history = this.messageHistory.get(streamId);
    if (!history) return [];

    // Return most recent messages
    return history.slice(-limit).map(msg => ({
      id: msg.id,
      username: msg.username,
      message: msg.message,
      type: msg.type,
      timestamp: msg.timestamp,
      isArtist: msg.isArtist,
      ...(msg.type === 'tip' && {
        amount: msg.amount,
        currency: msg.currency,
        formattedAmount: msg.metadata?.formattedAmount
      })
    }));
  }

  /**
   * Get chat room stats
   */
  getRoomStats(streamId) {
    const room = this.chatRooms.get(streamId);
    if (!room) return null;

    const history = this.messageHistory.get(streamId) || [];
    const messagesInLastHour = history.filter(
      msg => new Date(msg.timestamp) > new Date(Date.now() - 3600000)
    ).length;

    return {
      streamId,
      activeUsers: room.activeUsers,
      totalMessages: history.length,
      messagesInLastHour,
      mutedUsers: room.mutedUsers.size,
      slowMode: room.slowMode,
      settings: room.settings
    };
  }

  /**
   * Leave chat room
   */
  async leaveChat(streamId, participantId) {
    const room = this.chatRooms.get(streamId);
    if (!room) return;

    const participant = room.participants.get(participantId);
    if (participant) {
      room.participants.delete(participantId);
      room.activeUsers--;

      const leaveMessage = this.createSystemMessage(
        streamId,
        `${participant.username} left the chat`,
        'leave'
      );

      logger.info(`ChatService: User ${participant.username} left room ${streamId}`);

      this.emit('user-left', { 
        streamId, 
        participant, 
        activeUsers: room.activeUsers 
      });
    }
  }

  /**
   * Rate limiting helpers
   */
  isRateLimited(userId) {
    const userLimit = this.rateLimit.get(userId);
    if (!userLimit) return false;

    const now = Date.now();
    const resetTime = userLimit.resetTime;

    if (now > resetTime) {
      this.rateLimit.delete(userId);
      return false;
    }

    return userLimit.count >= this.settings.maxMessagesPerMinute;
  }

  updateRateLimit(userId) {
    const now = Date.now();
    const resetTime = Math.ceil(now / 60000) * 60000; // Next minute

    if (!this.rateLimit.has(userId)) {
      this.rateLimit.set(userId, { count: 1, resetTime });
    } else {
      const userLimit = this.rateLimit.get(userId);
      if (now > userLimit.resetTime) {
        userLimit.count = 1;
        userLimit.resetTime = resetTime;
      } else {
        userLimit.count++;
      }
    }
  }

  /**
   * Format currency for tips
   */
  formatCurrency(amount, currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Cleanup chat room
   */
  async cleanupRoom(streamId) {
    this.chatRooms.delete(streamId);
    this.messageHistory.delete(streamId);
    this.messageQueue.delete(streamId);
    
    // Clear rate limits for this stream
    this.rateLimit.clear();
    
    logger.info(`ChatService: Cleaned up room ${streamId}`);
  }
}

module.exports = ChatService;
