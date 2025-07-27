# HarmonieCore User Service

A comprehensive user management microservice for the HarmonieCore platform, providing authentication, profile management, social features, and artist management capabilities.

## 🚀 Features

### Authentication & Security
- **JWT-based authentication** with refresh tokens
- **OAuth integration** (Google, Facebook, Twitter, Discord)
- **Email verification** and password reset
- **Rate limiting** and security headers
- **Account locking** after failed login attempts
- **Role-based access control** (fan, artist, admin)

### User Management
- **User registration** with email/username validation
- **Profile management** with rich metadata
- **Avatar upload** with image processing and CDN integration
- **Email notifications** for user actions
- **Account suspension** and status management

### Social Features
- **Follow/unfollow system** with real-time updates
- **Block/unblock functionality**
- **User search** with filters and pagination
- **Social analytics** (followers, following, engagement)
- **Privacy controls** for profile visibility

### Artist Features
- **Artist profile** with genres, instruments, influences
- **Verification system** for artists
- **Social links** integration
- **Event management** for upcoming shows
- **Revenue tracking** and analytics

## 🏗️ Architecture

```
User Service Architecture
├── src/
│   ├── server.js              # Express server setup
│   ├── services/
│   │   └── userService.js     # Core user business logic
│   ├── middleware/
│   │   └── auth.js           # JWT authentication middleware
│   ├── config/
│   │   └── passport.js       # OAuth configuration
│   └── utils/
│       ├── logger.js         # Winston logging
│       └── emailService.js   # Email notifications
├── Dockerfile                # Container configuration
├── docker-compose.yml        # Full stack deployment
└── package.json             # Dependencies and scripts
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- MongoDB 7.0+
- Redis 7.0+
- Docker & Docker Compose (optional)

### Quick Start

1. **Clone and setup**
```bash
cd backend/user-service
cp .env.example .env
# Edit .env with your configuration
```

2. **Install dependencies**
```bash
npm install
```

3. **Start with Docker**
```bash
docker-compose up -d
```

4. **Or start manually**
```bash
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
JWT_SECRET=your-super-secret-key
MONGODB_URI=mongodb://localhost:27017/harmoniecore_users
REDIS_HOST=localhost
REDIS_PORT=6379

# OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-email-password

# Cloudinary for avatars
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
```

## 📡 API Reference

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "artistname",
  "password": "securepassword123",
  "displayName": "Artist Name",
  "role": "artist"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### OAuth Login
```http
GET /api/auth/google
GET /api/auth/facebook
GET /api/auth/twitter
GET /api/auth/discord
```

### User Management Endpoints

#### Get Current User
```http
GET /api/users/me
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /api/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "New Display Name",
  "bio": "Updated bio information",
  "location": "New York, NY",
  "socialLinks": {
    "twitter": "https://twitter.com/username",
    "instagram": "https://instagram.com/username"
  }
}
```

#### Upload Avatar
```http
POST /api/users/me/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

avatar: <image file>
```

### Social Features Endpoints

#### Follow/Unfollow User
```http
POST /api/users/:userId/follow
Authorization: Bearer <token>
```

#### Get Followers
```http
GET /api/users/:userId/followers?limit=20&offset=0
```

#### Get Following
```http
GET /api/users/:userId/following?limit=20&offset=0
```

#### Search Users
```http
GET /api/users?q=search_query&role=artist&limit=20&offset=0
```

#### Block/Unblock User
```http
POST /api/users/:userId/block
Authorization: Bearer <token>
```

### Admin Endpoints

#### Get All Users (Admin)
```http
GET /api/admin/users
Authorization: Bearer <admin-token>
```

## 🔐 Security Features

### Authentication
- **JWT tokens** with configurable expiration
- **Refresh tokens** for seamless re-authentication
- **OAuth providers** for social login
- **Email verification** required for new accounts

### Rate Limiting
- **100 requests per 15 minutes** per IP
- **Configurable limits** via environment variables
- **Account locking** after failed login attempts

### Data Protection
- **Password hashing** with bcrypt (12 rounds)
- **HTTPS enforcement** in production
- **CORS configuration** for cross-origin requests
- **Input validation** and sanitization

### Privacy Controls
- **Profile visibility** settings (public/private/unlisted)
- **Email visibility** controls
- **Block list** functionality
- **GDPR compliance** features

## 📊 Monitoring & Logging

### Health Checks
```http
GET /health
```

### Logging
- **Structured logging** with Winston
- **Separate log files** for different concerns:
  - `auth.log` - Authentication events
  - `security.log` - Security-related events
  - `social.log` - Social interactions
  - `error.log` - Error tracking
- **Log rotation** with 5MB file limits

### Metrics
- **User registration** counts
- **Login attempts** and success rates
- **Social interactions** (follows, blocks)
- **API response times**

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run linting
npm run lint
```

## 🐳 Docker Deployment

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker build -t harmoniecore-user-service .
docker run -p 3001:3001 --env-file .env harmoniecore-user-service
```

### Services Included
- **User Service** - Main application
- **MongoDB** - User data storage
- **Redis** - Session caching
- **Mongo Express** - Database management UI (port 8081)
- **Redis Commander** - Redis management UI (port 8082)

## 🔧 Configuration

### Database Schema

#### User Model
```javascript
{
  email: String (unique, required),
  username: String (unique, required),
  password: String (hashed),
  displayName: String (required),
  role: String (fan|artist|admin),
  avatar: { url: String, publicId: String },
  followers: [ObjectId],
  following: [ObjectId],
  blockedUsers: [ObjectId],
  preferences: Object,
  isEmailVerified: Boolean,
  status: String (active|suspended|deleted)
}
```

#### User Profile Model
```javascript
{
  userId: ObjectId (reference),
  bio: String,
  location: String,
  website: String,
  socialLinks: Object,
  verification: Object,
  artistProfile: Object,
  stats: Object
}
```

### Environment Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `JWT_SECRET` | JWT signing key | Required |
| `MONGODB_URI` | MongoDB connection | `mongodb://localhost:27017/harmoniecore_users` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Required for avatars |
| `EMAIL_SERVICE` | Email provider | `gmail` |

## 🔄 Integration with Other Services

### Content Service Integration
- **User content counts** and statistics
- **Author information** for content
- **Profile enrichment** with content data

### Notification Service Integration
- **Email notifications** for user actions
- **Push notifications** for mobile apps
- **Real-time updates** for social interactions

### Analytics Service Integration
- **User engagement** tracking
- **Social interaction** analytics
- **Growth metrics** and reporting

## 📱 Mobile Optimization

### Responsive Design
- **Mobile-first** API design
- **Optimized image uploads** for mobile
- **Progressive enhancement** for features

### Performance
- **CDN integration** for avatars
- **Image compression** and optimization
- **Caching strategies** for frequent data

## 🚨 Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check MongoDB status
docker-compose ps

# Check logs
docker-compose logs mongo

# Reset database
docker-compose down -v
docker-compose up -d
```

#### Redis Connection
```bash
# Check Redis status
docker-compose logs redis

# Test Redis connection
redis-cli ping
```

#### Email Issues
- Verify SMTP credentials
- Check spam folder for test emails
- Ensure email service API keys are valid

### Debug Mode
```bash
# Enable debug logging
DEBUG=user-service:* npm run dev

# Check service health
curl http://localhost:3001/health
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs or feature requests
- **Discord**: Join our community Discord for support
- **Email**: support@harmoniecore.com

---

**Built with ❤️ for the HarmonieCore community**
