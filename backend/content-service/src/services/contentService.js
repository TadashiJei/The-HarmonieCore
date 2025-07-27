/**
 * Content Management Service
 * Handles content upload, metadata management, IPFS storage, and CDN integration for HarmonieCore
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { create, globSource } = require('ipfs-http-client');
const { Web3Storage } = require('web3.storage');
const pinataSDK = require('@pinata/sdk');
const axios = require('axios');
const redis = require('redis');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

class ContentService {
  constructor() {
    // IPFS clients
    this.ipfs = create({
      host: process.env.IPFS_HOST || 'localhost',
      port: process.env.IPFS_PORT || 5001,
      protocol: process.env.IPFS_PROTOCOL || 'http'
    });

    this.web3Storage = new Web3Storage({
      token: process.env.WEB3_STORAGE_TOKEN
    });

    this.pinata = new pinataSDK(
      process.env.PINATA_API_KEY,
      process.env.PINATA_SECRET_KEY
    );

    this.redis = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || ''
    });

    this.cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.harmoniecore.com';
    this.supportedFormats = {
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'],
      audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
      document: ['pdf', 'doc', 'docx', 'txt', 'json']
    };
  }

  /**
   * Upload content with metadata and IPFS storage
   */
  async uploadContent({ file, metadata, userId, options = {} }) {
    try {
      const contentId = crypto.randomUUID();
      const uploadStart = Date.now();

      // Validate file
      const validation = await this.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Generate file metadata
      const fileMetadata = await this.generateFileMetadata(file, metadata);
      
      // Process file (resize, compress, generate thumbnails)
      const processedFiles = await this.processFile(file, options);

      // Upload to IPFS
      const ipfsResult = await this.uploadToIPFS(processedFiles, fileMetadata);

      // Upload to CDN
      const cdnResult = await this.uploadToCDN(processedFiles, contentId);

      // Create content record
      const contentRecord = {
        id: contentId,
        userId,
        originalName: file.originalname,
        fileName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        type: validation.type,
        metadata: {
          ...metadata,
          ...fileMetadata,
          ipfs: ipfsResult,
          cdn: cdnResult
        },
        status: 'uploaded',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in Redis for caching
      await this.redis.setEx(`content:${contentId}`, 86400, JSON.stringify(contentRecord));

      // Log upload metrics
      const uploadTime = Date.now() - uploadStart;
      logger.info('Content uploaded', {
        contentId,
        userId,
        type: validation.type,
        size: file.size,
        uploadTime: `${uploadTime}ms`
      });

      return contentRecord;
    } catch (error) {
      logger.error('Error uploading content:', error);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  async validateFile(file) {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const extension = path.extname(file.originalname).toLowerCase().slice(1);

    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds 100MB limit' };
    }

    let type = null;
    for (const [category, extensions] of Object.entries(this.supportedFormats)) {
      if (extensions.includes(extension)) {
        type = category;
        break;
      }
    }

    if (!type) {
      return { valid: false, error: 'Unsupported file format' };
    }

    return { valid: true, type, extension };
  }

  /**
   * Generate comprehensive file metadata
   */
  async generateFileMetadata(file, userMetadata) {
    const metadata = {
      fileHash: await this.calculateFileHash(file.path),
      dimensions: null,
      duration: null,
      bitrate: null,
      codec: null,
      colorProfile: null,
      orientation: null,
      gps: null,
      exif: null
    };

    try {
      if (file.mimetype.startsWith('image/')) {
        const image = sharp(file.path);
        const info = await image.metadata();
        
        metadata.dimensions = {
          width: info.width,
          height: info.height
        };
        metadata.colorProfile = info.icc;
        metadata.orientation = info.orientation;
        
        // Extract EXIF data
        const exif = await image.metadata().then(meta => meta.exif);
        if (exif) {
          metadata.exif = this.sanitizeExif(exif);
        }
      }

      if (file.mimetype.startsWith('video/')) {
        const videoInfo = await this.getVideoMetadata(file.path);
        metadata.dimensions = videoInfo.dimensions;
        metadata.duration = videoInfo.duration;
        metadata.bitrate = videoInfo.bitrate;
        metadata.codec = videoInfo.codec;
      }

      if (file.mimetype.startsWith('audio/')) {
        const audioInfo = await this.getAudioMetadata(file.path);
        metadata.duration = audioInfo.duration;
        metadata.bitrate = audioInfo.bitrate;
        metadata.codec = audioInfo.codec;
      }
    } catch (error) {
      logger.warn('Error extracting metadata:', error);
    }

    return { ...metadata, ...userMetadata };
  }

  /**
   * Process file for different formats and sizes
   */
  async processFile(file, options) {
    const processedFiles = [];
    const outputDir = path.join(__dirname, '../../uploads/processed');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = crypto.randomUUID();

    if (file.mimetype.startsWith('image/')) {
      processedFiles.push(...await this.processImage(file, baseName, options));
    } else if (file.mimetype.startsWith('video/')) {
      processedFiles.push(...await this.processVideo(file, baseName, options));
    } else if (file.mimetype.startsWith('audio/')) {
      processedFiles.push(...await this.processAudio(file, baseName, options));
    } else {
      // Document processing
      processedFiles.push({
        path: file.path,
        type: 'original',
        size: 'original'
      });
    }

    return processedFiles;
  }

  /**
   * Process image files with multiple sizes and formats
   */
  async processImage(file, baseName, options) {
    const sizes = [
      { name: 'thumbnail', width: 150, height: 150 },
      { name: 'small', width: 400, height: 400 },
      { name: 'medium', width: 800, height: 800 },
      { name: 'large', width: 1200, height: 1200 },
      { name: 'original', width: null, height: null }
    ];

    const formats = options.formats || ['webp', 'jpeg'];
    const processedFiles = [];

    for (const size of sizes) {
      for (const format of formats) {
        const outputPath = path.join(
          __dirname, 
          '../../uploads/processed', 
          `${baseName}_${size.name}.${format}`
        );

        let image = sharp(file.path);
        
        if (size.width && size.height) {
          image = image.resize(size.width, size.height, { fit: 'inside' });
        }

        if (format === 'webp') {
          image = image.webp({ quality: 80 });
        } else if (format === 'jpeg') {
          image = image.jpeg({ quality: 85 });
        }

        await image.toFile(outputPath);

        processedFiles.push({
          path: outputPath,
          type: size.name,
          format,
          size: size.name
        });
      }
    }

    return processedFiles;
  }

  /**
   * Process video files with transcoding and thumbnails
   */
  async processVideo(file, baseName, options) {
    const processedFiles = [];
    const resolutions = [
      { name: '240p', width: 426, height: 240 },
      { name: '480p', width: 854, height: 480 },
      { name: '720p', width: 1280, height: 720 },
      { name: '1080p', width: 1920, height: 1080 }
    ];

    for (const resolution of resolutions) {
      const outputPath = path.join(
        __dirname,
        '../../uploads/processed',
        `${baseName}_${resolution.name}.mp4`
      );

      await new Promise((resolve, reject) => {
        ffmpeg(file.path)
          .videoCodec('libx264')
          .audioCodec('aac')
          .size(`${resolution.width}x${resolution.height}`)
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      processedFiles.push({
        path: outputPath,
        type: resolution.name,
        format: 'mp4',
        size: resolution.name
      });
    }

    // Generate thumbnail
    const thumbnailPath = path.join(
      __dirname,
      '../../uploads/processed',
      `${baseName}_thumbnail.jpg`
    );

    await new Promise((resolve, reject) => {
      ffmpeg(file.path)
        .screenshots({
          timestamps: ['10%'],
          filename: `${baseName}_thumbnail.jpg`,
          folder: path.dirname(thumbnailPath),
          size: '320x240'
        })
        .on('end', resolve)
        .on('error', reject);
    });

    processedFiles.push({
      path: thumbnailPath,
      type: 'thumbnail',
      format: 'jpg',
      size: 'thumbnail'
    });

    return processedFiles;
  }

  /**
   * Process audio files with transcoding
   */
  async processAudio(file, baseName, options) {
    const processedFiles = [];
    const formats = options.audioFormats || ['mp3', 'aac'];

    for (const format of formats) {
      const outputPath = path.join(
        __dirname,
        '../../uploads/processed',
        `${baseName}.${format}`
      );

      await new Promise((resolve, reject) => {
        ffmpeg(file.path)
          .audioCodec(format === 'mp3' ? 'libmp3lame' : 'aac')
          .audioBitrate(128)
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      processedFiles.push({
        path: outputPath,
        type: 'audio',
        format,
        size: 'standard'
      });
    }

    return processedFiles;
  }

  /**
   * Upload files to IPFS
   */
  async uploadToIPFS(processedFiles, metadata) {
    try {
      const results = [];

      // Upload to IPFS via HTTP client
      for (const file of processedFiles) {
        const fileBuffer = fs.readFileSync(file.path);
        const ipfsResult = await this.ipfs.add(fileBuffer);
        
        results.push({
          cid: ipfsResult.cid.toString(),
          size: ipfsResult.size,
          type: file.type,
          format: file.format
        });
      }

      // Upload metadata to IPFS
      const metadataBuffer = Buffer.from(JSON.stringify(metadata));
      const metadataResult = await this.ipfs.add(metadataBuffer);

      return {
        files: results,
        metadataCid: metadataResult.cid.toString(),
        gatewayUrl: `https://ipfs.io/ipfs/${metadataResult.cid}`
      };
    } catch (error) {
      logger.error('Error uploading to IPFS:', error);
      throw error;
    }
  }

  /**
   * Upload to CDN
   */
  async uploadToCDN(processedFiles, contentId) {
    try {
      const cdnUrls = [];

      for (const file of processedFiles) {
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(file.path);
        
        formData.append('file', new Blob([fileBuffer]), path.basename(file.path));
        formData.append('contentId', contentId);
        formData.append('type', file.type);

        const response = await axios.post(`${this.cdnBaseUrl}/api/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${process.env.CDN_API_KEY}`
          }
        });

        cdnUrls.push({
          type: file.type,
          url: response.data.url,
          size: response.data.size
        });
      }

      return {
        baseUrl: this.cdnBaseUrl,
        files: cdnUrls
      };
    } catch (error) {
      logger.error('Error uploading to CDN:', error);
      throw error;
    }
  }

  /**
   * Get content by ID
   */
  async getContent(contentId) {
    try {
      // Check Redis cache first
      const cached = await this.redis.get(`content:${contentId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // TODO: Query database
      return null;
    } catch (error) {
      logger.error('Error getting content:', error);
      throw error;
    }
  }

  /**
   * Search content
   */
  async searchContent(query, filters = {}) {
    try {
      // TODO: Implement search with MongoDB
      return [];
    } catch (error) {
      logger.error('Error searching content:', error);
      throw error;
    }
  }

  /**
   * Delete content
   */
  async deleteContent(contentId, userId) {
    try {
      // TODO: Implement soft delete
      await this.redis.del(`content:${contentId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting content:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  async calculateFileHash(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          dimensions: {
            width: videoStream.width,
            height: videoStream.height
          },
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          codec: videoStream.codec_name
        });
      });
    });
  }

  async getAudioMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        resolve({
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          codec: audioStream.codec_name
        });
      });
    });
  }

  sanitizeExif(exif) {
    // Remove sensitive EXIF data
    const sanitized = {};
    const allowed = ['Make', 'Model', 'Orientation', 'DateTime'];
    
    for (const key of allowed) {
      if (exif[key]) {
        sanitized[key] = exif[key];
      }
    }
    
    return sanitized;
  }
}

module.exports = ContentService;
