FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for image/video processing
RUN apk add --no-cache \
    ffmpeg \
    vips-tools \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/
COPY tests/ ./tests/

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cdn -u 1001

# Change ownership
RUN chown -R cdn:nodejs /app

USER cdn

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

EXPOSE 3005

CMD ["npm", "start"]
