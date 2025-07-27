# HarmonieCore Content Service

A comprehensive content management microservice for the HarmonieCore platform, handling file uploads, metadata management, IPFS storage, and CDN integration for artists and creators.

## 🚀 Features

### 📁 **Content Upload & Processing**
- **Multi-format Support**: Images, videos, audio, documents, and 3D files
- **Automatic Processing**: Resize, compress, and optimize for web
- **Multiple Resolutions**: Generate thumbnails, web-optimized versions
- **Format Conversion**: WebP, MP4, MP3, and other web-friendly formats

### 🌐 **IPFS & Decentralized Storage**
- **IPFS Integration**: Pin content to IPFS for permanent storage
- **Multiple Providers**: Web3.Storage, Pinata, and local IPFS nodes
- **Content Hashing**: SHA256 verification for file integrity
- **Gateway URLs**: Automatic IPFS gateway resolution

### 🎨 **Metadata Management**
- **Rich Metadata**: EXIF, ID3, and custom metadata extraction
- **Searchable Tags**: AI-powered tagging and categorization
- **License Management**: Creative Commons and custom licensing
- **Artist Attribution**: Automatic attribution and credits

### 🚀 **CDN Integration**
- **Global Distribution**: Fast content delivery worldwide
- **Cache Optimization**: Redis caching for frequently accessed content
- **Signed URLs**: Secure, time-limited access to private content
- **Bandwidth Optimization**: Automatic compression and optimization

### 🔒 **Security & Moderation**
- **Content Filtering**: AI-powered content moderation
- **Virus Scanning**: Automatic malware detection
- **Access Control**: Private, public, and unlisted content
- **Rate Limiting**: Abuse prevention and fair usage

## 📋 API Reference

### **Content Upload**

#### Upload Single File
```http
POST /api/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

{
  "file": <binary>,
  "metadata": {
    "title": "My Artwork",
    "description": "Digital artwork created with AI",
    "tags": ["art", "ai", "digital"],
    "category": "visual-art",
    "license": "CC-BY-4.0"
  },
  "options": {
    "generateThumbnails": true,
    "optimize": true,
    "formats": ["webp", "jpeg"]
  }
}
```

#### Upload Multiple Files
```http
POST /api/upload/batch
Content-Type: multipart/form-data

{
  "files": [<binary1>, <binary2>, ...],
  "metadata": [...]
}
```

### **Content Management**

#### Get Content Details
```http
GET /api/content/:contentId
```

#### Update Content Metadata
```http
PUT /api/content/:contentId
Content-Type: application/json

{
  "title": "Updated Title",
  "tags": ["new", "tags"],
  "visibility": "public"
}
```

#### Delete Content
```http
DELETE /api/content/:contentId
```

### **Content Discovery**

#### Search Content
```http
GET /api/search?q=digital+art&category=visual-art&type=image&limit=20&offset=0
```

#### Get User Content
```http
GET /api/users/:userId/content?limit=20&offset=0
```

#### Get Trending Content
```http
GET /api/trending?period=7d&category=all
```

### **IPFS Operations**

#### Pin Content to IPFS
```http
POST /api/ipfs/pin/:contentId
```

#### Get IPFS Metadata
```http
GET /api/ipfs/:contentId
```

#### Unpin Content
```http
DELETE /api/ipfs/unpin/:contentId
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Content Service                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Upload API    │  │   Processing    │              │
│  │   Middleware    │  │   Pipeline      │              │
│  └─────────────────┘  └─────────────────┘              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   IPFS Client   │  │   CDN Client    │              │
│  │   (Web3.Storage)│  │   (Cloudflare)  │              │
│  └─────────────────┘  └─────────────────┘              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Metadata      │  │   Cache Layer   │              │
│  │   Extraction    │  │   (Redis)       │              │
│  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3007` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/harmoniecore_content` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `IPFS_HOST` | IPFS node hostname | `localhost` |
| `WEB3_STORAGE_TOKEN` | Web3.Storage API token | Required |
| `PINATA_API_KEY` | Pinata API key | Required |
| `CDN_BASE_URL` | CDN base URL | `https://cdn.harmoniecore.com` |
| `MAX_FILE_SIZE` | Maximum file size (bytes) | `104857600` |

### Supported File Types

#### **Images**
- **Formats**: JPG, JPEG, PNG, GIF, WebP, SVG
- **Max Size**: 50MB
- **Processing**: Resize, compress, generate thumbnails
- **Outputs**: Multiple resolutions + WebP variants

#### **Videos**
- **Formats**: MP4, MOV, AVI, MKV, WebM, FLV
- **Max Size**: 100MB
- **Processing**: Transcode to MP4, generate thumbnails
- **Outputs**: 240p, 480p, 720p, 1080p variants

#### **Audio**
- **Formats**: MP3, WAV, FLAC, AAC, OGG, M4A
- **Max Size**: 50MB
- **Processing**: Transcode to MP3, extract metadata
- **Outputs**: Standard + high-quality variants

#### **Documents**
- **Formats**: PDF, DOC, DOCX, TXT, JSON
- **Max Size**: 25MB
- **Processing**: Metadata extraction
- **Outputs**: Original + preview images

## 🔧 Processing Pipeline

### **Image Processing**
1. **Upload Validation**: Check format, size, and security
2. **Metadata Extraction**: EXIF, dimensions, color profile
3. **Processing**: Resize to multiple resolutions
4. **Format Conversion**: Generate WebP and JPEG variants
5. **IPFS Upload**: Pin to decentralized storage
6. **CDN Distribution**: Upload to global CDN

