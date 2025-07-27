/**
 * Analytics Service Test Suite
 * Comprehensive testing for mobile-optimized analytics
 */

const AnalyticsService = require('../src/services/analyticsService');
const logger = require('../src/utils/logger');

describe('AnalyticsService', () => {
  let analyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (analyticsService) {
      analyticsService.removeAllListeners();
    }
  });

  describe('Event Tracking', () => {
    test('should track basic event', async () => {
      const eventId = await analyticsService.trackEvent('user123', 'streaming_start', {
        streamId: 'stream456',
        quality: 'low'
      });

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
    });

    test('should track streaming event with mobile optimization', async () => {
      const eventId = await analyticsService.trackStreamingEvent(
        'user123',
        'stream456',
        'start',
        {
          bitrate: 300,
          duration: 3600,
          mobileData: true,
          batteryLevel: 85
        }
      );

      expect(eventId).toBeDefined();
    });

    test('should track revenue event with Web3 data', async () => {
      const eventId = await analyticsService.trackRevenueEvent('user123', 'tip', {
        amount: 5.0,
        currency: 'USD',
        artistId: 'artist789',
        transactionHash: '0x1234567890abcdef',
        blockchain: 'ethereum'
      });

      expect(eventId).toBeDefined();
    });

    test('should track engagement event', async () => {
      const eventId = await analyticsService.trackEngagement('user123', 'like', {
        targetId: 'content123',
        targetType: 'track',
        timeSpent: 180
      });

      expect(eventId).toBeDefined();
    });

    test('should optimize event data for mobile', async () => {
      const largeData = {
        metadata: {
          very: 'large',
          nested: {
            object: {
              with: 'lots',
              of: 'data',
              that: 'should',
              be: 'compressed'
            }
          }
        }
      };

      const eventId = await analyticsService.trackEvent('user123', 'test', largeData);
      
      expect(eventId).toBeDefined();
    });
  });

  describe('Mobile Optimization', () => {
    test('should apply sampling for mobile devices', async () => {
      const events = [];
      
      // Track 100 events from mobile device
      for (let i = 0; i < 100; i++) {
        const eventId = await analyticsService.trackEvent('user123', 'mobile_test', {
          device: 'mobile',
          mobileData: true
        });
        if (eventId) events.push(eventId);
      }

      // Should apply sampling (around 5-10 events based on sampling rate)
      expect(events.length).toBeLessThan(100);
    });

    test('should compress large metadata', () => {
      const largeMetadata = {
        very: 'large',
        nested: {
          object: {
            with: 'lots',
            of: 'data',
            that: 'should',
            be: 'compressed',
            because: 'it is too large for mobile'
          }
        }
      };

      const compressed = analyticsService.compressMetadata(largeMetadata);
      expect(compressed.length).toBeLessThan(JSON.stringify(largeMetadata).length);
    });

    test('should detect mobile device type', () => {
      const mobileData = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' };
      const desktopData = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };

      expect(analyticsService.detectDeviceType(mobileData)).toBe('mobile');
      expect(analyticsService.detectDeviceType(desktopData)).toBe('desktop');
    });
  });

  describe('Analytics Calculations', () => {
    beforeEach(async () => {
      // Add test events
      await analyticsService.trackEvent('user1', 'content_view', { contentId: 'track1' });
      await analyticsService.trackEvent('user2', 'content_view', { contentId: 'track1' });
      await analyticsService.trackEvent('user1', 'revenue_tip', { amount: 5.0, artistId: 'artist1' });
      await analyticsService.trackEvent('user3', 'revenue_tip', { amount: 3.0, artistId: 'artist1' });
    });

    test('should calculate total views correctly', () => {
      const events = [
        { type: 'content_view', data: {} },
        { type: 'content_view', data: {} },
        { type: 'streaming_start', data: {} }
      ];

      const totalViews = analyticsService.calculateTotalViews(events);
      expect(totalViews).toBe(2);
    });

    test('should calculate total revenue correctly', () => {
      const events = [
        { category: 'revenue', data: { amount: 5.0 } },
        { category: 'revenue', data: { amount: 3.0 } },
        { category: 'streaming', data: {} }
      ];

      const totalRevenue = analyticsService.calculateTotalRevenue(events);
      expect(totalRevenue).toBe(8.0);
    });

    test('should calculate unique listeners correctly', () => {
      const events = [
        { userId: 'user1' },
        { userId: 'user2' },
        { userId: 'user1' },
        { userId: 'user3' }
      ];

      const uniqueListeners = analyticsService.calculateUniqueListeners(events);
      expect(uniqueListeners).toBe(3);
    });
  });

  describe('Time Range Parsing', () => {
    test('should parse 1 hour range', () => {
      const range = analyticsService.parseTimeRange('1h');
      expect(range.start.isBefore(range.end)).toBe(true);
      expect(range.end.diff(range.start, 'hours')).toBe(1);
    });

    test('should parse 7 days range', () => {
      const range = analyticsService.parseTimeRange('7d');
      expect(range.start.isBefore(range.end)).toBe(true);
      expect(range.end.diff(range.start, 'days')).toBe(7);
    });

    test('should default to 7 days for invalid range', () => {
      const range = analyticsService.parseTimeRange('invalid');
      expect(range.end.diff(range.start, 'days')).toBe(7);
    });
  });

  describe('Dashboard Data', () => {
    test('should generate realtime dashboard data', async () => {
      const dashboard = await analyticsService.getRealtimeDashboard();
      
      expect(dashboard).toHaveProperty('activeUsers');
      expect(dashboard).toHaveProperty('activeStreams');
      expect(dashboard).toHaveProperty('totalRevenue');
      expect(dashboard).toHaveProperty('popularContent');
      expect(dashboard).toHaveProperty('performanceMetrics');
      expect(dashboard).toHaveProperty('mobileStats');
    });
  });

  describe('Artist Analytics', () => {
    beforeEach(async () => {
      // Add artist-specific events
      await analyticsService.trackEvent('user1', 'content_view', { 
        contentId: 'track1', 
        artistId: 'artist123' 
      });
      await analyticsService.trackStreamingEvent('user1', 'stream1', 'start', {
        artistId: 'artist123',
        duration: 300,
        quality: 'high'
      });
      await analyticsService.trackRevenueEvent('user1', 'tip', {
        amount: 5.0,
        artistId: 'artist123'
      });
    });

    test('should generate artist analytics', async () => {
      const analytics = await analyticsService.getArtistAnalytics('artist123', '7d');
      
      expect(analytics).toHaveProperty('overview');
      expect(analytics).toHaveProperty('streaming');
      expect(analytics).toHaveProperty('revenue');
      expect(analytics).toHaveProperty('audience');
      expect(analytics).toHaveProperty('content');
    });
  });

  describe('User Behavior Analytics', () => {
    beforeEach(async () => {
      // Add user-specific events
      await analyticsService.trackEvent('user123', 'content_view', { 
        contentId: 'track1',
        genre: 'electronic'
      });
      await analyticsService.trackEngagement('user123', 'like', {
        targetId: 'track1',
        targetType: 'track'
      });
    });

    test('should generate user behavior analytics', async () => {
      const analytics = await analyticsService.getUserBehaviorAnalytics('user123', '30d');
      
      expect(analytics).toHaveProperty('profile');
      expect(analytics).toHaveProperty('engagement');
      expect(analytics).toHaveProperty('streaming');
      expect(analytics).toHaveProperty('revenue');
    });
  });

  describe('Performance Analytics', () => {
    test('should generate performance analytics', async () => {
      const analytics = await analyticsService.getPerformanceAnalytics();
      
      expect(analytics).toHaveProperty('system');
      expect(analytics).toHaveProperty('mobile');
      expect(analytics).toHaveProperty('streaming');
    });
  });

  describe('Custom Reports', () => {
    test('should generate custom report', async () => {
      const reportConfig = {
        metrics: ['views', 'revenue'],
        timeRange: '7d',
        groupBy: 'artistId',
        aggregation: 'sum'
      };

      const report = await analyticsService.generateReport(reportConfig);
      
      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('config');
      expect(report).toHaveProperty('data');
      expect(report).toHaveProperty('summary');
      expect(report.mobileOptimized).toBe(true);
    });
  });

  describe('Event Categorization', () => {
    test('should categorize events correctly', () => {
      expect(analyticsService.categorizeEvent('user_login')).toBe('user');
      expect(analyticsService.categorizeEvent('streaming_start')).toBe('streaming');
      expect(analyticsService.categorizeEvent('content_view')).toBe('content');
      expect(analyticsService.categorizeEvent('revenue_tip')).toBe('revenue');
      expect(analyticsService.categorizeEvent('engagement_like')).toBe('engagement');
    });
  });

  describe('Data Cleanup', () => {
    test('should cleanup old data', () => {
      // Add old event
      const oldEvent = {
        id: 'old-event',
        timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      analyticsService.eventBuffer.push(oldEvent);
      
      // Mock retention days to 30
      analyticsService.settings.retentionDays = 30;
      
      analyticsService.cleanupOldData();
      
      expect(analyticsService.eventBuffer).not.toContain(oldEvent);
    });
  });

  describe('Real-time Metrics', () => {
    test('should update realtime metrics', async () => {
      await analyticsService.trackEvent('user1', 'streaming_start', {
        streamId: 'stream1'
      });

      expect(analyticsService.getActiveUsersCount()).toBeGreaterThan(0);
    });

    test('should track active streams', async () => {
      await analyticsService.trackEvent('user1', 'streaming_start', {
        streamId: 'stream1'
      });

      expect(analyticsService.getActiveStreamsCount()).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing required fields gracefully', async () => {
      await expect(
        analyticsService.trackEvent(null, 'test')
      ).rejects.toThrow();
    });

    test('should handle invalid event data', async () => {
      const eventId = await analyticsService.trackEvent('user123', 'test', null);
      expect(eventId).toBeDefined();
    });
  });

  describe('Batch Processing', () => {
    test('should process events in batches', async () => {
      // Add multiple events
      for (let i = 0; i < 100; i++) {
        await analyticsService.trackEvent(`user${i}`, 'test', { index: i });
      }

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(analyticsService.eventBuffer.length).toBeLessThan(100);
    });
  });

  describe('Network Detection', () => {
    test('should detect network type', () => {
      expect(analyticsService.detectNetworkType({ networkType: 'wifi' })).toBe('wifi');
      expect(analyticsService.detectNetworkType({ connection: true })).toBe('cellular');
      expect(analyticsService.detectNetworkType({})).toBe('wifi');
    });
  });

  describe('Session Management', () => {
    test('should generate consistent session IDs', () => {
      const session1 = analyticsService.getSessionId('user123');
      const session2 = analyticsService.getSessionId('user123');
      
      expect(session1).toBe(session2);
    });

    test('should generate unique session IDs for different users', () => {
      const session1 = analyticsService.getSessionId('user1');
      const session2 = analyticsService.getSessionId('user2');
      
      expect(session1).not.toBe(session2);
    });
  });
});
