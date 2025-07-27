/**
 * HarmonieCORE CDN Service Server
 * Global edge server with REST API and real-time content delivery
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const CDNService = require('./services/cdnService');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for mobile users
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Initialize CDN service
const cdnService = new CDNService();

// Real-time connection handling
io.on('connection', (socket) => {
  logger.info(`CDN client connected: ${socket.id}`);

  socket.on('subscribe-region', (region) => {
    socket.join(`region-${region}`);
    logger.info(`Client ${socket.id} subscribed to region ${region}`);
  });

  socket.on('cache-warm', async (data) => {
    try {
      const { contentId, region } = data;
      await cdnService.warmEdgeCache(region, contentId, {});
      socket.emit('cache-warmed', { contentId, region });
    } catch (error) {
      socket.emit('cache-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`CDN client disconnected: ${socket.id}`);
  });
});

// REST API Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    const healthStatus = await cdnService.healthCheck();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'cdn-service',
      version: '1.0.0',
      uptime: process.uptime(),
      regions: healthStatus
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload content
app.post('/api/upload', async (req, res) => {
  try {
    const { content, type, filename, metadata, optimizeForMobile = true } = req.body;
    
    if (!content || !type || !filename) {
      return res.status(400).json({
        error: 'Missing required fields: content, type, filename'
      });
    }

    const buffer = Buffer.from(content, 'base64');
    const result = await cdnService.uploadContent(buffer, {
      type,
      filename,
      metadata,
      optimizeForMobile
    });

    res.json({
      success: true,
      contentId: result.contentId,
      urls: result.urls,
      thumbnails: result.thumbnails,
      metadata: result.metadata
    });
  } catch (error) {
    logger.error('Error uploading content:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve content
app.get('/api/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const {
      quality = 'auto',
      format = 'original',
      width,
      height,
      optimizeForMobile = true
    } = req.query;

    const content = await cdnService.serveContent(contentId, {
      quality,
      format,
      width: width ? parseInt(width) : null,
      height: height ? parseInt(height) : null,
      optimizeForMobile
    });

    res.set({
      'Content-Type': content.contentType,
      'Cache-Control': `public, max-age=${cdnService.config.cacheTTL[content.type] || 3600}`,
      'ETag': content.etag,
      'X-Cache': content.fromCache ? 'HIT' : 'MISS'
    });

    res.send(content.data);
  } catch (error) {
    logger.error('Error serving content:', error);
    res.status(404).json({ error: 'Content not found' });
  }
});

// Generate signed URL
app.post('/api/signed-url', async (req, res) => {
  try {
    const { contentId, expiresIn = 3600 } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        error: 'Missing required field: contentId'
      });
    }

    const signedUrl = await cdnService.generateSignedUrl(contentId, expiresIn);
    
    res.json({
      success: true,
      signedUrl
    });
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate signed URL
app.get('/api/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await cdnService.validateSignedUrl(token);
    
    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.json({
      valid: true,
      contentId: result.contentId,
      expires: new Date(result.expires)
    });
  } catch (error) {
    logger.error('Error validating token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get CDN metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await cdnService.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk upload
app.post('/api/upload/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        error: 'Items must be an array'
      });
    }

    const results = await Promise.allSettled(
      items.map(async (item) => {
        const buffer = Buffer.from(item.content, 'base64');
        return await cdnService.uploadContent(buffer, {
          type: item.type,
          filename: item.filename,
          metadata: item.metadata,
          optimizeForMobile: item.optimizeForMobile !== false
        });
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({
      success: true,
      successful,
      failed,
      total: items.length,
      results: results.map((r, index) => ({
        index,
        success: r.status === 'fulfilled',
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason.message : null
      }))
    });
  } catch (error) {
    logger.error('Error bulk uploading:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete content
app.delete('/api/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    // Implementation for content deletion
    // This would involve removing from S3, CloudFront, and cache
    
    res.json({
      success: true,
      message: 'Content scheduled for deletion'
    });
  } catch (error) {
    logger.error('Error deleting content:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cache management
app.post('/api/cache/invalidate', async (req, res) => {
  try {
    const { contentId, region } = req.body;
    
    if (contentId) {
      await cdnService.redis.del(`content:${contentId}`);
    }
    
    if (region) {
      await cdnService.redis.del(`edge:${region}:${contentId}`);
    }

    res.json({
      success: true,
      message: 'Cache invalidated'
    });
  } catch (error) {
    logger.error('Error invalidating cache:', error);
    res.status(500).json({ error: error.message });
  }
});

// Region-based content serving
app.get('/api/regions', async (req, res) => {
  try {
    const regions = cdnService.edgeNodes.map(node => ({
      region: node.region,
      endpoint: node.endpoint,
      status: node.status,
      lastHealthCheck: node.lastHealthCheck
    }));

    res.json({ regions });
  } catch (error) {
    logger.error('Error getting regions:', error);
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
const PORT = process.env.PORT || 3005;

server.listen(PORT, () => {
  logger.info(`CDN Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Regions: ${cdnService.config.regions.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, cdnService };
