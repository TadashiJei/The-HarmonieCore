const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const redis = require('redis');

// Redis client for distributed rate limiting
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
});

// Rate limiters
const rateLimiters = {
  // API endpoints
  api: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'harmoniecore:api',
    points: 100, // Number of requests
    duration: 900, // Per 15 minutes
    blockDuration: 900 // Block for 15 minutes
  }),

  // Stream creation
  streamCreation: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'harmoniecore:stream_creation',
    points: 5, // 5 streams per hour
    duration: 3600,
    blockDuration: 3600
  }),

  // Chat messages
  chatMessages: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'harmoniecore:chat',
    points: 50, // 50 messages per minute
    duration: 60,
    blockDuration: 60
  }),

  // Tips
  tips: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'harmoniecore:tips',
    points: 10, // 10 tips per minute
    duration: 60,
    blockDuration: 60
  }),

  // WebRTC signaling
  webrtcSignaling: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'harmoniecore:webrtc',
    points: 200, // 200 signaling messages per minute
    duration: 60,
    blockDuration: 60
  }),

  // Connection attempts
  connectionAttempts: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'harmoniecore:connections',
    points: 20, // 20 connection attempts per minute
    duration: 60,
    blockDuration: 300
  })
};

// Middleware factory
const createRateLimitMiddleware = (limiterName, keyGenerator = (req) => req.ip) => {
  return async (req, res, next) => {
    try {
      const limiter = rateLimiters[limiterName];
      if (!limiter) {
        return res.status(500).json({ error: 'Rate limiter not configured' });
      }

      const key = keyGenerator(req);
      await limiter.consume(key);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': limiter.points - 1,
        'X-RateLimit-Reset': new Date(Date.now() + limiter.duration * 1000)
      });

      next();
    } catch (rejRes) {
      // Rate limit exceeded
      const limiter = rateLimiters[limiterName];
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext)
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${limiterName}`,
        retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 1
      });
    }
  };
};

// Socket.IO rate limiting
const createSocketRateLimit = (limiterName, maxPoints = 100, duration = 60) => {
  const limiter = new RateLimiterMemory({
    keyPrefix: `socket:${limiterName}`,
    points: maxPoints,
    duration
  });

  return async (socketId) => {
    try {
      await limiter.consume(socketId);
      return true;
    } catch (rejRes) {
      return false;
    }
  };
};

// IP-based rate limiting for API endpoints
const apiRateLimit = createRateLimitMiddleware('api');
const streamCreationRateLimit = createRateLimitMiddleware('streamCreation', (req) => {
  return req.user?.id || req.ip;
});

// User-based rate limiting for authenticated endpoints
const userRateLimit = (limiterName) => {
  return createRateLimitMiddleware(limiterName, (req) => {
    return req.user?.id || req.ip;
  });
};

// WebSocket event rate limiting
const socketRateLimits = {
  chat: createSocketRateLimit('chat', 30, 60),
  tips: createSocketRateLimit('tips', 10, 60),
  webrtc: createSocketRateLimit('webrtc', 100, 60),
  connection: createSocketRateLimit('connection', 5, 60)
};

module.exports = {
  rateLimiters,
  createRateLimitMiddleware,
  createSocketRateLimit,
  apiRateLimit,
  streamCreationRateLimit,
  userRateLimit,
  socketRateLimits
};
