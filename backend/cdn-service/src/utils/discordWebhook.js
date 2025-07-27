/**
 * Discord Webhook Integration Utility
 * Handles Discord notifications for CDN service alerts and metrics
 */

const axios = require('axios');
const logger = require('./logger');

class DiscordWebhookService {
  constructor() {
    this.webhookUrl = process.env.ALERT_WEBHOOK_URL;
    this.enabled = !!this.webhookUrl;
    this.rateLimitQueue = [];
    this.isProcessing = false;
  }

  /**
   * Send alert to Discord webhook
   */
  async sendAlert(type, title, description, fields = []) {
    if (!this.enabled) {
      logger.warn('Discord webhook not configured');
      return;
    }

    const embed = this.createEmbed(type, title, description, fields);
    const payload = {
      username: 'HarmonieCDN Bot',
      avatar_url: 'https://harmoniecore.com/cdn-bot-avatar.png',
      embeds: [embed]
    };

    try {
      await this.sendWithRateLimit(payload);
      logger.info(`Discord alert sent: ${title}`);
    } catch (error) {
      logger.error('Failed to send Discord alert:', error);
    }
  }

  /**
   * Send health check alert
   */
  async sendHealthAlert(region, status, details = {}) {
    const color = status === 'healthy' ? 5763719 : 15158332;
    const emoji = status === 'healthy' ? '✅' : '❌';

    const fields = [
      { name: 'Region', value: region, inline: true },
      { name: 'Status', value: `${emoji} ${status.toUpperCase()}`, inline: true },
      { name: 'Timestamp', value: new Date().toISOString(), inline: false }
    ];

    if (details.responseTime) {
      fields.push({ name: 'Response Time', value: `${details.responseTime}ms`, inline: true });
    }

    if (details.error) {
      fields.push({ name: 'Error', value: details.error, inline: false });
    }

    await this.sendAlert('health', 'CDN Health Check', `Region ${region} status update`, fields);
  }

  /**
   * Send performance metrics
   */
  async sendMetricsAlert(metrics) {
    const fields = [
      { name: 'Cache Hit Rate', value: `${metrics.cacheHitRate}%`, inline: true },
      { name: 'Total Requests', value: metrics.totalRequests.toLocaleString(), inline: true },
      { name: 'Mobile Data Saved', value: this.formatBytes(metrics.mobileDataSaved), inline: true },
      { name: 'Bandwidth Saved', value: this.formatBytes(metrics.bandwidthSaved), inline: true },
      { name: 'Active Edge Nodes', value: `${metrics.edgeNodes.filter(n => n.status === 'active').length}/${metrics.edgeNodes.length}`, inline: true }
    ];

    await this.sendAlert('metrics', 'CDN Performance Report', 'Current performance statistics', fields);
  }

  /**
   * Send upload notification
   */
  async sendUploadNotification(contentId, type, size, regions) {
    const fields = [
      { name: 'Content ID', value: contentId, inline: true },
      { name: 'Type', value: type, inline: true },
      { name: 'Size', value: this.formatBytes(size), inline: true },
      { name: 'Regions', value: regions.join(', '), inline: false }
    ];

    await this.sendAlert('upload', 'Content Upload Complete', 'New content has been successfully uploaded to CDN', fields);
  }

  /**
   * Send error notification
   */
  async sendErrorAlert(error, context = {}) {
    const fields = [
      { name: 'Error Type', value: error.name || 'Error', inline: true },
      { name: 'Message', value: error.message, inline: false }
    ];

    if (context.contentId) {
      fields.push({ name: 'Content ID', value: context.contentId, inline: true });
    }

    if (context.region) {
      fields.push({ name: 'Region', value: context.region, inline: true });
    }

    if (context.stack) {
      fields.push({ name: 'Stack Trace', value: context.stack.substring(0, 1000), inline: false });
    }

    await this.sendAlert('error', 'CDN Service Error', 'An error occurred in the CDN service', fields);
  }

  /**
   * Send rate limit warning
   */
  async sendRateLimitWarning(ip, requests, limit) {
    const fields = [
      { name: 'IP Address', value: ip, inline: true },
      { name: 'Requests', value: requests.toString(), inline: true },
      { name: 'Limit', value: limit.toString(), inline: true },
      { name: 'Action', value: 'Rate limit enforced', inline: false }
    ];

    await this.sendAlert('warning', 'Rate Limit Warning', 'Rate limit exceeded', fields);
  }

  /**
   * Create Discord embed
   */
  createEmbed(type, title, description, fields = []) {
    const colors = {
      info: 3447003,    // Blue
      success: 5763719, // Green
      warning: 16776960, // Yellow
      error: 15158332,  // Red
      health: 10181046  // Purple
    };

    return {
      title,
      description,
      color: colors[type] || colors.info,
      fields,
      footer: {
        text: 'HarmonieCore CDN',
        icon_url: 'https://harmoniecore.com/logo.png'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send webhook with rate limiting
   */
  async sendWithRateLimit(payload) {
    if (this.rateLimitQueue.length >= 5) {
      logger.warn('Discord webhook rate limit exceeded, dropping message');
      return;
    }

    this.rateLimitQueue.push(payload);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process webhook queue with rate limiting
   */
  async processQueue() {
    this.isProcessing = true;

    while (this.rateLimitQueue.length > 0) {
      const payload = this.rateLimitQueue.shift();
      
      try {
        await axios.post(this.webhookUrl, payload);
        await this.delay(1000); // 1 second delay between messages
      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limited by Discord, wait and retry
          const retryAfter = error.response.headers['retry-after'] || 5000;
          logger.warn(`Discord rate limited, waiting ${retryAfter}ms`);
          await this.delay(retryAfter);
          this.rateLimitQueue.unshift(payload); // Retry this message
        } else {
          logger.error('Discord webhook error:', error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Test Discord webhook connection
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'Discord webhook not configured' };
    }

    const testPayload = {
      content: '🔧 CDN Discord Integration Test',
      embeds: [{
        title: 'Connection Test',
        description: 'Testing Discord webhook integration',
        color: 3447003,
        fields: [
          { name: 'Service', value: 'HarmonieCore CDN', inline: true },
          { name: 'Status', value: 'Testing', inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    };

    try {
      await axios.post(this.webhookUrl, testPayload);
      return { success: true, message: 'Discord webhook test successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DiscordWebhookService;
