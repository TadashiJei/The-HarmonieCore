/**
 * HarmonieCORE Notification Service
 * Ultra-optimized notification system for Web3 artist platform
 * Features: Email, SMS, Push notifications, WebSocket real-time alerts
 * Mobile-optimized with batching and rate limiting
 */

const EventEmitter = require('events');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const webpush = require('web-push');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.activeNotifications = new Map();
    this.notificationQueue = [];
    this.userPreferences = new Map();
    this.rateLimits = new Map();
    
    // Mobile-optimized settings
    this.settings = {
      maxNotificationsPerMinute: 5,
      maxNotificationsPerHour: 20,
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 5000,
      mobilePushPriority: 'high',
      emailBatchInterval: 300000, // 5 minutes
      smsRateLimit: 1, // per minute
      pushRateLimit: 10 // per minute
    };

    this.initializeServices();
    this.startBatchProcessor();
  }

  /**
   * Initialize notification services
   */
  initializeServices() {
    // Email service
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // SMS service (Twilio)
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Firebase Admin for push notifications
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
      this.firebaseAdmin = admin;
    }

    // Web Push configuration
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        'mailto:harmoniecore@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    }
  }

  /**
   * Send notification with mobile optimization
   */
  async sendNotification(userId, notification) {
    try {
      // Check rate limits
      if (!this.checkRateLimit(userId, notification.type)) {
        throw new Error('Rate limit exceeded');
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(userId);
      if (!preferences[notification.type]) {
        logger.info(`NotificationService: ${notification.type} disabled for user ${userId}`);
        return null;
      }

      const notificationId = uuidv4();
      const enrichedNotification = {
        id: notificationId,
        userId,
        ...notification,
        status: 'pending',
        createdAt: new Date().toISOString(),
        attempts: 0,
        mobileOptimized: this.isMobileDevice(userId)
      };

      // Queue for batch processing
      this.notificationQueue.push(enrichedNotification);
      this.activeNotifications.set(notificationId, enrichedNotification);

      this.emit('notification-queued', enrichedNotification);
      logger.info(`NotificationService: Notification queued ${notificationId} for ${userId}`);

      return notificationId;
    } catch (error) {
      logger.error(`NotificationService: Error sending notification to ${userId}`, error);
      throw error;
    }
  }

  /**
   * Send email notification with mobile optimization
   */
  async sendEmail(userId, emailData) {
    try {
      const user = await this.getUser(userId);
      if (!user.email) {
        throw new Error('User email not found');
      }

      const mobileOptimized = this.isMobileDevice(userId);
      const emailOptions = {
        from: process.env.SMTP_FROM || 'HarmonieCore <noreply@harmoniecore.com>',
        to: user.email,
        subject: emailData.subject,
        html: this.generateMobileOptimizedEmail(emailData, mobileOptimized),
        text: this.generatePlainTextEmail(emailData)
      };

      const result = await this.emailTransporter.sendMail(emailOptions);
      
      logger.info(`NotificationService: Email sent to ${user.email}`);
      return result.messageId;
    } catch (error) {
      logger.error(`NotificationService: Email send failed for ${userId}`, error);
      throw error;
    }
  }

  /**
   * Send SMS notification with mobile optimization
   */
  async sendSMS(userId, smsData) {
    try {
      const user = await this.getUser(userId);
      if (!user.phone) {
        throw new Error('User phone number not found');
      }

      const message = this.optimizeSMSContent(smsData.message);
      
      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phone
      });

      logger.info(`NotificationService: SMS sent to ${user.phone}`);
      return result.sid;
    } catch (error) {
      logger.error(`NotificationService: SMS send failed for ${userId}`, error);
      throw error;
    }
  }

  /**
   * Send push notification with mobile optimization
   */
  async sendPushNotification(userId, pushData) {
    try {
      const user = await this.getUser(userId);
      if (!user.pushTokens || user.pushTokens.length === 0) {
        throw new Error('No push tokens found for user');
      }

      const payload = {
        notification: {
          title: pushData.title,
          body: this.optimizePushContent(pushData.body),
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          vibrate: [200, 100, 200],
          tag: pushData.tag || 'harmoniecore',
          requireInteraction: false,
          renotify: false,
          silent: false,
          actions: pushData.actions || []
        },
        data: {
          ...pushData.data,
          userId,
          timestamp: Date.now(),
          mobileOptimized: true
        },
        android: {
          priority: 'high',
          notification: {
            channel_id: 'harmoniecore_notifications',
            sound: 'default',
            default_vibrate_timings: true,
            default_sound: true,
            default_light_settings: true
          }
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert'
          },
          payload: {
            aps: {
              alert: {
                title: pushData.title,
                body: this.optimizePushContent(pushData.body)
              },
              badge: 1,
              sound: 'default'
            }
          }
        }
      };

      const results = [];
      for (const token of user.pushTokens) {
        try {
          const result = await this.firebaseAdmin.messaging().send({
            token,
            ...payload
          });
          results.push(result);
        } catch (error) {
          logger.warn(`NotificationService: Failed to send to token ${token}`, error);
        }
      }

      logger.info(`NotificationService: Push notifications sent to ${results.length} devices for ${userId}`);
      return results;
    } catch (error) {
      logger.error(`NotificationService: Push notification failed for ${userId}`, error);
      throw error;
    }
  }

  /**
   * Send web push notification
   */
  async sendWebPush(userId, webPushData) {
    try {
      const user = await this.getUser(userId);
      if (!user.webPushSubscriptions || user.webPushSubscriptions.length === 0) {
        throw new Error('No web push subscriptions found');
      }

      const payload = JSON.stringify({
        title: webPushData.title,
        body: this.optimizePushContent(webPushData.body),
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: {
          ...webPushData.data,
          userId,
          timestamp: Date.now()
        },
        actions: webPushData.actions || []
      });

      const results = [];
      for (const subscription of user.webPushSubscriptions) {
        try {
          await webpush.sendNotification(subscription, payload);
          results.push({ success: true, subscription });
        } catch (error) {
          logger.warn(`NotificationService: Web push failed for subscription`, error);
          results.push({ success: false, subscription, error: error.message });
        }
      }

      logger.info(`NotificationService: Web push sent to ${results.filter(r => r.success).length} subscriptions`);
      return results;
    } catch (error) {
      logger.error(`NotificationService: Web push failed for ${userId}`, error);
      throw error;
    }
  }

  /**
   * Batch process notifications for efficiency
   */
  startBatchProcessor() {
    setInterval(async () => {
      if (this.notificationQueue.length === 0) return;

      const batch = this.notificationQueue.splice(0, this.settings.batchSize);
      
      for (const notification of batch) {
        try {
          await this.processNotification(notification);
          notification.status = 'sent';
          this.activeNotifications.delete(notification.id);
        } catch (error) {
          notification.attempts++;
          if (notification.attempts < this.settings.retryAttempts) {
            this.notificationQueue.push(notification);
          } else {
            notification.status = 'failed';
            this.activeNotifications.delete(notification.id);
            logger.error(`NotificationService: Notification failed after retries ${notification.id}`);
          }
        }
      }
    }, 1000);
  }

  /**
   * Process individual notification
   */
  async processNotification(notification) {
    switch (notification.type) {
      case 'email':
        return await this.sendEmail(notification.userId, notification);
      case 'sms':
        return await this.sendSMS(notification.userId, notification);
      case 'push':
        return await this.sendPushNotification(notification.userId, notification);
      case 'webpush':
        return await this.sendWebPush(notification.userId, notification);
      default:
        throw new Error(`Unknown notification type: ${notification.type}`);
    }
  }

  /**
   * Get notification preferences for user
   */
  async getUserPreferences(userId) {
    // In real implementation, fetch from database
    return this.userPreferences.get(userId) || {
      email: true,
      sms: false,
      push: true,
      webpush: true,
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00'
      },
      frequency: 'immediate' // immediate, hourly, daily
    };
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId, preferences) {
    this.userPreferences.set(userId, preferences);
    this.emit('preferences-updated', { userId, preferences });
    return preferences;
  }

  /**
   * Get notification history for user
   */
  async getNotificationHistory(userId, limit = 50) {
    const notifications = Array.from(this.activeNotifications.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    return notifications;
  }

  /**
   * Get notification statistics
   */
  getNotificationStats() {
    const allNotifications = Array.from(this.activeNotifications.values());
    const sent = allNotifications.filter(n => n.status === 'sent').length;
    const pending = allNotifications.filter(n => n.status === 'pending').length;
    const failed = allNotifications.filter(n => n.status === 'failed').length;

    return {
      total: allNotifications.length,
      sent,
      pending,
      failed,
      queueLength: this.notificationQueue.length,
      userPreferences: this.userPreferences.size
    };
  }

  /**
   * Check rate limits for user
   */
  checkRateLimit(userId, type) {
    const key = `${userId}:${type}`;
    const now = Date.now();
    const limits = {
      email: { limit: this.settings.maxNotificationsPerHour, window: 3600000 },
      sms: { limit: this.settings.smsRateLimit, window: 60000 },
      push: { limit: this.settings.pushRateLimit, window: 60000 }
    };

    const limit = limits[type];
    if (!limit) return true;

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }

    const timestamps = this.rateLimits.get(key);
    const recentTimestamps = timestamps.filter(t => now - t < limit.window);
    
    if (recentTimestamps.length >= limit.limit) {
      return false;
    }

    recentTimestamps.push(now);
    this.rateLimits.set(key, recentTimestamps);
    return true;
  }

  /**
   * Mobile optimization helpers
   */
  isMobileDevice(userId) {
    // In real implementation, check user agent/device info
    return true; // Assume mobile-first
  }

  generateMobileOptimizedEmail(emailData, isMobile) {
    if (isMobile) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .container { max-width: 100%; margin: 0 auto; }
            .header { background: #1a1a1a; color: white; padding: 15px; text-align: center; }
            .content { padding: 20px 0; }
            .button { background: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
            @media (max-width: 600px) {
              .container { padding: 10px; }
              .button { width: 100%; text-align: center; box-sizing: border-box; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>HarmonieCore</h1>
            </div>
            <div class="content">
              <h2>${emailData.subject}</h2>
              <p>${emailData.body}</p>
              ${emailData.actionUrl ? `<a href="${emailData.actionUrl}" class="button">${emailData.actionText || 'View Now'}</a>` : ''}
            </div>
          </div>
        </body>
        </html>
      `;
    }
    return emailData.html || `<div>${emailData.body}</div>`;
  }

  generatePlainTextEmail(emailData) {
    return `${emailData.subject}\n\n${emailData.body}\n\n${emailData.actionUrl || ''}`;
  }

  optimizeSMSContent(message) {
    // SMS has 160 character limit
    if (message.length > 160) {
      return message.substring(0, 157) + '...';
    }
    return message;
  }

  optimizePushContent(message) {
    // Push notifications should be concise
    if (message.length > 100) {
      return message.substring(0, 97) + '...';
    }
    return message;
  }

  /**
   * Get user data (placeholder - integrate with user service)
   */
  async getUser(userId) {
    // In real implementation, fetch from user service
    return {
      id: userId,
      email: `${userId}@example.com`,
      phone: '+1234567890',
      pushTokens: ['token1', 'token2'],
      webPushSubscriptions: [{ endpoint: 'https://example.com/push', keys: {} }]
    };
  }
}

module.exports = NotificationService;
