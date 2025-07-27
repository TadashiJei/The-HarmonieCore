const zlib = require('zlib');
const logger = require('./logger');

class StreamOptimizer {
  constructor() {
    this.compressionCache = new Map();
    this.frameCache = new Map();
    this.optimizationStats = {
      totalBytesSaved: 0,
      compressionRatio: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  // Ultra-fast video frame compression
  compressVideoFrame(frameData, quality = 'medium') {
    const startTime = Date.now();
    
    const compressionSettings = {
      ultraLow: { level: 9, threshold: 1024 },
      low: { level: 7, threshold: 2048 },
      medium: { level: 5, threshold: 4096 },
      high: { level: 3, threshold: 8192 }
    };

    const settings = compressionSettings[quality] || compressionSettings.medium;
    
    // Skip compression for very small frames
    if (frameData.length < settings.threshold) {
      return {
        data: frameData,
        compressed: false,
        compressionRatio: 1.0,
        processingTime: Date.now() - startTime
      };
    }

    try {
      const compressed = zlib.gzipSync(frameData, {
        level: settings.level,
        chunkSize: 16384,
        windowBits: 15,
        memLevel: 8
      });

      const compressionRatio = compressed.length / frameData.length;
      const bytesSaved = frameData.length - compressed.length;
      
      this.optimizationStats.totalBytesSaved += bytesSaved;
      this.optimizationStats.compressionRatio = 
        (this.optimizationStats.compressionRatio + compressionRatio) / 2;

      return {
        data: compressed,
        compressed: true,
        compressionRatio,
        bytesSaved,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Video compression failed', { error: error.message });
      return {
        data: frameData,
        compressed: false,
        compressionRatio: 1.0,
        processingTime: Date.now() - startTime
      };
    }
  }

  // Intelligent frame caching
  cacheFrame(frameId, frameData, metadata = {}) {
    const cacheKey = `${frameId}_${metadata.timestamp || Date.now()}`;
    
    // LRU cache implementation
    if (this.frameCache.size >= 100) { // Max 100 frames
      const firstKey = this.frameCache.keys().next().value;
      this.frameCache.delete(firstKey);
    }

    const cacheEntry = {
      data: frameData,
      metadata,
      timestamp: Date.now(),
      accessCount: 0,
      size: frameData.length
    };

    this.frameCache.set(cacheKey, cacheEntry);
    return cacheKey;
  }

  // Retrieve cached frame
  getCachedFrame(frameId) {
    for (const [key, entry] of this.frameCache) {
      if (key.startsWith(frameId)) {
        entry.accessCount++;
        this.optimizationStats.cacheHits++;
        return entry;
      }
    }
    
    this.optimizationStats.cacheMisses++;
    return null;
  }

  // Delta compression for video frames
  compressDeltaFrame(currentFrame, previousFrame) {
    if (!previousFrame) {
      return this.compressVideoFrame(currentFrame);
    }

    const startTime = Date.now();
    
    // Simple delta calculation (in real implementation, use proper video delta)
    const delta = Buffer.allocUnsafe(currentFrame.length);
    let changedBytes = 0;
    
    for (let i = 0; i < Math.min(currentFrame.length, previousFrame.length); i++) {
      const diff = currentFrame[i] - previousFrame[i];
      delta[i] = diff;
      if (diff !== 0) changedBytes++;
    }

    const changeRatio = changedBytes / currentFrame.length;
    
    // If very little changed, just send the delta
    if (changeRatio < 0.1) {
      const compressedDelta = zlib.gzipSync(delta, { level: 6 });
      
      return {
        data: compressedDelta,
        type: 'delta',
        changeRatio,
        compressionRatio: compressedDelta.length / currentFrame.length,
        processingTime: Date.now() - startTime
      };
    }

    // Too much changed, send full frame
    return this.compressVideoFrame(currentFrame);
  }

  // Audio compression with Opus-like optimization
  compressAudio(audioData, targetBitrate = 16000) {
    const startTime = Date.now();
    
    // Simulate Opus compression (in real implementation, use Opus encoder)
    const compressionRatio = Math.max(0.1, Math.min(0.3, 16000 / targetBitrate));
    const compressedSize = Math.floor(audioData.length * compressionRatio);
    
    // Create compressed buffer
    const compressed = Buffer.allocUnsafe(compressedSize);
    
    // Simple downsampling simulation
    for (let i = 0; i < compressedSize; i++) {
      const sourceIndex = Math.floor(i / compressionRatio);
      compressed[i] = audioData[Math.min(sourceIndex, audioData.length - 1)];
    }

    const finalCompressed = zlib.gzipSync(compressed, { level: 6 });
    
    return {
      data: finalCompressed,
      originalSize: audioData.length,
      compressedSize: finalCompressed.length,
      compressionRatio: finalCompressed.length / audioData.length,
      bitrate: targetBitrate,
      processingTime: Date.now() - startTime
    };
  }

  // Keyframe detection for efficient compression
  detectKeyframe(frameData, previousFrameData, threshold = 0.3) {
    if (!previousFrameData) return true;

    let differences = 0;
    const minLength = Math.min(frameData.length, previousFrameData.length);
    
    for (let i = 0; i < minLength; i += 4) { // Check every 4th byte for speed
      if (Math.abs(frameData[i] - previousFrameData[i]) > 10) {
        differences++;
      }
    }

    const changeRatio = differences / (minLength / 4);
    return changeRatio > threshold;
  }

  // Bandwidth-aware chunking
  chunkData(data, maxChunkSize = 8192) {
    const chunks = [];
    
    for (let i = 0; i < data.length; i += maxChunkSize) {
      chunks.push(data.slice(i, i + maxChunkSize));
    }

    return {
      chunks,
      chunkCount: chunks.length,
      totalSize: data.length,
      averageChunkSize: Math.ceil(data.length / chunks.length)
    };
  }

  // Priority-based transmission
  prioritizeTransmission(streamId, dataType, priority = 'normal') {
    const priorities = {
      critical: 1,    // Audio, control data
      high: 2,        // Video keyframes
      normal: 3,      // Regular video frames
      low: 4          // Metadata, thumbnails
    };

    const priorityLevel = priorities[priority] || priorities.normal;
    
    return {
      streamId,
      dataType,
      priority: priorityLevel,
      timestamp: Date.now(),
      estimatedTransmissionTime: this.estimateTransmissionTime(dataType, priorityLevel)
    };
  }

  // Estimate transmission time based on data size and priority
  estimateTransmissionTime(dataType, priority, dataSize = 1024) {
    const baseTime = dataSize / 1024; // ms per KB
    const priorityMultiplier = priority; // Higher priority = faster
    
    return Math.max(1, baseTime / priorityMultiplier);
  }

  // Real-time optimization stats
  getOptimizationStats() {
    const totalRequests = this.optimizationStats.cacheHits + this.optimizationStats.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? 
      (this.optimizationStats.cacheHits / totalRequests * 100).toFixed(2) : 0;

    return {
      ...this.optimizationStats,
      cacheHitRate: `${cacheHitRate}%`,
      activeCacheEntries: this.frameCache.size,
      totalCacheSize: Array.from(this.frameCache.values())
        .reduce((total, entry) => total + entry.size, 0)
    };
  }

  // Memory management
  cleanupCache(maxAge = 300000) { // 5 minutes
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.frameCache) {
      if (now - entry.timestamp > maxAge) {
        this.frameCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} expired cache entries`);
    }

    return cleaned;
  }

  // Reset optimization stats
  resetStats() {
    this.optimizationStats = {
      totalBytesSaved: 0,
      compressionRatio: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  // Get compression recommendations
  getCompressionRecommendation(connectionType, deviceType) {
    const recommendations = {
      'slow-2g': { quality: 'ultraLow', compression: 9, chunkSize: 2048 },
      '2g': { quality: 'ultraLow', compression: 8, chunkSize: 4096 },
      '3g': { quality: 'low', compression: 7, chunkSize: 6144 },
      '4g': { quality: 'medium', compression: 5, chunkSize: 8192 },
      'wifi': { quality: 'high', compression: 3, chunkSize: 16384 },
      'ethernet': { quality: 'high', compression: 2, chunkSize: 32768 }
    };

    // Mobile devices get more aggressive compression
    const mobileMultiplier = deviceType === 'mobile' ? 0.7 : 1.0;
    const base = recommendations[connectionType] || recommendations['wifi'];
    
    return {
      ...base,
      chunkSize: Math.floor(base.chunkSize * mobileMultiplier)
    };
  }
}

module.exports = StreamOptimizer;
