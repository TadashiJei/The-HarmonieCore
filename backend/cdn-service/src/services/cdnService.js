/**
 * HarmonieCORE CDN Service
 * Global content delivery network with edge caching and mobile optimization
 * Features: Multi-region edge nodes, adaptive bitrate streaming, mobile-first design
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const redis = require('redis');
const logger = require('../utils/logger');

class CDNService extends EventEmitter {
  constructor() {
    super();
    
    // Global CDN configuration
    this.config = {
      regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'],
      edgeNodes: 50,
      cacheTTL: {
        images: 86400, // 24 hours
        videos: 604800, // 7 days
        audio: 604800, // 7 days
        metadata: 3600, // 1 hour
        thumbnails: 86400 // 24 hours
      },
      compression: {
        images: { quality: 85, progressive: true },
        videos: { bitrate: 'adaptive', codec: 'h264' },
        audio: { bitrate: 'adaptive', codec: 'aac' }
      },
      mobileOptimization: {
        maxImageSize: 1024, // 1MB
        maxVideoBitrate: 1000, // 1Mbps
        maxAudioBitrate: 128, // 128kbps
        adaptiveQuality: true,
        dataSaving: true
      },
      security: {
        signedUrls: true,
        tokenExpiration: 3600, // 1 hour
        rateLimit: 1000 // requests per hour
      }
    };

    // Storage backends
    this.storage = {
      primary: 'aws-s3',
      cache: 'redis',
      cdn: 'cloudflare'
    };

    // Performance tracking
    this.metrics = {
      cacheHitRate: 0,
      responseTime: 0,
      bandwidthSaved: 0,
      mobileDataSaved: 0
    };

    this.initializeServices();
  }

  /**
   * Initialize CDN services
   */
  async initializeServices() {
    try {
      await this.setupRedis();
      await this.setupCloudStorage();
      await this.setupEdgeNodes();
      this.startHealthCheck();
      this.startCacheCleanup();
      
      logger.info('CDN Service initialized successfully');
    } catch (error) {
      logger.error('Error initializing CDN Service:', error);
    }
  }

  /**
   * Setup Redis for caching
   */
  async setupRedis() {
    this.redis = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: 1
    });

    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Connected to Redis cache');
    });

    await this.redis.connect();
  }

  /**
   * Setup cloud storage
   */
  async setupCloudStorage() {
    const AWS = require('aws-sdk');
    
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.cloudFront = new AWS.CloudFront();
    
    logger.info('Cloud storage configured');
  }

  /**
   * Setup edge nodes globally
   */
  async setupEdgeNodes() {
    this.edgeNodes = this.config.regions.map(region => ({
      region,
      endpoint: `https://cdn-${region}.harmoniecore.com`,
      status: 'active',
      lastHealthCheck: new Date(),
      cacheSize: 0,
      requests: 0
    }));

    logger.info(`Initialized ${this.edgeNodes.length} edge nodes`);
  }

  /**
   * Upload content with optimization
   */
  async uploadContent(content, options = {}) {
    try {
      const {
        type = 'image',
        filename,
        metadata = {},
        optimizeForMobile = true,
        generateThumbnails = true
      } = options;

      const contentId = uuidv4();
      const optimizedContent = await this.optimizeContent(content, type, optimizeForMobile);
      
      // Upload to primary storage
      const primaryUrl = await this.uploadToStorage(optimizedContent, {
        contentId,
        type,
        filename,
        metadata
      });

      // Generate thumbnails if needed
      let thumbnails = {};
      if (generateThumbnails && type === 'image') {
        thumbnails = await this.generateThumbnails(content, contentId);
      }

      // Pre-cache content
      await this.preCacheContent(contentId, {
        primaryUrl,
        thumbnails,
        metadata,
        type
      });

      // Generate CDN URLs
      const cdnUrls = this.generateCDNUrls(contentId, type);

      this.emit('content-uploaded', {
        contentId,
        primaryUrl,
        cdnUrls,
        thumbnails,
        optimized: optimizeForMobile
      });

      return {
        contentId,
        urls: cdnUrls,
        thumbnails,
        metadata: {
          size: optimizedContent.length,
          type,
          optimized: optimizeForMobile
        }
      };
    } catch (error) {
      logger.error('Error uploading content:', error);
      throw error;
    }
  }

  /**
   * Optimize content for mobile delivery
   */
  async optimizeContent(content, type, optimizeForMobile = true) {
    try {
      switch (type) {
        case 'image':
          return await this.optimizeImage(content, optimizeForMobile);
        case 'video':
          return await this.optimizeVideo(content, optimizeForMobile);
        case 'audio':
          return await this.optimizeAudio(content, optimizeForMobile);
        default:
          return content;
      }
    } catch (error) {
      logger.error('Error optimizing content:', error);
      return content;
    }
  }

  /**
   * Optimize images for mobile
   */
  async optimizeImage(imageBuffer, optimizeForMobile = true) {
    let image = sharp(imageBuffer);

    if (optimizeForMobile) {
      image = image
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .withMetadata();
    }

    return await image.toBuffer();
  }

  /**
   * Optimize videos for mobile streaming
   */
  async optimizeVideo(videoBuffer, optimizeForMobile = true) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      const command = ffmpeg()
        .input(videoBuffer)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4');

      if (optimizeForMobile) {
        command
          .size('720x?')
          .videoBitrate('1000k')
          .audioBitrate('128k')
          .outputOptions([
            '-movflags +faststart',
            '-preset fast',
            '-crf 23'
          ]);
      }

      command
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject)
        .pipe();
    });
  }

  /**
   * Optimize audio for mobile streaming
   */
  async optimizeAudio(audioBuffer, optimizeForMobile = true) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      const command = ffmpeg()
        .input(audioBuffer)
        .audioCodec('aac')
        .format('mp4');

      if (optimizeForMobile) {
        command.audioBitrate('128k');
      }

      command
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject)
        .pipe();
    });
  }

  /**
   * Generate thumbnails for images
   */
  async generateThumbnails(imageBuffer, contentId) {
    const sizes = [64, 128, 256, 512];
    const thumbnails = {};

    for (const size of sizes) {
      const thumbnail = await sharp(imageBuffer)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailUrl = await this.uploadToStorage(thumbnail, {
        contentId: `${contentId}_thumb_${size}`,
        type: 'image',
        filename: `thumb_${size}.jpg`
      });

      thumbnails[size] = thumbnailUrl;
    }

    return thumbnails;
  }

  /**
   * Serve content with caching
   */
  async serveContent(contentId, options = {}) {
    try {
      const {
        quality = 'auto',
        format = 'original',
        width = null,
        height = null,
        optimizeForMobile = true
      } = options;

      // Check cache first
      const cacheKey = `content:${contentId}:${quality}:${format}:${width}:${height}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        this.metrics.cacheHitRate++;
        return JSON.parse(cached);
      }

      // Get content from storage
      const content = await this.getFromStorage(contentId);
      
      // Process content based on parameters
      const processedContent = await this.processContent(content, {
        quality,
        format,
        width,
        height,
        optimizeForMobile
      });

      // Cache the processed content
      await this.redis.setex(cacheKey, this.config.cacheTTL[content.type] || 3600, 
        JSON.stringify(processedContent));

      // Update metrics
      this.updateMetrics(processedContent);

      return processedContent;
    } catch (error) {
      logger.error('Error serving content:', error);
      throw error;
    }
  }

  /**
   * Process content based on parameters
   */
  async processContent(content, options) {
    const { quality, format, width, height, optimizeForMobile } = options;
    
    if (content.type === 'image' && (width || height)) {
      return await this.resizeImage(content.data, width, height, quality);
    }

    if (content.type === 'video' && quality !== 'original') {
      return await this.transcodeVideo(content.data, quality);
    }

    return content;
  }

  /**
   * Resize image on-the-fly
   */
  async resizeImage(imageBuffer, width, height, quality) {
    const image = sharp(imageBuffer);
    
    if (width || height) {
      image.resize(width, height, { fit: 'inside', withoutEnlargement: true });
    }

    if (quality !== 'original') {
      image.jpeg({ quality: parseInt(quality) || 85 });
    }

    return await image.toBuffer();
  }

  /**
   * Transcode video for adaptive streaming
   */
  async transcodeVideo(videoBuffer, quality) {
    const qualityMap = {
      'low': { bitrate: '500k', resolution: '480p' },
      'medium': { bitrate: '1000k', resolution: '720p' },
      'high': { bitrate: '2000k', resolution: '1080p' },
      'auto': { bitrate: 'adaptive', resolution: 'auto' }
    };

    const settings = qualityMap[quality] || qualityMap['medium'];
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      ffmpeg()
        .input(videoBuffer)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(settings.resolution)
        .videoBitrate(settings.bitrate)
        .format('mp4')
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject)
        .pipe();
    });
  }

  /**
   * Generate signed URLs for secure access
   */
  async generateSignedUrl(contentId, expiresIn = 3600) {
    const token = uuidv4();
    const expires = Date.now() + (expiresIn * 1000);
    
    const signedUrl = {
      url: `https://cdn.harmoniecore.com/content/${contentId}?token=${token}`,
      token,
      expires,
      contentId
    };

    // Store token in Redis
    await this.redis.setex(`token:${token}`, expiresIn, JSON.stringify(signedUrl));

    return signedUrl;
  }

  /**
   * Validate signed URL
   */
  async validateSignedUrl(token) {
    const data = await this.redis.get(`token:${token}`);
    if (!data) return null;

    const signedUrl = JSON.parse(data);
    if (Date.now() > signedUrl.expires) {
      await this.redis.del(`token:${token}`);
      return null;
    }

    return signedUrl;
  }

  /**
   * Get CDN performance metrics
   */
  async getMetrics() {
    const totalRequests = await this.redis.get('metrics:total_requests') || 0;
    const cacheHits = await this.redis.get('metrics:cache_hits') || 0;
    const cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

    return {
      cacheHitRate: Math.round(cacheHitRate),
      totalRequests: parseInt(totalRequests),
      cacheHits: parseInt(cacheHits),
      edgeNodes: this.edgeNodes.map(node => ({
        region: node.region,
        requests: node.requests,
        status: node.status
      })),
      mobileDataSaved: this.metrics.mobileDataSaved,
      bandwidthSaved: this.metrics.bandwidthSaved
    };
  }

  /**
   * Update performance metrics
   */
  updateMetrics(content) {
    this.metrics.bandwidthSaved += content.originalSize - content.compressedSize;
    this.metrics.mobileDataSaved += content.mobileOptimized ? content.savedSize : 0;
  }

  /**
   * Upload to cloud storage
   */
  async uploadToStorage(content, options) {
    const { contentId, type, filename, metadata } = options;
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET || 'harmoniecore-cdn',
      Key: `${type}/${contentId}/${filename}`,
      Body: content,
      ContentType: this.getContentType(type, filename),
      Metadata: metadata,
      CacheControl: `max-age=${this.config.cacheTTL[type] || 3600}`
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  /**
   * Get from storage
   */
  async getFromStorage(contentId) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET || 'harmoniecore-cdn',
      Key: contentId
    };

    const result = await this.s3.getObject(params).promise();
    return {
      data: result.Body,
      type: this.detectType(result.ContentType),
      metadata: result.Metadata
    };
  }

  /**
   * Pre-cache content globally
   */
  async preCacheContent(contentId, data) {
    const cacheData = {
      contentId,
      urls: data.cdnUrls,
      thumbnails: data.thumbnails,
      metadata: data.metadata,
      timestamp: new Date().toISOString()
    };

    // Cache in Redis
    await this.redis.setex(`content:${contentId}`, 86400, JSON.stringify(cacheData));

    // Pre-warm edge caches
    for (const node of this.edgeNodes) {
      await this.warmEdgeCache(node.region, contentId, cacheData);
    }
  }

  /**
   * Warm edge cache
   */
  async warmEdgeCache(region, contentId, data) {
    const cacheKey = `edge:${region}:${contentId}`;
    await this.redis.setex(cacheKey, 3600, JSON.stringify(data));
  }

  /**
   * Health check for edge nodes
   */
  async healthCheck() {
    const healthStatus = [];

    for (const node of this.edgeNodes) {
      try {
        const response = await fetch(`${node.endpoint}/health`, { timeout: 5000 });
        node.status = response.ok ? 'active' : 'down';
        node.lastHealthCheck = new Date();
        node.requests = await this.getNodeRequests(node.region);
        
        healthStatus.push({
          region: node.region,
          status: node.status,
          responseTime: response.ok ? Date.now() - node.lastHealthCheck : null
        });
      } catch (error) {
        node.status = 'down';
        healthStatus.push({
          region: node.region,
          status: 'down',
          error: error.message
        });
      }
    }

    return healthStatus;
  }

  /**
   * Get requests for specific node
   */
  async getNodeRequests(region) {
    const count = await this.redis.get(`requests:${region}`);
    return parseInt(count) || 0;
  }

  /**
   * Start health check scheduler
   */
  startHealthCheck() {
    setInterval(async () => {
      await this.healthCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start cache cleanup scheduler
   */
  startCacheCleanup() {
    setInterval(async () => {
      await this.cleanupExpiredCache();
    }, 3600000); // Clean every hour
  }

  /**
   * Clean expired cache entries
   */
  async cleanupExpiredCache() {
    const keys = await this.redis.keys('content:*');
    const expired = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const content = JSON.parse(data);
        if (new Date(content.timestamp) < new Date(Date.now() - 86400000)) {
          expired.push(key);
        }
      }
    }

    if (expired.length > 0) {
      await this.redis.del(...expired);
      logger.info(`Cleaned up ${expired.length} expired cache entries`);
    }
  }

  /**
   * Utility methods
   */
  getContentType(type, filename) {
    const mime = require('mime-types');
    return mime.lookup(filename) || 'application/octet-stream';
  }

  detectType(contentType) {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    return 'other';
  }

  /**
   * Generate CDN URLs for all regions
   */
  generateCDNUrls(contentId, type) {
    const urls = {};
    
    this.config.regions.forEach(region => {
      urls[region] = `https://cdn-${region}.harmoniecore.com/${type}/${contentId}`;
    });

    return urls;
  }
}

module.exports = CDNService;
