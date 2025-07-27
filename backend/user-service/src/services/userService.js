/**
 * User Management Service
 * Handles user authentication, profiles, social features, and artist management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const redis = require('redis');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/emailService');

class UserService {
  constructor() {
    this.redis = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || ''
    });

    // Cloudinary configuration for profile images
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
  }

  /**
   * User registration with email verification
   */
  async registerUser(userData) {
    try {
      const { email, username, password, displayName, role = 'fan' } = userData;

      // Check if user already exists
      const existingUser = await this.findUserByEmail(email);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      const existingUsername = await this.findUserByUsername(username);
      if (existingUsername) {
        throw new Error('Username already taken');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const user = new User({
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        displayName,
        role,
        verificationToken,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await user.save();

      // Send verification email
      await this.sendVerificationEmail(user.email, verificationToken);

      // Create user profile
      await this.createUserProfile(user._id, userData);

      logger.info('User registered', { userId: user._id, email: user.email });

      return {
        user: this.sanitizeUser(user),
        message: 'Registration successful. Please check your email for verification.'
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * User login with JWT token generation
   */
  async loginUser(email, password) {
    try {
      const user = await this.findUserByEmail(email.toLowerCase());
      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (!user.isEmailVerified) {
        throw new Error('Please verify your email address');
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Cache user session
      await this.redis.setEx(
        `session:${user._id}`,
        86400, // 24 hours
        JSON.stringify({ userId: user._id, tokens })
      );

      logger.info('User logged in', { userId: user._id, email: user.email });

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Get user profile with enriched data
   */
  async getUserProfile(userId, requesterId = null) {
    try {
      const user = await User.findById(userId)
        .populate('profile')
        .populate('followers', 'username displayName avatar')
        .populate('following', 'username displayName avatar')
        .populate('blockedUsers', 'username displayName');

      if (!user) {
        throw new Error('User not found');
      }

      // Check privacy settings
      if (requesterId && user.privacySettings.profileVisibility === 'private') {
        const isFollowing = await this.isFollowing(requesterId, userId);
        if (!isFollowing && requesterId !== userId) {
          return this.getPublicProfile(user);
        }
      }

      // Get additional stats
      const stats = await this.getUserStats(userId);

      return {
        ...this.sanitizeUser(user),
        profile: user.profile,
        stats,
        followers: user.followers,
        following: user.following
      };
    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updates) {
    try {
      const allowedUpdates = [
        'displayName', 'bio', 'location', 'website', 'socialLinks',
        'avatar', 'banner', 'preferences', 'privacySettings'
      ];

      const filteredUpdates = {};
      for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { ...filteredUpdates, updatedAt: new Date() },
        { new: true }
      ).populate('profile');

      if (!user) {
        throw new Error('User not found');
      }

      // Update cache
      await this.redis.setEx(
        `user:${userId}`,
        3600, // 1 hour
        JSON.stringify(user)
      );

      logger.info('Profile updated', { userId, updates: Object.keys(filteredUpdates) });

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Upload and process profile avatar
   */
  async uploadAvatar(userId, file) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Process image
      const processedImage = await sharp(file.buffer)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${processedImage.toString('base64')}`,
        {
          folder: 'avatars',
          public_id: `user_${userId}_${Date.now()}`,
          overwrite: true
        }
      );

      // Update user avatar
      user.avatar = {
        url: result.secure_url,
        publicId: result.public_id
      };
      await user.save();

      logger.info('Avatar uploaded', { userId, url: result.secure_url });

      return {
        avatarUrl: result.secure_url
      };
    } catch (error) {
      logger.error('Avatar upload error:', error);
      throw error;
    }
  }

  /**
   * Follow/unfollow user
   */
  async toggleFollow(followerId, followingId) {
    try {
      if (followerId === followingId) {
        throw new Error('Cannot follow yourself');
      }

      const follower = await User.findById(followerId);
      const following = await User.findById(followingId);

      if (!follower || !following) {
        throw new Error('User not found');
      }

      const isFollowing = follower.following.includes(followingId);

      if (isFollowing) {
        // Unfollow
        follower.following.pull(followingId);
        following.followers.pull(followerId);
      } else {
        // Follow
        follower.following.push(followingId);
        following.followers.push(followerId);

        // Send notification
        await this.sendFollowNotification(followerId, followingId);
      }

      await Promise.all([follower.save(), following.save()]);

      // Update cache
      await this.updateFollowCache(followerId, followingId, !isFollowing);

      logger.info('Follow toggled', { followerId, followingId, action: isFollowing ? 'unfollow' : 'follow' });

      return {
        isFollowing: !isFollowing,
        followerCount: following.followers.length,
        followingCount: follower.following.length
      };
    } catch (error) {
      logger.error('Follow toggle error:', error);
      throw error;
    }
  }

  /**
   * Get user's followers/following list
   */
  async getSocialList(userId, type = 'followers', limit = 20, offset = 0) {
    try {
      const user = await User.findById(userId)
        .populate(type, 'username displayName avatar bio followersCount followingCount');

      if (!user) {
        throw new Error('User not found');
      }

      const list = user[type] || [];
      const paginatedList = list.slice(offset, offset + limit);

      return {
        users: paginatedList,
        total: list.length,
        hasMore: offset + limit < list.length
      };
    } catch (error) {
      logger.error('Get social list error:', error);
      throw error;
    }
  }

  /**
   * Block/unblock user
   */
  async toggleBlock(userId, blockedUserId) {
    try {
      if (userId === blockedUserId) {
        throw new Error('Cannot block yourself');
      }

      const user = await User.findById(userId);
      const blockedUser = await User.findById(blockedUserId);

      if (!user || !blockedUser) {
        throw new Error('User not found');
      }

      const isBlocked = user.blockedUsers.includes(blockedUserId);

      if (isBlocked) {
        // Unblock
        user.blockedUsers.pull(blockedUserId);
      } else {
        // Block
        user.blockedUsers.push(blockedUserId);
        
        // Remove from following/followers
        user.following.pull(blockedUserId);
        user.followers.pull(blockedUserId);
        blockedUser.following.pull(userId);
        blockedUser.followers.pull(userId);

        await blockedUser.save();
      }

      await user.save();

      logger.info('Block toggled', { userId, blockedUserId, action: isBlocked ? 'unblock' : 'block' });

      return {
        isBlocked: !isBlocked,
        blockedCount: user.blockedUsers.length
      };
    } catch (error) {
      logger.error('Block toggle error:', error);
      throw error;
    }
  }

  /**
   * Search users
   */
  async searchUsers(query, filters = {}, limit = 20, offset = 0) {
    try {
      const searchQuery = {
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { displayName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ],
        isEmailVerified: true,
        status: 'active'
      };

      if (filters.role) {
        searchQuery.role = filters.role;
      }

      if (filters.location) {
        searchQuery['profile.location'] = { $regex: filters.location, $options: 'i' };
      }

      const users = await User.find(searchQuery)
        .select('-password -verificationToken -resetPasswordToken')
        .populate('profile')
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: -1 });

      const total = await User.countDocuments(searchQuery);

      return {
        users,
        total,
        hasMore: offset + limit < total
      };
    } catch (error) {
      logger.error('Search users error:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const stats = {
        followersCount: user.followers.length,
        followingCount: user.following.length,
        contentCount: await this.getUserContentCount(userId),
        totalLikes: await this.getUserTotalLikes(userId),
        joinedDate: user.createdAt,
        lastActive: user.lastLogin
      };

      return stats;
    } catch (error) {
      logger.error('Get user stats error:', error);
      throw error;
    }
  }

  /**
   * Generate JWT tokens
   */
  async generateTokens(user) {
    const payload = {
      userId: user._id,
      email: user.email,
      username: user.username,
      role: user.role
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiresIn
    };
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Helper methods
   */
  async findUserByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
  }

  async findUserByUsername(username) {
    return User.findOne({ username: username.toLowerCase() });
  }

  async createUserProfile(userId, userData) {
    const profile = new UserProfile({
      userId,
      bio: userData.bio || '',
      location: userData.location || '',
      website: userData.website || '',
      socialLinks: userData.socialLinks || {},
      preferences: userData.preferences || {},
      privacySettings: userData.privacySettings || {
        profileVisibility: 'public',
        showEmail: false,
        showStats: true
      }
    });

    await profile.save();
    return profile;
  }

  sanitizeUser(user) {
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.verificationToken;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpires;
    return userObj;
  }

  async getPublicProfile(user) {
    return {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt
    };
  }

  async isFollowing(followerId, followingId) {
    const follower = await User.findById(followerId);
    return follower && follower.following.includes(followingId);
  }

  async getUserContentCount(userId) {
    // This would integrate with Content Service
    return 0;
  }

  async getUserTotalLikes(userId) {
    // This would integrate with Content Service
    return 0;
  }

  async updateFollowCache(followerId, followingId, isFollowing) {
    const cacheKey = `following:${followerId}`;
    const cacheValue = await this.redis.get(cacheKey);
    
    if (cacheValue) {
      const followingList = JSON.parse(cacheValue);
      if (isFollowing) {
        followingList.push(followingId);
      } else {
        followingList.filter(id => id !== followingId);
      }
      await this.redis.setEx(cacheKey, 3600, JSON.stringify(followingList));
    }
  }

  async sendFollowNotification(followerId, followingId) {
    // This would integrate with Notification Service
    logger.info('Follow notification sent', { followerId, followingId });
  }

  async sendVerificationEmail(email, token) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await sendEmail({
      to: email,
      subject: 'Verify your HarmonieCore account',
      html: `
        <h1>Welcome to HarmonieCore!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">Verify Email</a>
      `
    });
  }
}

// User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9_-]+$/.test(v);
      },
      message: 'Username can only contain letters, numbers, underscores, and hyphens'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    enum: ['fan', 'artist', 'admin'],
    default: 'fan'
  },
  avatar: {
    url: String,
    publicId: String
  },
  banner: {
    url: String,
    publicId: String
  },
  bio: {
    type: String,
    maxlength: 500
  },
  location: String,
  website: String,
  socialLinks: {
    twitter: String,
    instagram: String,
    discord: String,
    spotify: String,
    soundcloud: String
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    privacy: {
      profileVisibility: { type: String, enum: ['public', 'private', 'unlisted'], default: 'public' },
      showEmail: { type: Boolean, default: false },
      showStats: { type: Boolean, default: true }
    }
  },
  verificationToken: String,
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'followers': 1 });
userSchema.index({ 'following': 1 });
userSchema.index({ createdAt: -1 });

// Virtual for follower/following counts
userSchema.virtual('followersCount').get(function() {
  return this.followers.length;
});

userSchema.virtual('followingCount').get(function() {
  return this.following.length;
});

// Pre-save middleware
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const User = mongoose.model('User', userSchema);

// User Profile Schema
const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  bio: {
    type: String,
    maxlength: 500
  },
  location: String,
  website: String,
  socialLinks: {
    twitter: String,
    instagram: String,
    discord: String,
    spotify: String,
    soundcloud: String,
    youtube: String,
    tiktok: String
  },
  preferences: {
    notifications: {
      newFollowers: { type: Boolean, default: true },
      newContent: { type: Boolean, default: true },
      tips: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true }
    },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showStats: { type: Boolean, default: true },
      allowDirectMessages: { type: Boolean, default: true }
    }
  },
  verification: {
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    verificationType: {
      type: String,
      enum: ['artist', 'influencer', 'business', 'none'],
      default: 'none'
    }
  },
  artistProfile: {
    genres: [String],
    instruments: [String],
    influences: [String],
    experience: String,
    achievements: [String],
    upcomingEvents: [{
      title: String,
      date: Date,
      location: String,
      description: String
    }]
  },
  stats: {
    totalContent: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    totalTips: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = { UserService, User, UserProfile };
