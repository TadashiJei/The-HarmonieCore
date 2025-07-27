# 🔧 HarmonieCORE Technical Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git
- MetaMask or compatible wallet
- Core Network testnet tokens

### Environment Setup

#### 1. Clone Repository
```bash
git clone https://github.com/tadashijei/harmoniecore.git
cd harmoniecore
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Environment Configuration
Create `.env.local` file:
```env
# Blockchain Configuration
NEXT_PUBLIC_CORE_RPC_URL=https://rpc.test.btcs.network
NEXT_PUBLIC_CHAIN_ID=1115

# Wallet Configuration
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# IPFS Configuration
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs/
NEXT_PUBLIC_PINATA_API_KEY=your_pinata_key
NEXT_PUBLIC_PINATA_SECRET_KEY=your_pinata_secret

# WebRTC Configuration
NEXT_PUBLIC_TURN_SERVER_URL=turn:global.turn.twilio.com:3478
NEXT_PUBLIC_TURN_USERNAME=your_twilio_username
NEXT_PUBLIC_TURN_PASSWORD=your_twilio_password

# Analytics
NEXT_PUBLIC_GA_TRACKING_ID=your_ga_id
```

#### 4. Smart Contract Deployment
```bash
# Install Hardhat
npm install --save-dev hardhat

# Deploy contracts
npx hardhat compile
npx hardhat run scripts/deploy.js --network core_testnet
```

#### 5. Start Development Server
```bash
npm run dev
# Open http://localhost:3000
```

## 🏗️ Development Environment

### Required Tools
- **VS Code** with extensions:
  - Solidity
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux/React-Native snippets
- **MetaMask** with Core Network configuration
- **Git** for version control

### Core Network Configuration

#### Add Core Testnet to MetaMask
```json
{
  "chainId": "0x45B",
  "chainName": "Core Testnet",
  "rpcUrls": ["https://rpc.test.btcs.network"],
  "nativeCurrency": {
    "name": "Core",
    "symbol": "tCORE",
    "decimals": 18
  },
  "blockExplorerUrls": ["https://scan.test.btcs.network"]
}
```

#### Get Testnet Tokens
1. Visit [Core Testnet Faucet](https://scan.test.btcs.network/faucet)
2. Connect your wallet
3. Request testnet CORE tokens

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Start test environment
npm run test:e2e

# Run specific test suite
npm run test:e2e -- --grep "Artist Upload"
```

### Smart Contract Tests
```bash
# Run Hardhat tests
npx hardhat test

# Run with gas reporting
npx hardhat test --gas
```

## 🚀 Production Deployment

### Build Process
```bash
# Build for production
npm run build

# Start production server
npm start

# Analyze bundle size
npm run analyze
```

### Deployment Platforms

#### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Netlify
```bash
# Build and deploy
npm run build
netlify deploy --prod --dir=out
```

#### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔧 Configuration Files

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "deploy": "npm run build && npm run deploy:vercel",
    "deploy:vercel": "vercel --prod",
    "deploy:netlify": "netlify deploy --prod --dir=out"
  }
}
```

### Next.js Configuration
```javascript
// next.config.js
module.exports = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
  },
  env: {
    CUSTOM_KEY: 'my-value',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.example.com/:path*',
      },
    ];
  },
};
```

## 🐛 Troubleshooting

### Common Issues

#### WebRTC Connection Failed
```bash
# Check TURN server configuration
# Verify firewall settings
# Test with different networks
```

#### Wallet Connection Issues
```bash
# Clear browser cache
# Reset MetaMask account
# Check network configuration
```

#### IPFS Upload Failures
```bash
# Verify Pinata credentials
# Check file size limits
# Test IPFS gateway connectivity
```

#### Build Errors
```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Check for circular dependencies
npm run lint
```

## 📊 Monitoring & Analytics

### Development Tools
- **React DevTools**: Component inspection
- **Redux DevTools**: State management debugging
- **Network Tab**: API request monitoring
- **Console Logging**: Error tracking

### Production Monitoring
- **Vercel Analytics**: Performance monitoring
- **Sentry**: Error tracking and reporting
- **Google Analytics**: User behavior tracking
- **WebRTC Stats**: Real-time connection monitoring

## 🔐 Security Checklist

### Development Security
- [ ] Environment variables properly configured
- [ ] API keys not exposed in client code
- [ ] HTTPS enforced in production
- [ ] Content Security Policy implemented
- [ ] Input validation on all forms
- [ ] Rate limiting on API endpoints

### Smart Contract Security
- [ ] Reentrancy protection implemented
- [ ] Integer overflow protection
- [ ] Access control mechanisms
- [ ] Emergency pause functionality
- [ ] Comprehensive test coverage
- [ ] Third-party security audit

## 📝 Contributing Guidelines

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open pull request

### Code Standards
- **ESLint**: Follow project linting rules
- **Prettier**: Code formatting consistency
- **TypeScript**: Strong typing preferred
- **Testing**: Minimum 80% test coverage
- **Documentation**: Update docs for new features

## 📚 Additional Resources

### Documentation Links
- [Next.js Documentation](https://nextjs.org/docs)
- [RainbowKit Documentation](https://rainbowkit.com/docs)
- [WebRTC API Reference](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Core Network Documentation](https://docs.coredao.org/)

### Community Resources
- [Discord Community](https://discord.gg/harmoniecore)
- [GitHub Discussions](https://github.com/tadashijei/harmoniecore/discussions)
- [Developer Blog](https://harmoniecore.dev/blog)
- [Support Tickets](https://support.harmoniecore.com)

---

*For additional support, join our [Discord community](https://discord.gg/harmoniecore) or create an issue on [GitHub](https://github.com/tadashijei/harmoniecore/issues).*