### **Video Processing**
1. **Upload Validation**: Check format, size, and duration
2. **Metadata Extraction**: Duration, resolution, codec
3. **Transcoding**: Convert to MP4 with H.264
4. **Multiple Resolutions**: 240p to 1080p variants
5. **Thumbnail Generation**: Extract keyframes
6. **IPFS & CDN Upload**: Distribute processed files

### **Audio Processing**
1. **Upload Validation**: Check format and duration
2. **Metadata Extraction**: ID3 tags, duration, bitrate
3. **Transcoding**: Convert to MP3 with standard bitrate
4. **Quality Variants**: Standard and high-quality versions
5. **Waveform Generation**: Visual waveform data
6. **Distribution**: IPFS and CDN upload

## 🌐 IPFS Integration

### **Storage Providers**
- **Web3.Storage**: Decentralized storage with Filecoin
- **Pinata**: IPFS pinning service
- **Local IPFS**: Self-hosted IPFS node

### **Content Addressing**
- **CID**: Content Identifier for unique file reference
- **IPFS Gateway**: Public gateways for content access
- **Pinning**: Ensure content persistence

### **Metadata Storage**
```json
{
  "name": "My Artwork",
  "description": "Digital artwork description",
  "image": "ipfs://QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
  "attributes": [
    {
      "trait_type": "Category",
      "value": "Visual Art"
    },
    {
      "trait_type": "License",
      "value": "CC-BY-4.0"
    }
  ],
  "properties": {
    "files": [
      {
        "uri": "ipfs://QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
        "type": "image/png"
      }
    ],
    "category": "image"
  }
}
```

## 📊 Analytics

### **Usage Metrics**
- **Total Uploads**: Count by type and user
- **Storage Used**: Total storage across all providers
- **Bandwidth**: CDN usage and costs
- **Processing Time**: Average processing duration

### **Content Analytics**
- **Popular Content**: Most viewed/liked content
- **User Activity**: Upload patterns and trends
- **Geographic Distribution**: Content by region
- **Format Preferences**: Popular file types

## 🚀 Quick Start

### **1. Installation**
```bash
cd backend/content-service
npm install
```

### **2. Configuration**
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

### **3. Start Dependencies**
```bash
# Start MongoDB
mongod

# Start Redis
redis-server

# Start IPFS
ipfs daemon
```

### **4. Start Service**
```bash
npm run dev    # Development mode
npm start      # Production mode
npm test       # Run tests
```

### **5. Test Upload**
```bash
# Upload test image
curl -X POST http://localhost:3007/api/upload \
  -H "Authorization: Bearer your-token" \
  -F "file=@test.jpg" \
  -F 'metadata={"title":"Test Upload","tags":["test"]}'
```

## 🔧 Development

### **Testing**
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

### **Docker**
```bash
docker build -t harmoniecore-content-service .
docker run -p 3007:3007 --env-file .env harmoniecore-content-service
```

### **Docker Compose**
```bash
docker-compose up -d
```

## 📱 Mobile Integration

### **React Native Example**
```javascript
import { ContentService } from '@harmoniecore/content-client';

const content = new ContentService({
  baseURL: 'https://content.harmoniecore.com',
  apiKey: 'your-api-key'
});

// Upload artwork
const result = await content.upload({
  file: artworkFile,
  metadata: {
    title: 'My Digital Art',
    description: 'Created with AI tools',
    tags: ['ai', 'digital', 'art'],
    category: 'visual-art'
  }
});

// Get user content
const userContent = await content.getUserContent(userId);
```

## 🔍 Monitoring

### **Health Checks**
- **Database Connection**: MongoDB and Redis
- **IPFS Status**: Node connectivity and pinning
- **CDN Status**: Cloudflare/CloudFront availability
- **Processing Queue**: Job completion rates

### **Alerts**
- **Upload Failures**: Failed uploads and processing
- **Storage Issues**: IPFS pinning failures
- **Performance**: Slow processing times
- **Security**: Malicious file uploads

## 🛡️ Security

### **Content Validation**
- **File Type Verification**: MIME type checking
- **Size Limits**: Configurable upload limits
- **Virus Scanning**: ClamAV integration
- **Content Moderation**: AI-powered NSFW detection

### **Access Control**
- **JWT Authentication**: Secure API access
- **Rate Limiting**: Per-IP and per-user limits
- **Signed URLs**: Secure file access
- **CORS Configuration**: Cross-origin requests

## 🔄 Integration

### **Frontend Integration**
- **React Native**: Full SDK available
- **Web**: REST API endpoints
- **WebSocket**: Real-time upload progress
- **GraphQL**: Optional GraphQL API

### **Other Services**
- **Analytics**: Content performance tracking
- **Notification**: Upload completion alerts
- **Payment**: Premium storage tiers
- **CDN**: Automatic distribution

## 📞 Support

For issues and questions:
- **Documentation**: Check this README
- **API Reference**: Visit `/api/docs` (when implemented)
- **Discord**: Join our community server
- **Issues**: Create GitHub issues

## 🔄 Integration Points

### **HarmonieCore Platform Integration**
- **User Service**: User authentication and profiles
- **Payment Service**: Premium storage and features
- **CDN Service**: Global content distribution
- **Analytics Service**: Content performance metrics
- **Notification Service**: Upload and processing alerts
