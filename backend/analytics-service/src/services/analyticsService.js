/**
 * HarmonieCORE Analytics Service
 * Ultra-optimized analytics system for Web3 artist platform
 * Features: Real-time streaming analytics, user behavior tracking, revenue analytics
 * Mobile-optimized with efficient data collection and storage
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const _ = require('lodash');
const logger = require('../utils/logger');

class AnalyticsService extends EventEmitter {
  constructor() {
    super();
    
    // Mobile-optimized settings
    this.settings = {
      maxEventsPerUser: 1000,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      retentionDays: 90,
      mobileDataThreshold: 1024, // 1KB per event max
      samplingRate: 0.1, // 10% sampling for performance
      cacheTTL: 300, // 5 minutes
      compressionEnabled: true
    };

    // Data structures
    this.eventBuffer = [];
    this.userSessions = new Map();
    this.realtimeMetrics = new Map();
    this.aggregatedData = new Map();
    
    // Analytics categories
    this.categories = {
      USER: 'user',
      STREAMING: 'streaming',
      CONTENT: 'content',
      REVENUE: 'revenue',
      ENGAGEMENT: 'engagement',
      PERFORMANCE: 'performance'
    };

    this.initializeServices();
    this.startDataProcessor();
  }

  /**
   * Initialize analytics services
   */
  initializeServices() {
    this.setupRealtimeMetrics();
    this.startCleanupScheduler();
    this.initializeAggregations();
  }

  /**
   * Track user event with mobile optimization
   */
  async trackEvent(userId, eventType, eventData = {}) {
    try {
      // Mobile data optimization
      const optimizedData = this.optimizeEventData(eventData);
      
      const event = {
        id: uuidv4(),
        userId,
        type: eventType,
        category: this.categorizeEvent(eventType),
        data: optimizedData,
        timestamp: new Date().toISOString(),
        sessionId: this.getSessionId(userId),
        device: this.detectDeviceType(eventData),
        network: this.detectNetworkType(eventData),
        mobileOptimized: true,
        compressed: this.settings.compressionEnabled
      };

      // Sampling for performance
      if (this.shouldSampleEvent(event)) {
        this.eventBuffer.push(event);
        this.updateRealtimeMetrics(event);
        this.updateUserSession(userId, event);
        
        this.emit('event-tracked', event);
      }

      logger.debug(`AnalyticsService: Tracked event ${eventType} for ${userId}`);
      return event.id;
    } catch (error) {
      logger.error(`AnalyticsService: Error tracking event`, error);
      throw error;
    }
  }

  /**
   * Track streaming analytics with ultra-low data usage
   */
  async trackStreamingEvent(userId, streamId, eventType, data = {}) {
    const streamingData = {
      streamId,
      bitrate: data.bitrate || 0,
      duration: data.duration || 0,
      quality: data.quality || 'auto',
      bufferEvents: data.bufferEvents || 0,
      droppedFrames: data.droppedFrames || 0,
      networkType: data.networkType || 'unknown',
      mobileData: data.mobileData || false,
      batteryLevel: data.batteryLevel || 100
    };

    return await this.trackEvent(userId, `streaming_${eventType}`, streamingData);
  }

  /**
   * Track revenue events with Web3 integration
   */
  async trackRevenueEvent(userId, eventType, revenueData) {
    const revenueEvent = {
      amount: revenueData.amount || 0,
      currency: revenueData.currency || 'USD',
      type: revenueData.type || 'tip',
      artistId: revenueData.artistId,
      transactionHash: revenueData.transactionHash,
      blockchain: revenueData.blockchain || 'ethereum',
      gasUsed: revenueData.gasUsed || 0,
      networkFee: revenueData.networkFee || 0,
      platformFee: revenueData.platformFee || 0,
      artistEarnings: revenueData.artistEarnings || 0
    };

    return await this.trackEvent(userId, `revenue_${eventType}`, revenueEvent);
  }

  /**
   * Track user engagement metrics
   */
  async trackEngagement(userId, action, engagementData) {
    const engagementEvent = {
      action,
      targetId: engagementData.targetId,
      targetType: engagementData.targetType,
      value: engagementData.value || 1,
      context: engagementData.context || {},
      timeSpent: engagementData.timeSpent || 0,
      scrollDepth: engagementData.scrollDepth || 0,
      interactions: engagementData.interactions || 0
    };

    return await this.trackEvent(userId, 'engagement', engagementEvent);
  }

  /**
   * Get real-time analytics dashboard data
   */
  async getRealtimeDashboard() {
    const now = moment();
    const last24h = now.clone().subtract(24, 'hours');

    return {
      activeUsers: this.getActiveUsersCount(),
      activeStreams: this.getActiveStreamsCount(),
      totalRevenue: this.getTotalRevenue(last24h, now),
      popularContent: this.getPopularContent(last24h, now),
      performanceMetrics: this.getPerformanceMetrics(),
      mobileStats: this.getMobileStats(),
      timestamp: now.toISOString()
    };
  }

  /**
   * Get user analytics for artist dashboard
   */
  async getArtistAnalytics(artistId, timeRange = '7d') {
    const range = this.parseTimeRange(timeRange);
    const events = this.getEventsForArtist(artistId, range);

    return {
      overview: {
        totalViews: this.calculateTotalViews(events),
        totalRevenue: this.calculateTotalRevenue(events),
        uniqueListeners: this.calculateUniqueListeners(events),
        averageSessionDuration: this.calculateAverageSession(events),
        engagementRate: this.calculateEngagementRate(events)
      },
      streaming: {
        totalStreamTime: this.calculateTotalStreamTime(events),
        peakConcurrent: this.calculatePeakConcurrent(events),
        qualityDistribution: this.calculateQualityDistribution(events),
        mobilePercentage: this.calculateMobilePercentage(events),
        bufferRatio: this.calculateBufferRatio(events)
      },
      revenue: {
        tips: this.calculateTips(events),
        subscriptions: this.calculateSubscriptions(events),
        nftSales: this.calculateNFTSales(events),
        platformFees: this.calculatePlatformFees(events),
        blockchainBreakdown: this.calculateBlockchainBreakdown(events)
      },
      audience: {
        demographics: this.calculateDemographics(events),
        geographic: this.calculateGeographic(events),
        deviceTypes: this.calculateDeviceTypes(events),
        listeningPatterns: this.calculateListeningPatterns(events)
      },
      content: {
        topTracks: this.getTopTracks(events),
        topAlbums: this.getTopAlbums(events),
        engagementByContent: this.getEngagementByContent(events)
      }
    };
  }

  /**
   * Get user behavior analytics
   */
  async getUserBehaviorAnalytics(userId, timeRange = '30d') {
    const range = this.parseTimeRange(timeRange);
    const events = this.getUserEvents(userId, range);

    return {
      profile: {
        totalListeningTime: this.calculateListeningTime(events),
        favoriteArtists: this.getFavoriteArtists(events),
        favoriteGenres: this.getFavoriteGenres(events),
        peakUsageTime: this.getPeakUsageTime(events),
        devicePreference: this.getDevicePreference(events)
      },
      engagement: {
        interactionRate: this.calculateInteractionRate(events),
        sharingBehavior: this.getSharingBehavior(events),
        tippingBehavior: this.getTippingBehavior(events),
        playlistCreation: this.getPlaylistCreation(events)
      },
      streaming: {
        qualityPreference: this.getQualityPreference(events),
        networkPreference: this.getNetworkPreference(events),
        sessionPatterns: this.getSessionPatterns(events),
        skipRate: this.calculateSkipRate(events)
      },
      revenue: {
        totalSpent: this.calculateTotalSpent(events),
        spendingPattern: this.getSpendingPattern(events),
        preferredPayment: this.getPreferredPayment(events)
      }
    };
  }

  /**
   * Get performance analytics for optimization
   */
  async getPerformanceAnalytics() {
    const events = this.getRecentEvents();

    return {
      system: {
        averageResponseTime: this.calculateAverageResponseTime(events),
        errorRate: this.calculateErrorRate(events),
        throughput: this.calculateThroughput(events),
        resourceUsage: this.calculateResourceUsage(events)
      },
      mobile: {
        dataUsage: this.calculateMobileDataUsage(events),
        batteryImpact: this.calculateBatteryImpact(events),
        networkEfficiency: this.calculateNetworkEfficiency(events),
        crashRate: this.calculateCrashRate(events)
      },
      streaming: {
        bufferRatio: this.calculateBufferRatio(events),
        qualityAdaptation: this.calculateQualityAdaptation(events),
        connectionStability: this.calculateConnectionStability(events),
        loadTime: this.calculateLoadTime(events)
      }
    };
  }

  /**
   * Generate custom analytics reports
   */
  async generateReport(reportConfig) {
    const {
      metrics,
      filters,
      timeRange,
      groupBy,
      aggregation
    } = reportConfig;

    const range = this.parseTimeRange(timeRange);
    const filteredEvents = this.filterEvents(filters, range);
    const aggregated = this.aggregateEvents(filteredEvents, groupBy, aggregation);

    return {
      reportId: uuidv4(),
      generatedAt: new Date().toISOString(),
      config: reportConfig,
      data: aggregated,
      summary: this.generateSummary(aggregated),
      exportFormats: ['json', 'csv', 'pdf'],
      mobileOptimized: true
    };
  }

  /**
   * Real-time event processing
   */
  startDataProcessor() {
    setInterval(() => {
      if (this.eventBuffer.length === 0) return;

      const batch = this.eventBuffer.splice(0, this.settings.batchSize);
      this.processBatch(batch);
    }, this.settings.flushInterval);
  }

  /**
   * Process batch of events
   */
  processBatch(events) {
    try {
      // Aggregate events
      const aggregated = this.aggregateEvents(events);
      
      // Update real-time metrics
      this.updateAggregatedMetrics(aggregated);
      
      // Store in memory (in production, use database)
      this.storeAggregatedData(aggregated);
      
      // Emit real-time updates
      this.emit('analytics-updated', {
        batchSize: events.length,
        aggregatedMetrics: aggregated,
        timestamp: new Date().toISOString()
      });

      logger.debug(`AnalyticsService: Processed ${events.length} events`);
    } catch (error) {
      logger.error('AnalyticsService: Error processing batch', error);
    }
  }

  /**
   * Mobile data optimization methods
   */
  optimizeEventData(data) {
    // Remove unnecessary fields for mobile
    const optimized = {};
    
    // Only keep essential fields
    const essentialFields = [
      'id', 'type', 'value', 'duration', 'quality', 'network', 'battery'
    ];
    
    essentialFields.forEach(field => {
      if (data[field] !== undefined) {
        optimized[field] = data[field];
      }
    });

    // Compress large strings
    if (data.metadata) {
      optimized.m = this.compressMetadata(data.metadata);
    }

    return optimized;
  }

  compressMetadata(metadata) {
    // Simple compression for mobile data
    return JSON.stringify(metadata).length > 200 
      ? JSON.stringify(metadata).substring(0, 197) + '...'
      : metadata;
  }

  shouldSampleEvent(event) {
    // Sample events to reduce data usage on mobile
    if (event.device === 'mobile' && !event.data.mobileData) {
      return Math.random() < this.settings.samplingRate;
    }
    return true;
  }

  /**
   * Utility methods for analytics calculations
   */
  categorizeEvent(eventType) {
    const categoryMap = {
      'user_login': this.categories.USER,
      'user_logout': this.categories.USER,
      'streaming_start': this.categories.STREAMING,
      'streaming_end': this.categories.STREAMING,
      'content_view': this.categories.CONTENT,
      'content_like': this.categories.CONTENT,
      'revenue_tip': this.categories.REVENUE,
      'revenue_subscription': this.categories.REVENUE,
      'engagement_share': this.categories.ENGAGEMENT,
      'performance_error': this.categories.PERFORMANCE
    };
    return categoryMap[eventType] || this.categories.ENGAGEMENT;
  }

  detectDeviceType(data) {
    return data.userAgent ? (data.userAgent.includes('Mobile') ? 'mobile' : 'desktop') : 'unknown';
  }

  detectNetworkType(data) {
    return data.networkType || (data.connection ? 'wifi' : 'cellular');
  }

  getSessionId(userId) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, uuidv4());
    }
    return this.userSessions.get(userId);
  }

  parseTimeRange(timeRange) {
    const now = moment();
    const ranges = {
      '1h': now.clone().subtract(1, 'hour'),
      '24h': now.clone().subtract(24, 'hours'),
      '7d': now.clone().subtract(7, 'days'),
      '30d': now.clone().subtract(30, 'days'),
      '90d': now.clone().subtract(90, 'days')
    };
    return { start: ranges[timeRange] || ranges['7d'], end: now };
  }

  /**
   * Aggregation and calculation methods
   */
  calculateTotalViews(events) {
    return events.filter(e => e.type === 'content_view').length;
  }

  calculateTotalRevenue(events) {
    return events
      .filter(e => e.category === this.categories.REVENUE)
      .reduce((sum, e) => sum + (e.data.amount || 0), 0);
  }

  calculateUniqueListeners(events) {
    return new Set(events.map(e => e.userId)).size;
  }

  calculateAverageSession(events) {
    const sessions = _.groupBy(events, 'sessionId');
    const durations = Object.values(sessions).map(session => {
      const start = moment(_.minBy(session, 'timestamp').timestamp);
      const end = moment(_.maxBy(session, 'timestamp').timestamp);
      return end.diff(start, 'seconds');
    });
    return durations.length > 0 ? _.mean(durations) : 0;
  }

  /**
   * Cleanup and maintenance
   */
  startCleanupScheduler() {
    // Clean old data daily
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  cleanupOldData() {
    const cutoff = moment().subtract(this.settings.retentionDays, 'days');
    
    // Clean event buffer
    this.eventBuffer = this.eventBuffer.filter(
      event => moment(event.timestamp).isAfter(cutoff)
    );
    
    // Clean aggregated data
    for (const [key, data] of this.aggregatedData.entries()) {
      if (moment(data.timestamp).isBefore(cutoff)) {
        this.aggregatedData.delete(key);
      }
    }

    logger.info(`AnalyticsService: Cleaned up data older than ${this.settings.retentionDays} days`);
  }

  /**
   * Real-time metrics setup
   */
  setupRealtimeMetrics() {
    this.realtimeMetrics.set('activeUsers', new Set());
    this.realtimeMetrics.set('activeStreams', new Set());
    this.realtimeMetrics.set('totalRevenue', 0);
    this.realtimeMetrics.set('eventsPerMinute', 0);
  }

  updateRealtimeMetrics(event) {
    this.realtimeMetrics.get('activeUsers').add(event.userId);
    
    if (event.type === 'streaming_start') {
      this.realtimeMetrics.get('activeStreams').add(event.data.streamId);
    }
    
    if (event.category === this.categories.REVENUE) {
      this.realtimeMetrics.set('totalRevenue', 
        this.realtimeMetrics.get('totalRevenue') + (event.data.amount || 0)
      );
    }
  }

  getActiveUsersCount() {
    return this.realtimeMetrics.get('activeUsers').size;
  }

  getActiveStreamsCount() {
    return this.realtimeMetrics.get('activeStreams').size;
  }

  getTotalRevenue(start, end) {
    return this.realtimeMetrics.get('totalRevenue');
  }
}

module.exports = AnalyticsService;
