/**
 * Notification Service Tests
 * Comprehensive test suite for notification functionality
 */

const request = require('supertest');
const { app, notificationService } = require('../src/server');

describe('Notification Service', () => {
  let server;

  beforeAll(() => {
    server = app.listen(3004); // Use different port for testing
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    // Reset service state
    notificationService.activeNotifications.clear();
    notificationService.notificationQueue.length = 0;
    notificationService.userPreferences.clear();
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'notification-service');
    });
  });

  describe('Send Notification', () => {
    test('POST /api/notifications/send should queue notification', async () => {
      const notificationData = {
        userId: 'user123',
        type: 'email',
        data: {
          subject: 'Test Subject',
          body: 'Test Body'
        }
      };

      const response = await request(app)
        .post('/api/notifications/send')
        .send(notificationData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('notificationId');
      expect(response.body).toHaveProperty('message');
    });

    test('POST /api/notifications/send should validate required fields', async () => {
      const response = await request(app)
        .post('/api/notifications/send')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/notifications/send should handle invalid notification type', async () => {
      const response = await request(app)
        .post('/api/notifications/send')
        .send({
          userId: 'user123',
          type: 'invalid',
          data: {}
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Batch Notifications', () => {
    test('POST /api/notifications/batch should process multiple notifications', async () => {
      const batchData = {
        notifications: [
          {
            userId: 'user1',
            type: 'push',
            title: 'Test 1',
            body: 'Body 1'
          },
          {
            userId: 'user2',
            type: 'push',
            title: 'Test 2',
            body: 'Body 2'
          }
        ]
      };

      const response = await request(app)
        .post('/api/notifications/batch')
        .send(batchData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('successful', 2);
      expect(response.body).toHaveProperty('failed', 0);
      expect(response.body).toHaveProperty('total', 2);
    });

    test('POST /api/notifications/batch should validate input', async () => {
      const response = await request(app)
        .post('/api/notifications/batch')
        .send({ notifications: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('User Preferences', () => {
    test('GET /api/users/:userId/preferences should return default preferences', async () => {
      const response = await request(app)
        .get('/api/users/user123/preferences')
        .expect(200);

      expect(response.body).toHaveProperty('email', true);
      expect(response.body).toHaveProperty('push', true);
      expect(response.body).toHaveProperty('quietHours');
    });

    test('PUT /api/users/:userId/preferences should update preferences', async () => {
      const preferences = {
        email: false,
        sms: true,
        push: false,
        quietHours: {
          enabled: true,
          start: '23:00',
          end: '07:00'
        }
      };

      const response = await request(app)
        .put('/api/users/user123/preferences')
        .send(preferences)
        .expect(200);

      expect(response.body).toEqual(preferences);
    });
  });

  describe('Notification History', () => {
    test('GET /api/users/:userId/notifications should return empty array initially', async () => {
      const response = await request(app)
        .get('/api/users/user123/notifications')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    test('GET /api/users/:userId/notifications should respect limit parameter', async () => {
      // Add some test notifications
      for (let i = 0; i < 5; i++) {
        await notificationService.sendNotification('user123', {
          type: 'push',
          title: `Test ${i}`,
          body: `Body ${i}`
        });
      }

      const response = await request(app)
        .get('/api/users/user123/notifications?limit=3')
        .expect(200);

      expect(response.body).toHaveLength(3);
    });
  });

  describe('Service Statistics', () => {
    test('GET /api/stats should return service statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('sent');
      expect(response.body).toHaveProperty('pending');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('queueLength');
      expect(response.body).toHaveProperty('userPreferences');
    });
  });

  describe('NotificationService Class', () => {
    describe('Rate Limiting', () => {
      test('should enforce rate limits per user and type', () => {
        const userId = 'test-user';
        
        // Should allow within limits
        for (let i = 0; i < 5; i++) {
          expect(notificationService.checkRateLimit(userId, 'email')).toBe(true);
        }
        
        // Should block when limit exceeded
        expect(notificationService.checkRateLimit(userId, 'email')).toBe(false);
      });

      test('should reset rate limits after window', (done) => {
        const userId = 'test-user';
        
        // Use up limit
        for (let i = 0; i < 5; i++) {
          notificationService.checkRateLimit(userId, 'push');
        }
        
        expect(notificationService.checkRateLimit(userId, 'push')).toBe(false);
        
        // Wait for window to reset (1 minute for push)
        setTimeout(() => {
          expect(notificationService.checkRateLimit(userId, 'push')).toBe(true);
          done();
        }, 100);
      });
    });

    describe('User Preferences', () => {
      test('should store and retrieve user preferences', async () => {
        const userId = 'test-user';
        const preferences = {
          email: false,
          sms: true,
          push: true
        };

        await notificationService.updateUserPreferences(userId, preferences);
        const retrieved = await notificationService.getUserPreferences(userId);

        expect(retrieved.email).toBe(false);
        expect(retrieved.sms).toBe(true);
        expect(retrieved.push).toBe(true);
      });
    });

    describe('Notification Statistics', () => {
      test('should return accurate statistics', async () => {
        const stats = notificationService.getNotificationStats();
        
        expect(stats).toHaveProperty('total', 0);
        expect(stats).toHaveProperty('sent', 0);
        expect(stats).toHaveProperty('pending', 0);
        expect(stats).toHaveProperty('failed', 0);
        expect(stats).toHaveProperty('queueLength', 0);
      });

      test('should update statistics after notifications', async () => {
        await notificationService.sendNotification('user1', {
          type: 'push',
          title: 'Test',
          body: 'Test body'
        });

        const stats = notificationService.getNotificationStats();
        expect(stats.total).toBeGreaterThan(0);
      });
    });

    describe('Mobile Optimization', () => {
      test('should optimize SMS content for character limit', () => {
        const longMessage = 'This is a very long message that exceeds the 160 character limit for SMS messages and should be truncated appropriately';
        const optimized = notificationService.optimizeSMSContent(longMessage);
        
        expect(optimized.length).toBeLessThanOrEqual(160);
        expect(optimized.endsWith('...')).toBe(true);
      });

      test('should optimize push content for mobile', () => {
        const longMessage = 'This is a very long push notification message that should be shortened for mobile devices';
        const optimized = notificationService.optimizePushContent(longMessage);
        
        expect(optimized.length).toBeLessThanOrEqual(100);
        expect(optimized.endsWith('...')).toBe(true);
      });

      test('should generate mobile-optimized email', () => {
        const emailData = {
          subject: 'Test Subject',
          body: 'Test Body',
          actionUrl: 'https://example.com',
          actionText: 'Click Here'
        };

        const html = notificationService.generateMobileOptimizedEmail(emailData, true);
        
        expect(html).toContain('viewport');
        expect(html).toContain('max-width: 100%');
        expect(html).toContain('media (max-width: 600px)');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid user ID gracefully', async () => {
      const response = await request(app)
        .post('/api/notifications/send')
        .send({
          userId: 'invalid-user',
          type: 'email',
          data: { subject: 'Test', body: 'Test' }
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle missing notification service dependencies', async () => {
      // Test with missing configuration
      process.env.SMTP_USER = '';
      
      const response = await request(app)
        .post('/api/notifications/send')
        .send({
          userId: 'user123',
          type: 'email',
          data: { subject: 'Test', body: 'Test' }
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });
});
