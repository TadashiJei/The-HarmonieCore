/**
 * CDN Service Test Suite
 * Comprehensive testing for global CDN functionality
 */

const request = require('supertest');
const { app, server, cdnService } = require('../src/server');
const fs = require('fs');
const path = require('path');

describe('CDN Service', () => {
  let testImageBuffer;
  let testVideoBuffer;

  beforeAll(async () => {
    // Create test buffers
    testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    testVideoBuffer = Buffer.from('test video content');
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'cdn-service');
      expect(response.body).toHaveProperty('regions');
    });
  });

  describe('Content Upload', () => {
    it('should upload image content', async () => {
      const response = await request(app)
        .post('/api/upload')
        .send({
          content: testImageBuffer.toString('base64'),
          type: 'image',
          filename: 'test-image.jpg',
          metadata: { artist: 'test-artist' },
          optimizeForMobile: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('contentId');
      expect(response.body).toHaveProperty('urls');
      expect(response.body.urls).toHaveProperty('us-east-1');
    });

    it('should upload video content', async () => {
      const response = await request(app)
        .post('/api/upload')
        .send({
          content: testVideoBuffer.toString('base64'),
          type: 'video',
          filename: 'test-video.mp4',
          metadata: { duration: 120 }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('contentId');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/upload')
        .send({
          type: 'image'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Bulk Upload', () => {
    it('should handle bulk uploads', async () => {
      const items = [
        {
          content: testImageBuffer.toString('base64'),
          type: 'image',
          filename: 'bulk-image-1.jpg'
        },
        {
          content: testImageBuffer.toString('base64'),
          type: 'image',
          filename: 'bulk-image-2.jpg'
        }
      ];

      const response = await request(app)
        .post('/api/upload/bulk')
        .send({ items })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('successful', 2);
      expect(response.body).toHaveProperty('failed', 0);
      expect(response.body.results).toHaveLength(2);
    });
  });

  describe('Signed URLs', () => {
    let testContentId;

    beforeAll(async () => {
      const uploadResponse = await request(app)
        .post('/api/upload')
        .send({
          content: testImageBuffer.toString('base64'),
          type: 'image',
          filename: 'signed-url-test.jpg'
        });
      
      testContentId = uploadResponse.body.contentId;
    });

    it('should generate signed URL', async () => {
      const response = await request(app)
        .post('/api/signed-url')
        .send({
          contentId: testContentId,
          expiresIn: 3600
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('signedUrl');
      expect(response.body.signedUrl).toHaveProperty('url');
      expect(response.body.signedUrl).toHaveProperty('token');
    });

    it('should validate signed URL', async () => {
      const signedResponse = await request(app)
        .post('/api/signed-url')
        .send({
          contentId: testContentId,
          expiresIn: 3600
        });

      const token = signedResponse.body.signedUrl.token;

      const validateResponse = await request(app)
        .get(`/api/validate/${token}`)
        .expect(200);

      expect(validateResponse.body).toHaveProperty('valid', true);
      expect(validateResponse.body).toHaveProperty('contentId', testContentId);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/validate/invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('CDN Metrics', () => {
    it('should return CDN metrics', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('cacheHitRate');
      expect(response.body).toHaveProperty('totalRequests');
      expect(response.body).toHaveProperty('cacheHits');
      expect(response.body).toHaveProperty('edgeNodes');
      expect(Array.isArray(response.body.edgeNodes)).toBe(true);
    });
  });

  describe('Regions', () => {
    it('should return available regions', async () => {
      const response = await request(app)
        .get('/api/regions')
        .expect(200);

      expect(response.body).toHaveProperty('regions');
      expect(Array.isArray(response.body.regions)).toBe(true);
      expect(response.body.regions.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    let testContentId;

    beforeAll(async () => {
      const uploadResponse = await request(app)
        .post('/api/upload')
        .send({
          content: testImageBuffer.toString('base64'),
          type: 'image',
          filename: 'cache-test.jpg'
        });
      
      testContentId = uploadResponse.body.contentId;
    });

    it('should invalidate cache', async () => {
      const response = await request(app)
        .post('/api/cache/invalidate')
        .send({
          contentId: testContentId
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Cache invalidated');
    });
  });

  describe('Content Optimization', () => {
    it('should optimize content for mobile', async () => {
      const largeImage = Buffer.alloc(1024 * 1024); // 1MB test image
      
      const response = await request(app)
        .post('/api/upload')
        .send({
          content: largeImage.toString('base64'),
          type: 'image',
          filename: 'mobile-optimized.jpg',
          optimizeForMobile: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('optimized', true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing content', async () => {
      const response = await request(app)
        .get('/api/content/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Content not found');
    });

    it('should handle invalid endpoints', async () => {
      const response = await request(app)
        .get('/api/invalid-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Endpoint not found');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // This test would need to be implemented with actual rate limiting
      // For now, we'll just test that rate limiting headers are present
      const response = await request(app)
        .get('/health');

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Compression', () => {
    it('should compress responses', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .set('Accept-Encoding', 'gzip');

      expect(response.headers).toHaveProperty('content-encoding', 'gzip');
    });
  });
});
