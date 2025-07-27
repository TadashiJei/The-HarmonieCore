/**
 * Recording Service Unit Tests
 */

const RecordingService = require('../src/services/recordingService');

describe('RecordingService', () => {
  let recordingService;

  beforeEach(() => {
    recordingService = new RecordingService();
  });

  afterEach(() => {
    // Clean up any active recordings
    const activeRecordings = recordingService.getActiveRecordings();
    activeRecordings.forEach(recording => {
      if (recording.interval) {
        clearInterval(recording.interval);
      }
    });
  });

  describe('startRecording', () => {
    test('should create a new recording with correct metadata', async () => {
      const streamData = {
        id: 'test-stream-123',
        title: 'Test Stream',
        artistId: 'artist-456'
      };

      const recording = await recordingService.startRecording('test-stream-123', streamData, {
        deviceType: 'mobile'
      });

      expect(recording).toBeDefined();
      expect(recording.id).toBeDefined();
      expect(recording.streamId).toBe('test-stream-123');
      expect(recording.title).toBe('Test Stream');
      expect(recording.deviceType).toBe('mobile');
      expect(recording.status).toBe('recording');
    });

    test('should use mobile quality settings for mobile devices', async () => {
      const streamData = { id: 'test-stream-123', title: 'Test', artistId: 'artist-456' };
      
      const recording = await recordingService.startRecording('test-stream-123', streamData, {
        deviceType: 'mobile'
      });

      expect(recording.quality.video.bitrate).toBe(300000);
      expect(recording.quality.video.width).toBe(480);
      expect(recording.quality.audio.bitrate).toBe(32000);
    });

    test('should use desktop quality settings for desktop devices', async () => {
      const streamData = { id: 'test-stream-123', title: 'Test', artistId: 'artist-456' };
      
      const recording = await recordingService.startRecording('test-stream-123', streamData, {
        deviceType: 'desktop'
      });

      expect(recording.quality.video.bitrate).toBe(1000000);
      expect(recording.quality.video.width).toBe(1280);
      expect(recording.quality.audio.bitrate).toBe(128000);
    });
  });

  describe('compressChunk', () => {
    test('should simulate compression correctly', async () => {
      const testData = Buffer.from('test data for compression');
      const compressed = await recordingService.compressChunk(testData, 5);
      
      expect(compressed.length).toBeLessThan(testData.length);
      expect(compressed.length).toBe(Math.floor(testData.length * 0.5));
    });

    test('should handle maximum compression level', async () => {
      const testData = Buffer.from('test data');
      const compressed = await recordingService.compressChunk(testData, 9);
      
      expect(compressed.length).toBe(Math.floor(testData.length * 0.1));
    });
  });

  describe('generateSimulatedChunk', () => {
    test('should generate correct size for mobile quality', () => {
      const recording = {
        quality: {
          video: { bitrate: 300000 },
          audio: { bitrate: 32000 }
        }
      };

      const chunk = recordingService.generateSimulatedChunk(recording);
      const expectedSize = Math.floor((300000 + 32000) * 30 / 8);
      
      expect(chunk.length).toBe(expectedSize);
    });
  });

  describe('getRecordingStats', () => {
    test('should return correct statistics', () => {
      const stats = recordingService.getRecordingStats();
      
      expect(stats).toHaveProperty('activeRecordings');
      expect(stats).toHaveProperty('completedRecordings');
      expect(stats).toHaveProperty('totalStorageUsed');
      expect(stats).toHaveProperty('totalRecordingTime');
      expect(stats).toHaveProperty('compressionSavings');
    });
  });

  describe('isRecordingActive', () => {
    test('should return false for non-existent recording', () => {
      expect(recordingService.isRecordingActive('non-existent')).toBe(false);
    });

    test('should return true for active recording', async () => {
      const streamData = { id: 'test-stream-123', title: 'Test', artistId: 'artist-456' };
      await recordingService.startRecording('test-stream-123', streamData);
      
      expect(recordingService.isRecordingActive('test-stream-123')).toBe(true);
    });
  });
});
