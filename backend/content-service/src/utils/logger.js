/**
 * Logger utility for Content Service
 * Provides structured logging with Winston for content management operations
 */

const winston = require('winston');
const path = require('path');

// Ensure logs directory exists
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format for content operations
const contentLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      service: 'content-service',
      message,
      ...meta
    });
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: contentLogFormat,
  defaultMeta: { service: 'content-service' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Upload logs
    new winston.transports.File({
      filename: path.join(logsDir, 'upload.log'),
      level: 'info',
      maxsize: 5242880,
      maxFiles: 5
    }),
    
    // IPFS logs
    new winston.transports.File({
      filename: path.join(logsDir, 'ipfs.log'),
      level: 'info',
      maxsize: 5242880,
      maxFiles: 5
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    }),
    
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    })
  ]
});

// Create child loggers for specific operations
const uploadLogger = logger.child({ component: 'upload' });
const ipfsLogger = logger.child({ component: 'ipfs' });
const cdnLogger = logger.child({ component: 'cdn' });
const metadataLogger = logger.child({ component: 'metadata' });

module.exports = {
  logger,
  uploadLogger,
  ipfsLogger,
  cdnLogger,
  metadataLogger
};
