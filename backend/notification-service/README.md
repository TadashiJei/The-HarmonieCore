# HarmonieCORE Notification Service

Ultra-optimized notification system for the HarmonieCore Web3 artist platform. Provides email, SMS, push notifications, and real-time alerts with mobile-first optimization.

## Features

### 🔔 Multi-Channel Notifications
- **Email notifications** with mobile-optimized templates
- **SMS notifications** with rate limiting and content optimization
- **Push notifications** (Firebase Cloud Messaging)
- **Web push notifications** (Service Workers)
- **Real-time WebSocket alerts**

### 📱 Mobile-First Design
- Ultra-low data usage notifications
- Optimized content for mobile screens
- Battery-conscious push strategies
- Adaptive notification sizing

### ⚡ Performance Optimizations
- **Batch processing** for bulk notifications
- **Rate limiting** per user and per channel
- **Queue management** with retry logic
- **Caching** for user preferences
- **Connection pooling** for external services

### 🔧 Advanced Features
- **User preference management**
- **Quiet hours support**
- **Notification history tracking**
- **Delivery analytics**
- **A/B testing support**
- **Webhook endpoints** for delivery tracking

## Quick Start

### Installation

```bash
cd backend/notification-service
npm install
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Required Environment Variables

```bash
# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Push Notifications (Firebase)
FIREBASE_SERVICE_ACCOUNT=your-service-account-json

# Web Push (VAPID)
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

### Running the Service

```bash
# Development
npm run dev

# Production
npm start

# Testing
npm test
```

## API Reference

### Send Notification

```http
POST /api/notifications/send
Content-Type: application/json

{
  "userId": "user123",
  "type": "email",
  "data": {
    "subject": "New Follower",
    "body": "@artist_name just followed you!",
    "actionUrl": "https://harmoniecore.com/profile/artist_name"
  }
}
```

### Batch Notifications

```http
POST /api/notifications/batch
Content-Type: application/json

{
  "notifications": [
    {
      "userId": "user1",
      "type": "push",
      "data": {
        "title": "Live Stream Starting",
        "body": "Your favorite artist is going live now!"
      }
    }
  ]
}
```

### User Preferences

```http
# Get preferences
GET /api/users/:userId/preferences

# Update preferences
PUT /api/users/:userId/preferences
Content-Type: application/json

{
  "email": true,
  "sms": false,
  "push": true,
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  }
}
```

## Notification Types

### Email Notifications
```javascript
{
  type: 'email',
  subject: 'New Album Release',
  body: 'Check out the latest album from your favorite artist',
  actionUrl: 'https://harmoniecore.com/album/id',
  actionText: 'Listen Now'
}
```

### SMS Notifications
```javascript
{
  type: 'sms',
  message: 'Your live stream starts in 15 minutes!'
}
```

### Push Notifications
```javascript
{
  type: 'push',
  title: 'New Tip Received',
  body: 'You received a $5 tip from @fan_name!',
  data: { amount: 5, sender: '@fan_name' },
  actions: [
    { action: 'view', title: 'View' },
    { action: 'reply', title: 'Thank' }
  ]
}
```

### Web Push
```javascript
{
  type: 'webpush',
  title: 'Exclusive Content Alert',
  body: 'New exclusive content available for subscribers',
  data: { contentId: '123', type: 'exclusive' }
}
```

## Mobile Optimization Features

### Data Usage Optimization
- **Compressed payloads** (< 2KB per notification)
- **Efficient batching** (up to 10 notifications per request)
- **Smart caching** (user preferences cached for 5 minutes)
- **Connection reuse** (persistent connections to external services)

### Battery Optimization
- **Silent notifications** for non-critical updates
- **Batch delivery** during low battery states
- **Adaptive retry** based on device state
- **Quiet hours** support

### Network Optimization
- **Offline queue** for failed deliveries
- **Adaptive timeouts** based on network quality
- **Compression** for large payloads
- **CDN integration** for media attachments

## WebSocket Events

### Client → Server
```javascript
// Register user
socket.emit('register-user', 'user123');

// Update preferences
socket.emit('update-preferences', {
  email: true,
  push: true,
  quietHours: { enabled: true, start: '22:00', end: '08:00' }
});

// Mark notification as read
socket.emit('mark-read', 'notification-id');
```

### Server → Client
```javascript
// Preferences updated
socket.on('preferences-updated', (preferences) => {
  console.log('Preferences updated:', preferences);
});

// Real-time notification
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

## Monitoring

### Health Check
```http
GET /health
```

### Service Statistics
```http
GET /api/stats
```

### Logs
- **Application logs**: `logs/combined.log`
- **Error logs**: `logs/error.log`
- **Console output**: Real-time in development

## Deployment

### Docker
```bash
docker build -t harmoniecore-notification .
docker run -p 3003:3003 --env-file .env harmoniecore-notification
```

### Docker Compose
```yaml
version: '3.8'
services:
  notification-service:
    build: .
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
```

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3003 |
| `SMTP_HOST` | Email server host | smtp.gmail.com |
| `TWILIO_ACCOUNT_SID` | Twilio account ID | - |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON | - |
| `VAPID_PUBLIC_KEY` | Web push public key | - |
| `REDIS_HOST` | Redis server host | localhost |
| `LOG_LEVEL` | Logging level | info |

## Integration Examples

### Frontend Integration
```javascript
// Connect to notification service
const socket = io('http://localhost:3003');
socket.emit('register-user', currentUserId);

// Listen for notifications
socket.on('notification', (notification) => {
  // Show notification to user
  showToast(notification);
});
```

### Backend Integration
```javascript
// Send notification from another service
const response = await fetch('http://localhost:3003/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    type: 'push',
    data: { title: 'Hello', body: 'World' }
  })
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
