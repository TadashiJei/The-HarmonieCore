/**
 * User Service Server
 * Express server for user management microservice with authentication and social features
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const mongoose = require('mongoose');
const redis = require('redis');
const passport = require('passport');
const multer = require('multer');
const { UserService } = require('./services/userService');
const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const userService = new UserService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/harmoniecore_users', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Redis connection
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || ''
});

// Configure Passport
require('./config/passport')(passport);

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for avatars
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoose.connection.readyState === 1,
        redis: redisClient.connected
      }
    };
    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Authentication routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, displayName, role } = req.body;

    // Basic validation
    if (!email || !username || !password || !displayName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await userService.registerUser({
      email,
      username,
      password,
      displayName,
      role
    });

    res.status(201).json(result);
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await userService.loginUser(email, password);
    res.json(result);
  } catch (error) {
    logger.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Verify email
app.get('/api/auth/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // TODO: Implement email verification
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Refresh token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = await userService.verifyToken(refreshToken);
    const user = await userService.findUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = await userService.generateTokens(user);
    res.json({ tokens });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Clear Redis cache
    await redisClient.del(`session:${userId}`);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // TODO: Implement password reset
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Social authentication routes
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/api/auth/google/callback', 
  passport.authenticate('google', { session: false }),
  (req, res) => {
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${req.user.token}`);
  }
);

// User routes

// Get current user
app.get('/api/users/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await userService.getUserProfile(userId);
    res.json(user);
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/users/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user.userId;
    
    const user = await userService.getUserProfile(userId, requesterId);
    res.json(user);
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/users/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = req.body;
    
    const user = await userService.updateUserProfile(userId, updates);
    res.json(user);
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Upload avatar
app.post('/api/users/me/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const result = await userService.uploadAvatar(userId, req.file);
    res.json(result);
  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Social routes

// Follow/unfollow user
app.post('/api/users/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.userId;
    const followingId = req.params.userId;
    
    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const result = await userService.toggleFollow(followerId, followingId);
    res.json(result);
  } catch (error) {
    logger.error('Follow toggle error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get followers
app.get('/api/users/:userId/followers', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await userService.getSocialList(userId, 'followers', parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    logger.error('Get followers error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get following
app.get('/api/users/:userId/following', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await userService.getSocialList(userId, 'following', parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    logger.error('Get following error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Block/unblock user
app.post('/api/users/:userId/block', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const blockedUserId = req.params.userId;
    
    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const result = await userService.toggleBlock(userId, blockedUserId);
    res.json(result);
  } catch (error) {
    logger.error('Block toggle error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Search users
app.get('/api/users', async (req, res) => {
  try {
    const { q, role, location, limit = 20, offset = 0 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const filters = { role, location };
    const result = await userService.searchUsers(q, filters, parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    logger.error('Search users error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Analytics routes

app.get('/api/users/me/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const stats = await userService.getUserStats(userId);
    res.json(stats);
  } catch (error) {
    logger.error('Get user stats error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Admin routes (protected)

app.get('/api/admin/users', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin role check
    const { limit = 50, offset = 0 } = req.query;
    
    const users = await User.find({ status: { $ne: 'deleted' } })
      .select('-password -verificationToken -resetPasswordToken')
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    logger.error('Get users error:', error);
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
app.listen(PORT, () => {
  logger.info(`User Service running on port ${PORT}`);
  console.log(`🚀 User Service started on http://localhost:${PORT}`);
});

module.exports = app;
