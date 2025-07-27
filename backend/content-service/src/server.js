/**
 * Content Service Server
 * Express server for content management microservice
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const multer = require('multer');
const mongoose = require('mongoose');
const redis = require('redis');
const ContentService = require('./services/contentService');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3007;

// Initialize services
const contentService = new ContentService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/temp';
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/mkv',
      'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg',
      'application/pdf', 'text/plain', 'application/json'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/harmoniecore_content', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Redis connection
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || ''
});

// Content Schema
const contentSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  userId: { type: String, required: true },
  originalName: String,
  fileName: String,
  mimeType: String,
  size: Number,
  type: { type: String, enum: ['image', 'video', 'audio', 'document'] },
  metadata: {
    title: String,
    description: String,
    tags: [String],
    category: String,
    license: String,
    ipfs: Object,
    cdn: Object,
    dimensions: Object,
    duration: Number,
    fileHash: String
  },
  status: { type: String, enum: ['uploaded', 'processing', 'ready', 'failed', 'deleted'], default: 'uploaded' },
  visibility: { type: String, enum: ['public', 'private', 'unlisted'], default: 'public' },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Content = mongoose.model('Content', contentSchema);

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoose.connection.readyState === 1,
        redis: redisClient.connected,
        ipfs: await checkIPFSConnection(),
        cdn: await checkCDNConnection()
      }
    };
    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Upload content
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const userId = req.headers['x-user-id'] || 'anonymous';
    const metadata = JSON.parse(req.body.metadata || '{}');

    const result = await contentService.uploadContent({
      file: req.file,
      metadata,
      userId,
      options: JSON.parse(req.body.options || '{}')
    });

    // Save to database
    const content = new Content(result);
    await content.save();

    res.json({
      success: true,
      contentId: result.id,
      metadata: result.metadata,
      urls: result.metadata.cdn
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get content
app.get('/api/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    // Check cache first
    const cached = await redisClient.get(`content:${contentId}`);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const content = await Content.findOne({ id: contentId });
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Increment views
    content.views += 1;
    await content.save();

    // Cache for 1 hour
    await redisClient.setEx(`content:${contentId}`, 3600, JSON.stringify(content));

    res.json(content);
  } catch (error) {
    logger.error('Get content error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search content
app.get('/api/search', async (req, res) => {
  try {
    const { q, type, userId, limit = 20, offset = 0 } = req.query;
    
    const query = {};
    if (q) query.$text = { $search: q };
    if (type) query.type = type;
    if (userId) query.userId = userId;
    
    query.status = 'ready';
    query.visibility = 'public';

    const results = await Content.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Content.countDocuments(query);

    res.json({
      results,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update content metadata
app.put('/api/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.headers['x-user-id'];
    const updates = req.body;

    const content = await Content.findOne({ id: contentId, userId });
    if (!content) {
      return res.status(404).json({ error: 'Content not found or unauthorized' });
    }

    Object.assign(content.metadata, updates);
    content.updatedAt = new Date();
    await content.save();

    // Clear cache
    await redisClient.del(`content:${contentId}`);

    res.json({ success: true, content });
  } catch (error) {
    logger.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete content
app.delete('/api/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.headers['x-user-id'];

    const content = await Content.findOne({ id: contentId, userId });
    if (!content) {
      return res.status(404).json({ error: 'Content not found or unauthorized' });
    }

    content.status = 'deleted';
    content.updatedAt = new Date();
    await content.save();

    // Clear cache
    await redisClient.del(`content:${contentId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user content
app.get('/api/users/:userId/content', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const content = await Content.find({ userId, status: { $ne: 'deleted' } })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json(content);
  } catch (error) {
    logger.error('User content error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analytics endpoints
app.get('/api/analytics/total-uploads', async (req, res) => {
  try {
    const total = await Content.countDocuments({ status: { $ne: 'deleted' } });
    res.json({ total });
  } catch (error) {
    logger.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function checkIPFSConnection() {
  try {
    const ipfs = require('ipfs-http-client').create();
    const version = await ipfs.version();
    return !!version;
  } catch {
    return false;
  }
}

async function checkCDNConnection() {
  try {
    const axios = require('axios');
    const response = await axios.get(process.env.CDN_BASE_URL || 'https://cdn.harmoniecore.com/health');
    return response.status === 200;
  } catch {
    return false;
  }
}

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
app.listen(PORT, () => {
  logger.info(`Content Service running on port ${PORT}`);
  console.log(`🚀 Content Service started on http://localhost:${PORT}`);
});

module.exports = app;
