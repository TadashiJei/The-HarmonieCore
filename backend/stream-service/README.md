# HarmonieCORE Stream Service

A high-performance WebRTC streaming service built for the HarmonieCORE platform, enabling real-time live streaming for artists and interactive experiences for fans.

## Features

- **Real-time WebRTC Streaming**: Low-latency live streaming using WebRTC
- **Scalable Architecture**: Microservice design with Redis for session management
- **Interactive Chat**: Real-time chat during streams
- **Tipping System**: Direct $CORE token tipping integration
- **Quality Adaptation**: Dynamic quality adjustment based on connection
- **Rate Limiting**: Comprehensive rate limiting to prevent abuse
- **Monitoring**: Built-in health checks and metrics
- **Security**: JWT authentication and input validation

## Quick Start

### Prerequisites
- Node.js 16+
- Redis server
- Twilio account (for TURN servers)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start the service
npm run dev
```

### Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# TURN/STUN Servers
TURN_SERVER_URL=turn:global.turn.twilio.com:3478
TURN_USERNAME=your_username
TURN_PASSWORD=your_password

# Security
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
```

## API Endpoints

### Stream Management
- `POST /api/streams/create` - Create a new stream
- `GET /api/streams/:streamId` - Get stream details
- `GET /health` - Health check endpoint
- `GET /metrics` - Service metrics

### WebSocket Events

#### Client → Server
- `join-stream` - Join a stream as viewer
- `start-stream` - Start streaming (artist)
- `webrtc-offer` - Send WebRTC offer
- `webrtc-answer` - Send WebRTC answer
- `webrtc-ice-candidate` - Send ICE candidate
- `send-message` - Send chat message
- `send-tip` - Send tip

#### Server → Client
- `stream-started` - Stream has started
- `stream-ended` - Stream has ended
- `viewer-joined` - New viewer joined
- `new-message` - New chat message
- `new-tip` - New tip received
- `webrtc-offer` - WebRTC offer received
- `webrtc-answer` - WebRTC answer received
- `webrtc-ice-candidate` - ICE candidate received

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client (PWA)  │    │  Stream Service │    │     Redis       │
│                 │    │                 │    │                 │
│  WebRTC Client  │◄──►│  Socket.IO      │◄──►│ Session Store   │
│  Chat Client    │    │  Stream Manager │    │ Stream Data     │
│  Tip Client     │    │  Rate Limiter   │    │ Chat History    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run build` - Build TypeScript (if applicable)

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Docker Support
```bash
# Build image
docker build -t harmoniecore-stream-service .

# Run container
docker run -p 3001:3001 --env-file .env harmoniecore-stream-service
```

## Monitoring

The service provides several monitoring endpoints:
- `/health` - Basic health check
- `/metrics` - Service metrics
- Logs are written to `logs/` directory

## Security Features

- Rate limiting on all endpoints
- Input validation and sanitization
- JWT token authentication
- CORS protection
- Helmet security headers
- Request logging
- Error handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting: `npm run lint`
6. Submit a pull request

## License

MIT License - see LICENSE file for details
