/**
 * HarmonieCORE Recording Service
 * Ultra-optimized recording with mobile data efficiency
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const StreamOptimizer = require('../utils/streamOptimizer');

class RecordingService extends EventEmitter {
  constructor() {
    super();
    this.activeRecordings = new Map();
    this.completedRecordings = new Map();
    this.recordingQueue = [];
    this.streamOptimizer = new StreamOptimizer();
    
    // Mobile-optimized recording settings
    this.settings = {
      maxRecordingSize: 500 * 1024 * 1024, // 500MB max
      chunkDuration: 30000, // 30 second chunks
      compressionLevel: 9, // Maximum compression
      mobileQuality: {
        video: { bitrate: 300000, width: 480, height: 360, fps: 20 },
        audio: { bitrate: 32000, sampleRate: 16000, channels: 1 }
      },
      desktopQuality: {
        video: { bitrate: 1000000, width: 1280, height: 720, fps: 30 },
        audio: { bitrate: 128000, sampleRate: 44100, channels: 2 }
      },
      storagePath: process.env.RECORDING_STORAGE || './recordings',
      retentionDays: 30
    };

    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.settings.storagePath, { recursive: true });
      logger.info('RecordingService: Storage directory ready');
    } catch (error) {
      logger.error('RecordingService: Failed to create storage directory', error);
    }
  }

  /**
   * Start recording for a stream
   */
  async startRecording(streamId, streamData, options = {}) {
    if (this.activeRecordings.has(streamId)) {
      throw new Error('Recording already active for this stream');
    }

    const recordingId = uuidv4();
    const deviceType = options.deviceType || 'desktop';
    const quality = deviceType === 'mobile' ? 'mobileQuality' : 'desktopQuality';

    const recording = {
      id: recordingId,
      streamId,
      title: streamData.title,
      artistId: streamData.artistId,
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      size: 0,
      chunks: [],
      status: 'recording',
      deviceType,
      quality: this.settings[quality],
      compression: {
        enabled: true,
        level: this.settings.compressionLevel,
        estimatedSavings: 0
      },
      metadata: {
        originalBitrate: 0,
        compressedBitrate: 0,
        compressionRatio: 0,
        mobileOptimized: deviceType === 'mobile'
      },
      storage: {
        path: path.join(this.settings.storagePath, streamId),
        filename: `${recordingId}.webm`,
        tempChunks: []
      }
    };

    // Create recording directory
    await fs.mkdir(recording.storage.path, { recursive: true });

    this.activeRecordings.set(streamId, recording);

    // Start chunk recording
    this.startChunkRecording(streamId, recording);

    logger.info(`RecordingService: Started recording ${recordingId} for stream ${streamId}`, {
      deviceType,
      quality: recording.quality
    });

    this.emit('recording-started', recording);
    return recording;
  }

  /**
   * Start chunk-based recording for mobile optimization
   */
  async startChunkRecording(streamId, recording) {
    const chunkInterval = setInterval(async () => {
      const activeRecording = this.activeRecordings.get(streamId);
      if (!activeRecording || activeRecording.status !== 'recording') {
        clearInterval(chunkInterval);
        return;
      }

      await this.recordChunk(streamId, recording);
    }, this.settings.chunkDuration);

    recording.chunkInterval = chunkInterval;
  }

  /**
   * Record a chunk of the stream
   */
  async recordChunk(streamId, recording) {
    try {
      const chunkId = uuidv4();
      const chunkPath = path.join(recording.storage.path, `${chunkId}.chunk`);
      
      const chunk = {
        id: chunkId,
        startTime: new Date().toISOString(),
        duration: this.settings.chunkDuration,
        size: 0,
        path: chunkPath,
        compressed: recording.compression.enabled
      };

      // In a real implementation, this would capture the actual stream data
      // For now, we'll simulate the chunk creation
      const simulatedData = this.generateSimulatedChunk(recording);
      
      // Apply compression if enabled
      let finalData = simulatedData;
      if (recording.compression.enabled) {
        finalData = await this.compressChunk(simulatedData, recording.compression.level);
      }

      // Save chunk
      await fs.writeFile(chunkPath, finalData);
      
      chunk.size = finalData.length;
      recording.chunks.push(chunk);
      recording.size += chunk.size;

      // Update compression metrics
      if (recording.compression.enabled) {
        const compressionRatio = finalData.length / simulatedData.length;
        recording.compression.estimatedSavings += (simulatedData.length - finalData.length);
        recording.metadata.compressionRatio = compressionRatio;
      }

      // Check storage limit
      if (recording.size > this.settings.maxRecordingSize) {
        logger.warn(`RecordingService: Size limit reached for stream ${streamId}`);
        await this.stopRecording(streamId);
      }

      this.emit('chunk-recorded', { streamId, chunk, recording });

    } catch (error) {
      logger.error(`RecordingService: Error recording chunk for ${streamId}`, error);
    }
  }

  /**
   * Generate simulated chunk data (replace with actual stream capture)
   */
  generateSimulatedChunk(recording) {
    const duration = this.settings.chunkDuration / 1000; // seconds
    const videoBitrate = recording.quality.video.bitrate;
    const audioBitrate = recording.quality.audio.bitrate;
    
    // Calculate approximate data size
    const totalBits = (videoBitrate + audioBitrate) * duration;
    const totalBytes = Math.floor(totalBits / 8);
    
    // Create simulated data
    return Buffer.alloc(totalBytes, 0);
  }

  /**
   * Compress chunk data
   */
  async compressChunk(data, level) {
    // In a real implementation, use video compression
    // For now, simulate compression
    const compressionRatio = 1 - (level * 0.1); // 10% compression per level
    const compressedSize = Math.floor(data.length * compressionRatio);
    
    return Buffer.alloc(compressedSize, 0);
  }

  /**
   * Stop recording
   */
  async stopRecording(streamId) {
    const recording = this.activeRecordings.get(streamId);
    if (!recording) {
      throw new Error('No active recording for this stream');
    }

    recording.status = 'completed';
    recording.endTime = new Date().toISOString();
    recording.duration = new Date(recording.endTime) - new Date(recording.startTime);

    // Stop chunk recording
    if (recording.chunkInterval) {
      clearInterval(recording.chunkInterval);
    }

    // Finalize recording
    await this.finalizeRecording(streamId, recording);

    // Move from active to completed
    this.activeRecordings.delete(streamId);
    this.completedRecordings.set(recording.id, recording);

    logger.info(`RecordingService: Completed recording ${recording.id}`, {
      duration: recording.duration,
      size: recording.size,
      chunks: recording.chunks.length,
      compression: recording.compression
    });

    this.emit('recording-completed', recording);
    return recording;
  }

  /**
   * Finalize recording by combining chunks
   */
  async finalizeRecording(streamId, recording) {
    try {
      const finalPath = path.join(recording.storage.path, recording.storage.filename);
      
      // Combine all chunks
      const combinedData = await this.combineChunks(recording.chunks);
      
      // Save final recording
      await fs.writeFile(finalPath, combinedData);
      
      // Clean up temporary chunks
      await this.cleanupChunks(recording.chunks);
      
      // Update final size
      recording.size = combinedData.length;
      recording.storage.finalPath = finalPath;
      
      // Generate metadata file
      await this.generateMetadata(recording);

      logger.info(`RecordingService: Finalized recording ${recording.id}`, {
        finalPath,
        size: recording.size
      });

    } catch (error) {
      logger.error(`RecordingService: Error finalizing recording ${recording.id}`, error);
      recording.status = 'failed';
    }
  }

  /**
   * Combine all chunks into final recording
   */
  async combineChunks(chunks) {
    let combined = Buffer.alloc(0);
    
    for (const chunk of chunks) {
      try {
        const chunkData = await fs.readFile(chunk.path);
        combined = Buffer.concat([combined, chunkData]);
      } catch (error) {
        logger.warn(`RecordingService: Could not read chunk ${chunk.id}`);
      }
    }
    
    return combined;
  }

  /**
   * Clean up temporary chunk files
   */
  async cleanupChunks(chunks) {
    for (const chunk of chunks) {
      try {
        await fs.unlink(chunk.path);
      } catch (error) {
        logger.warn(`RecordingService: Could not delete chunk ${chunk.id}`);
      }
    }
  }

  /**
   * Generate recording metadata
   */
  async generateMetadata(recording) {
    const metadata = {
      id: recording.id,
      streamId: recording.streamId,
      title: recording.title,
      artistId: recording.artistId,
      startTime: recording.startTime,
      endTime: recording.endTime,
      duration: recording.duration,
      size: recording.size,
      deviceType: recording.deviceType,
      quality: recording.quality,
      compression: recording.compression,
      metadata: recording.metadata,
      chunks: recording.chunks.length,
      storagePath: recording.storage.finalPath,
      url: `/recordings/${recording.id}`
    };

    const metadataPath = path.join(recording.storage.path, `${recording.id}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    recording.metadataFile = metadataPath;
  }

  /**
   * Get recording information
   */
  async getRecording(recordingId) {
    const recording = this.completedRecordings.get(recordingId);
    if (recording) {
      return recording;
    }

    // Check file system for recording
    const recordingPath = path.join(this.settings.storagePath, '**', `${recordingId}.json`);
    try {
      const files = await fs.readdir(this.settings.storagePath, { recursive: true });
      const metadataFile = files.find(f => f.endsWith(`${recordingId}.json`));
      
      if (metadataFile) {
        const metadata = await fs.readFile(metadataFile, 'utf8');
        return JSON.parse(metadata);
      }
    } catch (error) {
      logger.warn(`RecordingService: Could not find recording ${recordingId}`);
    }

    return null;
  }

  /**
   * Get recordings for a stream
   */
  async getStreamRecordings(streamId) {
    const recordings = [];
    
    // Check active recordings
    const active = this.activeRecordings.get(streamId);
    if (active) {
      recordings.push(active);
    }

    // Check completed recordings
    for (const [id, recording] of this.completedRecordings) {
      if (recording.streamId === streamId) {
        recordings.push(recording);
      }
    }

    // Check file system
    try {
      const streamPath = path.join(this.settings.storagePath, streamId);
      const files = await fs.readdir(streamPath);
      const metadataFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of metadataFiles) {
        const metadata = await fs.readFile(path.join(streamPath, file), 'utf8');
        const recording = JSON.parse(metadata);
        if (!recordings.find(r => r.id === recording.id)) {
          recordings.push(recording);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty
    }

    return recordings.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }

  /**
   * Get active recordings
   */
  getActiveRecordings() {
    return Array.from(this.activeRecordings.values());
  }

  /**
   * Get recording statistics
   */
  getRecordingStats() {
    const active = this.getActiveRecordings();
    const completed = Array.from(this.completedRecordings.values());
    
    const totalSize = completed.reduce((sum, rec) => sum + (rec.finalSize || 0), 0);
    const totalDuration = completed.reduce((sum, rec) => sum + (rec.duration || 0), 0);
    const compressionSavings = completed.reduce((sum, rec) => 
      sum + (rec.compression?.estimatedSavings || 0), 0);
    
    return {
      activeRecordings: active.length,
      completedRecordings: completed.length,
      totalStorageUsed: totalSize,
      totalRecordingTime: totalDuration,
      compressionSavings: compressionSavings,
      averageRecordingSize: completed.length > 0 ? totalSize / completed.length : 0,
      averageRecordingDuration: completed.length > 0 ? totalDuration / completed.length : 0
    };
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingId) {
    const recording = await this.getRecording(recordingId);
    if (!recording) {
      throw new Error('Recording not found');
    }

    try {
      // Delete files
      if (recording.storage.finalPath) {
        await fs.unlink(recording.storage.finalPath);
      }
      if (recording.metadataFile) {
        await fs.unlink(recording.metadataFile);
      }

      // Remove from completed recordings
      this.completedRecordings.delete(recordingId);

      logger.info(`RecordingService: Deleted recording ${recordingId}`);
      this.emit('recording-deleted', { recordingId });

      return true;
    } catch (error) {
      logger.error(`RecordingService: Error deleting recording ${recordingId}`, error);
      throw error;
    }
  }

  /**
   * Cleanup old recordings
   */
  async cleanupOldRecordings() {
    const retentionMs = this.settings.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);

    const recordings = await this.getRecordingStats();
    let deletedCount = 0;

    for (const recording of recordings.completedRecordings) {
      if (new Date(recording.startTime) < cutoffDate) {
        try {
          await this.deleteRecording(recording.id);
          deletedCount++;
        } catch (error) {
          logger.warn(`RecordingService: Could not delete old recording ${recording.id}`);
        }
      }
    }

    logger.info(`RecordingService: Cleaned up ${deletedCount} old recordings`);
    return deletedCount;
  }

  /**
   * Get recording URL
   */
  getRecordingUrl(recordingId) {
    return `/recordings/${recordingId}`;
  }

  /**
   * Check if recording is active
   */
  isRecordingActive(streamId) {
    return this.activeRecordings.has(streamId);
  }
}

module.exports = RecordingService;
