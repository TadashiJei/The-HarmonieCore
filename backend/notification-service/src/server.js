/**
 * HarmonieCORE Notification Service Server
 * REST API and WebSocket endpoints for notification management
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NotificationService = require('./services/notificationService');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Initialize notification service
const notificationService = new NotificationService();

// User connection tracking
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);

  socket.on('register-user', (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.userId = userId;
    logger.info(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on('update-preferences', async (preferences) => {
    if (socket.userId) {
      await notificationService.updateUserPreferences(socket.userId, preferences);
      socket.emit('preferences-updated', preferences);
    }
  });

  socket.on('mark-read', async (notificationId) => {
    // Mark notification as read
    socket.emit('notification-read', notificationId);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// REST API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'notification-service',
    version: '1.0.0'
  });
});

// Send notification
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { userId, type, data } = req.body;
    
    if (!userId || !type || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notificationId = await notificationService.sendNotification(userId, {
      type,
      ...data
    });

    res.json({ 
      success: true, 
      notificationId,
      message: 'Notification queued for delivery'
    });
  } catch (error) {
    logger.error('Error sending notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch send notifications
app.post('/api/notifications/batch', async (req, res) => {
  try {
    const { notifications } = req.body;
    
    if (!Array.isArray(notifications)) {
      return res.status(400).json({ error: 'Notifications must be an array' });
    }

    const results = await Promise.allSettled(
      notifications.map(notif => 
        notificationService.sendNotification(notif.userId, notif)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({ 
      success: true, 
      successful,
      failed,
      total: notifications.length
    });
  } catch (error) {
    logger.error('Error batch sending notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user preferences
app.get('/api/users/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = await notificationService.getUserPreferences(userId);
    res.json(preferences);
  } catch (error) {
    logger.error('Error getting preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user preferences
app.put('/api/users/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;
    
    const updated = await notificationService.updateUserPreferences(userId, preferences);
    res.json(updated);
  } catch (error) {
    logger.error('Error updating preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get notification history
app.get('/api/users/:userId/notifications', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    const history = await notificationService.getNotificationHistory(userId, parseInt(limit));
    res.json(history);
  } catch (error) {
    logger.error('Error getting notification history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get service statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = notificationService.getNotificationStats();
    stats.connectedUsers = connectedUsers.size;
    res.json(stats);
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoints for external services
app.post('/webhooks/email/delivery', (req, res) => {
  logger.info('Email delivery webhook received:', req.body);
  res.json({ received: true });
});

app.post('/webhooks/sms/status', (req, res) => {
  logger.info('SMS status webhook received:', req.body);
  res.json({ received: true });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  logger.info(`Notification Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, notificationService };
