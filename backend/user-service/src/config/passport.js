/**
 * Passport configuration for OAuth authentication
 * Supports Google, Facebook, Twitter, and Discord OAuth providers
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const jwt = require('jsonwebtoken');
const { User } = require('../services/userService');
const logger = require('../utils/logger');

module.exports = (passport) => {
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ email: profile.emails[0].value });
          
          if (user) {
            // Update Google ID if not already set
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
          } else {
            // Create new user
            user = new User({
              googleId: profile.id,
              email: profile.emails[0].value,
              username: profile.emails[0].value.split('@')[0] + Math.random().toString(36).substr(2, 5),
              displayName: profile.displayName,
              avatar: {
                url: profile.photos[0]?.value
              },
              isEmailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await user.save();
          }

          // Generate JWT token
          const token = jwt.sign(
            { userId: user._id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );

          logger.authLogger.info('Google OAuth login successful', {
            userId: user._id,
            email: user.email
          });

          return done(null, { user, token });
        } catch (error) {
          logger.authLogger.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );

  // Facebook OAuth Strategy
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: '/api/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name', 'picture.type(large)']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ facebookId: profile.id });
          
          if (!user && profile.emails && profile.emails[0]) {
            // Check if email already exists
            user = await User.findOne({ email: profile.emails[0].value });
          }
          
          if (user) {
            if (!user.facebookId) {
              user.facebookId = profile.id;
              await user.save();
            }
          } else {
            user = new User({
              facebookId: profile.id,
              email: profile.emails?.[0]?.value,
              username: `fb_${profile.id}`,
              displayName: `${profile.name.givenName} ${profile.name.familyName}`,
              avatar: {
                url: profile.photos?.[0]?.value
              },
              isEmailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await user.save();
          }

          const token = jwt.sign(
            { userId: user._id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );

          logger.authLogger.info('Facebook OAuth login successful', {
            userId: user._id,
            email: user.email
          });

          return done(null, { user, token });
        } catch (error) {
          logger.authLogger.error('Facebook OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );

  // Twitter OAuth Strategy
  passport.use(
    new TwitterStrategy(
      {
        consumerKey: process.env.TWITTER_CONSUMER_KEY,
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
        callbackURL: '/api/auth/twitter/callback',
        includeEmail: true
      },
      async (token, tokenSecret, profile, done) => {
        try {
          let user = await User.findOne({ twitterId: profile.id });
          
          if (!user && profile.emails && profile.emails[0]) {
            user = await User.findOne({ email: profile.emails[0].value });
          }
          
          if (user) {
            if (!user.twitterId) {
              user.twitterId = profile.id;
              await user.save();
            }
          } else {
            user = new User({
              twitterId: profile.id,
              email: profile.emails?.[0]?.value,
              username: profile.username || `tw_${profile.id}`,
              displayName: profile.displayName,
              avatar: {
                url: profile.photos?.[0]?.value
              },
              isEmailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await user.save();
          }

          const jwtToken = jwt.sign(
            { userId: user._id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );

          logger.authLogger.info('Twitter OAuth login successful', {
            userId: user._id,
            email: user.email
          });

          return done(null, { user, token: jwtToken });
        } catch (error) {
          logger.authLogger.error('Twitter OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );

  // Discord OAuth Strategy
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: '/api/auth/discord/callback',
        scope: ['identify', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ discordId: profile.id });
          
          if (!user && profile.email) {
            user = await User.findOne({ email: profile.email });
          }
          
          if (user) {
            if (!user.discordId) {
              user.discordId = profile.id;
              await user.save();
            }
          } else {
            user = new User({
              discordId: profile.id,
              email: profile.email,
              username: profile.username,
              displayName: profile.global_name || profile.username,
              avatar: {
                url: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null
              },
              isEmailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await user.save();
          }

          const token = jwt.sign(
            { userId: user._id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );

          logger.authLogger.info('Discord OAuth login successful', {
            userId: user._id,
            email: user.email
          });

          return done(null, { user, token });
        } catch (error) {
          logger.authLogger.error('Discord OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );

  // Serialize/deserialize user for session management
  passport.serializeUser((user, done) => {
    done(null, user.user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
