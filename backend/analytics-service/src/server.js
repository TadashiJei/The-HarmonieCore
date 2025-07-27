/**
 * HarmonieCORE Analytics Service Server
 * REST API and WebSocket endpoints for analytics and insights
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const AnalyticsService = require('./services/analyticsService');
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
app.use(express.json({ limit: '1mb' })); // Mobile-optimized payload size
app.use(express.urlencoded({ extended: true }));

// Rate limiting for mobile users
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Initialize analytics service
const analyticsService = new AnalyticsService();

// Real-time connection handling
io.on('connection', (socket) => {
  logger.info(`Analytics client connected: ${socket.id}`);

  socket.on('subscribe-dashboard', () => {
    socket.join('dashboard-updates');
    logger.info(`Client ${socket.id} subscribed to dashboard updates`);
  });

  socket.on('subscribe-artist', (artistId) => {
    socket.join(`artist-${artistId}`);
    logger.info(`Client ${socket.id} subscribed to artist ${artistId}`);
  });

  socket.on('track-event', async (eventData) => {
    try {
      const { userId, type, data } = eventData;
      await analyticsService.trackEvent(userId, type, data);
      socket.emit('event-tracked', { success: true });
    } catch (error) {
      socket.emit('tracking-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Analytics client disconnected: ${socket.id}`);
  });
});

// Emit real-time updates
analyticsService.on('analytics-updated', (data) => {
  io.to('dashboard-updates').emit('dashboard-update', data);
});

// REST API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'analytics-service',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Track event
app.post('/api/events/track', async (req, res) => {
  try {
    const { userId, type, data } = req.body;
    
    if (!userId || !type) {
      return res.status(400).json({ error: 'Missing required fields: userId, type' });
    }

    const eventId = await analyticsService.trackEvent(userId, type, data);
    
    res.json({ 
      success: true, 
      eventId,
      message: 'Event tracked successfully'
    });
  } catch (error) {
    logger.error('Error tracking event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Track streaming event
app.post('/api/events/streaming', async (req, res) => {
  try {
    const { userId, streamId, eventType, data } = req.body;
    
    if (!userId || !streamId || !eventType) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, streamId, eventType' 
      });
    }

    const eventId = await analyticsService.trackStreamingEvent(
      userId, streamId, eventType, data
    );
    
    res.json({ 
      success: true, 
      eventId,
      message: 'Streaming event tracked'
    });
  } catch (error) {
    logger.error('Error tracking streaming event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Track revenue event
app.post('/api/events/revenue', async (req, res) => {
  try {
    const { userId, eventType, revenueData } = req.body;
    
    if (!userId || !eventType || !revenueData) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, eventType, revenueData' 
      });
    }

    const eventId = await analyticsService.trackRevenueEvent(
      userId, eventType, revenueData
    );
    
    res.json({ 
      success: true, 
      eventId,
      message: 'Revenue event tracked'
    });
  } catch (error) {
    logger.error('Error tracking revenue event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Track engagement
app.post('/api/events/engagement', async (req, res) => {
  try {
    const { userId, action, engagementData } = req.body;
    
    if (!userId || !action) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, action' 
      });
    }

    const eventId = await analyticsService.trackEngagement(
      userId, action, engagementData || {}
    );
    
    res.json({ 
      success: true, 
      eventId,
      message: 'Engagement tracked'
    });
  } catch (error) {
    logger.error('Error tracking engagement:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get realtime dashboard
app.get('/api/dashboard/realtime', async (req, res) => {
  try {
    const dashboard = await analyticsService.getRealtimeDashboard();
    res.json(dashboard);
  } catch (error) {
    logger.error('Error getting realtime dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get artist analytics
app.get('/api/analytics/artist/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    const { timeRange = '7d' } = req.query;
    
    const analytics = await analyticsService.getArtistAnalytics(artistId, timeRange);
    res.json(analytics);
  } catch (error) {
    logger.error('Error getting artist analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user behavior analytics
app.get('/api/analytics/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = '30d' } = req.query;
    
    const analytics = await analyticsService.getUserBehaviorAnalytics(userId, timeRange);
    res.json(analytics);
  } catch (error) {
    logger.error('Error getting user analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get performance analytics
app.get('/api/analytics/performance', async (req, res) => {
  try {
    const analytics = await analyticsService.getPerformanceAnalytics();
    res.json(analytics);
  } catch (error) {
    logger.error('Error getting performance analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate custom report
app.post('/api/reports/generate', async (req, res) => {
  try {
    const reportConfig = req.body;
    
    if (!reportConfig.metrics || !reportConfig.timeRange) {
      return res.status(400).json({ 
        error: 'Missing required fields: metrics, timeRange' 
      });
    }

    const report = await analyticsService.generateReport(reportConfig);
    res.json(report);
  } catch (error) {
    logger.error('Error generating report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch track events (mobile-optimized)
app.post('/api/events/batch', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Events must be an array' });
    }

    const results = await Promise.allSettled(
      events.map(event => 
        analyticsService.trackEvent(event.userId, event.type, event.data)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({ 
      success: true, 
      successful,
      failed,
      total: events.length
    });
  } catch (error) {
    logger.error('Error batch tracking events:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export analytics data
app.get('/api/export/:format', async (req, res) => {
  try {
    const { format } = req.params;
    const { timeRange = '7d', filters = {} } = req.query;
    
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use json or csv' });
    }

    const range = analyticsService.parseTimeRange(timeRange);
    const events = analyticsService.filterEvents(filters, range);

    if (format === 'json') {
      res.json(events);
    } else if (format === 'csv') {
      const { Parser } = require('json2csv');
      const parser = new Parser();
      const csv = parser.parse(events);
      
      res.header('Content-Type', 'text/csv');
      res.attachment('analytics-data.csv');
      res.send(csv);
    }
  } catch (error) {
    logger.error('Error exporting data:', error);
    res.status(500).json({ error: error.message });
  }
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
const PORT = process.env.PORT || 3004;

server.listen(PORT, () => {
  logger.info(`Analytics Service running on port ${PORT}`);
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

module.exports = { app, server, analyticsService };
