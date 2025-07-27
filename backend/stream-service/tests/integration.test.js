/**
 * Integration tests for HarmonieCORE streaming services
 */

const request = require('supertest');
const app = require('../src/server');
const LiveStreamService = require('../src/services/liveStreamService');
const ChatService = require('../src/services/chatService');
const RecordingService = require('../src/services/recordingService');

describe('HarmonieCORE Streaming Services Integration', () => {
  let liveStreamService;
  let chatService;
  let recordingService;

  beforeEach(() => {
    liveStreamService = new LiveStreamService();
    chatService = new ChatService();
    recordingService = new RecordingService();
  });

  describe('Live Streaming Service', () => {
    test('should create a new stream', async () => {
      const streamData = {
        artistId: 'artist123',
        title: 'Test Live Stream',
        description: 'Test description',
        category: 'music'
      };

      const stream = await liveStreamService.createStream(streamData);
      
      expect(stream).toBeDefined();
      expect(stream.id).toBeDefined();
      expect(stream.title).toBe(streamData.title);
      expect(stream.status).toBe('created');
    });

    test('should start a stream', async () => {
      const stream = await liveStreamService.createStream({
        artistId: 'artist123',
        title: 'Test Stream',
        description: 'Test'
      });

      const startedStream = await liveStreamService.startStream(stream.id, 'artist123');
      
      expect(startedStream.status).toBe('live');
      expect(startedStream.startTime).toBeDefined();
    });

    test('should allow viewers to join and leave', async () => {
      const stream = await liveStreamService.createStream({
        artistId: 'artist123',
        title: 'Test Stream'
      });
      await liveStreamService.startStream(stream.id, 'artist123');

      const viewer1 = await liveStreamService.joinStream(stream.id, {
        userId: 'viewer1',
        username: 'Viewer One'
      });

      const viewer2 = await liveStreamService.joinStream(stream.id, {
        userId: 'viewer2',
        username: 'Viewer Two'
      });

      expect(viewer1.viewerCount).toBe(2);
      expect(viewer2.viewerCount).toBe(2);

      await liveStreamService.leaveStream(stream.id, 'viewer1');
      const stats = await liveStreamService.getStreamStats(stream.id);
      expect(stats.viewerCount).toBe(1);
    });
  });

  describe('Chat Service', () => {
    test('should create chat room for stream', async () => {
      const streamData = {
        id: 'stream123',
        title: 'Test Stream',
        artistId: 'artist123'
      };

      const room = await chatService.createChatRoom(streamData.id, streamData);
      
      expect(room).toBeDefined();
      expect(room.id).toBe(streamData.id);
      expect(room.title).toBe(streamData.title);
    });

    test('should send and optimize messages', async () => {
      const streamId = 'stream123';
      await chatService.createChatRoom(streamId, { id: streamId, title: 'Test', artistId: 'artist123' });

      const participant = { userId: 'user123', username: 'TestUser' };
      const message = await chatService.sendMessage(streamId, 'participant1', {
        message: 'Hello world! 😊'
      });

      expect(message).toBeDefined();
      expect(message.message).toBeDefined();
      expect(message.metadata).toBeDefined();
      expect(message.metadata.emojiCount).toBe(1);
    });

    test('should handle tips', async () => {
      const streamId = 'stream123';
      await chatService.createChatRoom(streamId, { id: streamId, title: 'Test', artistId: 'artist123' });

      const tipMessage = await chatService.sendTipMessage(streamId, 'participant1', {
        amount: 5.00,
        currency: 'USD',
        message: 'Great performance!'
      });

      expect(tipMessage.type).toBe('tip');
      expect(tipMessage.amount).toBe(5.00);
      expect(tipMessage.currency).toBe('USD');
    });

    test('should enforce rate limiting', async () => {
      const streamId = 'stream123';
      await chatService.createChatRoom(streamId, { id: streamId, title: 'Test', artistId: 'artist123' });

      // Send multiple messages quickly
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          chatService.sendMessage(streamId, 'participant1', { message: `Message ${i}` })
        );
      }

      // Should throw rate limit error
      await expect(Promise.all(promises)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Recording Service', () => {
    test('should start and stop recording', async () => {
      const streamData = {
        id: 'stream123',
        title: 'Test Recording',
        artistId: 'artist123'
      };

      const recording = await recordingService.startRecording(streamData.id, streamData, {
        deviceType: 'mobile'
      });

      expect(recording).toBeDefined();
      expect(recording.status).toBe('recording');
      expect(recording.deviceType).toBe('mobile');
      expect(recording.quality.video.bitrate).toBe(300000); // Mobile quality

      const completed = await recordingService.stopRecording(streamData.id);
      expect(completed.status).toBe('completed');
      expect(completed.duration).toBeGreaterThan(0);
    });

    test('should handle different quality settings', async () => {
      const streamData = { id: 'stream456', title: 'Test', artistId: 'artist123' };

      const mobileRecording = await recordingService.startRecording(streamData.id, streamData, {
        deviceType: 'mobile'
      });

      const desktopRecording = await recordingService.startRecording('stream789', streamData, {
        deviceType: 'desktop'
      });

      expect(mobileRecording.quality.video.width).toBe(480);
      expect(desktopRecording.quality.video.width).toBe(1280);
    });

    test('should get recording statistics', async () => {
      const stats = await recordingService.getRecordingStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalRecordings).toBeDefined();
      expect(stats.activeRecordings).toBeDefined();
      expect(stats.completedRecordings).toBeDefined();
    });
  });

  describe('API Endpoints', () => {
    test('POST /api/streams/create should create new stream', async () => {
      const response = await request(app)
        .post('/api/streams/create')
        .send({
          artistId: 'artist123',
          title: 'API Test Stream',
          description: 'Test API',
          category: 'music'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('API Test Stream');
    });

    test('GET /api/streams should return active streams', async () => {
      const response = await request(app)
        .get('/api/streams');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/streams/:streamId/recordings/start should start recording', async () => {
      // First create a stream
      const streamResponse = await request(app)
        .post('/api/streams/create')
        .send({
          artistId: 'artist123',
          title: 'Recording Test'
        });

      const streamId = streamResponse.body.id;

      const response = await request(app)
        .post(`/api/streams/${streamId}/recordings/start`)
        .send({ deviceType: 'mobile' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('recording');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete streaming workflow', async () => {
      // Create stream
      const stream = await liveStreamService.createStream({
        artistId: 'artist123',
        title: 'Integration Test Stream',
        description: 'Full workflow test',
        recordingEnabled: true
      });

      // Start stream
      await liveStreamService.startStream(stream.id, 'artist123');

      // Create chat room
      await chatService.createChatRoom(stream.id, stream);

      // Start recording
      const recording = await recordingService.startRecording(stream.id, stream, {
        deviceType: 'mobile'
      });

      // Simulate viewer joining
      const viewer = await liveStreamService.joinStream(stream.id, {
        userId: 'viewer1',
        username: 'Test Viewer'
      });

      // Send chat messages
      const message1 = await chatService.sendMessage(stream.id, 'participant1', {
        message: 'Hello from viewer!'
      });

      const message2 = await chatService.sendMessage(stream.id, 'participant2', {
        message: 'Great stream!'
      });

      // Send tip
      const tip = await chatService.sendTipMessage(stream.id, 'participant1', {
        amount: 10.00,
        currency: 'USD',
        message: 'Amazing performance!'
      });

      // Verify everything worked
      const streamStats = await liveStreamService.getStreamStats(stream.id);
      const chatStats = chatService.getRoomStats(stream.id);
      
      expect(streamStats.viewerCount).toBe(1);
      expect(chatStats.activeUsers).toBe(2); // artist + viewer
      expect(chatStats.totalMessages).toBe(3); // 2 chat + 1 tip

      // Cleanup
      await recordingService.stopRecording(stream.id);
      await liveStreamService.endStream(stream.id, 'artist123');
    });
  });

  describe('Mobile Optimization', () => {
    test('should use mobile-optimized settings', async () => {
      const streamData = { id: 'mobile-test', title: 'Mobile Test', artistId: 'artist123' };
      
      const recording = await recordingService.startRecording(streamData.id, streamData, {
        deviceType: 'mobile'
      });

      expect(recording.quality.video.bitrate).toBe(300000);
      expect(recording.quality.audio.bitrate).toBe(32000);
      expect(recording.metadata.mobileOptimized).toBe(true);
    });

    test('should optimize chat messages for mobile', async () => {
      const streamId = 'mobile-chat-test';
      await chatService.createChatRoom(streamId, { id: streamId, title: 'Test', artistId: 'artist123' });

      const longMessage = 'a'.repeat(1000);
      const message = await chatService.sendMessage(streamId, 'participant1', {
        message: longMessage
      });

      expect(message.message.length).toBeLessThanOrEqual(500); // Max message length
      expect(message.metadata.compressed).toBe(true);
    });
  });
});

// Mock server for testing
if (require.main === module) {
  const app = require('../src/server');
  
  describe('Server Integration', () => {
    test('should start successfully', async () => {
      const server = app.listen(0); // Use random port
      
      expect(server).toBeDefined();
      
      server.close();
    });
  });
}
