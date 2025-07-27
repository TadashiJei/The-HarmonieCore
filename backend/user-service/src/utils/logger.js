/**
 * Logger utility for User Service
 * Provides structured logging for user management, authentication, and social features
 */

const winston = require('winston');
const path = require('path');

// Ensure logs directory exists
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format for user operations
const userLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, userId, email, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      service: 'user-service',
      userId,
      email,
      message,
      ...meta
    });
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: userLogFormat,
  defaultMeta: { service: 'user-service' },
  transports: [
    // Authentication logs
    new winston.transports.File({
      filename: path.join(logsDir, 'auth.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Security logs (errors, failed logins, etc.)
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 5242880,
      maxFiles: 5
    }),
    
    // Social interaction logs
    new winston.transports.File({
      filename: path.join(logsDir, 'social.log'),
      level: 'info',
      maxsize: 5242880,
      maxFiles: 5
    }),
    
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
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
        winston.format.printf(({ timestamp, level, message, userId, ...meta }) => {
          const userInfo = userId ? `[${userId}] ` : '';
          return `${timestamp} [${level}] ${userInfo}${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    })
  ]
});

// Create child loggers for specific operations
const authLogger = logger.child({ component: 'authentication' });
const socialLogger = logger.child({ component: 'social' });
const profileLogger = logger.child({ component: 'profile' });
const securityLogger = logger.child({ component: 'security' });

module.exports = {
  logger,
  authLogger,
  socialLogger,
  profileLogger,
  securityLogger
};
