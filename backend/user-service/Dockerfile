# User Service Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Sharp (image processing)
RUN apk add --no-cache \
    libc6-compat \
    vips-dev \
    vips-heif \
    vips-jxl \
    vips-magick \
    vips-poppler \
    vips-openslide \
    vips-cgif \
    vips-webp \
    vips-tiff \
    vips-jpeg

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY src/ ./src/
COPY .env.example ./.env

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["npm", "start"]
