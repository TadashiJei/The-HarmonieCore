/**
 * Email service utility for User Service
 * Handles email sending for verification, password reset, and notifications
 */

const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const logger = require('./logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.sendgrid = null;
    this.initialize();
  }

  initialize() {
    // Configure SendGrid if API key is provided
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.sendgrid = sgMail;
    }

    // Configure Nodemailer transporter for SMTP
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  /**
   * Send email using configured provider
   */
  async sendEmail({ to, subject, html, text, from = process.env.EMAIL_FROM }) {
    try {
      const emailOptions = {
        from: from || process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text
      };

      let result;

      // Use SendGrid if available
      if (this.sendgrid) {
        result = await this.sendgrid.send(emailOptions);
        logger.logger.info('Email sent via SendGrid', { to, subject });
      } else if (this.transporter) {
        result = await this.transporter.sendMail(emailOptions);
        logger.logger.info('Email sent via Nodemailer', { to, subject });
      } else {
        throw new Error('No email service configured');
      }

      return result;
    } catch (error) {
      logger.logger.error('Email sending failed:', error);
      throw error;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, token) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - HarmonieCore</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to HarmonieCore!</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up for HarmonieCore! To complete your registration, please click the button below to verify your email address.</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>This link will expire in 24 hours for security reasons.</p>
          </div>
          <div class="footer">
            <p>If you didn't create this account, you can safely ignore this email.</p>
            <p>© 2024 HarmonieCore. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to HarmonieCore!
      
      Please verify your email address by clicking this link:
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create this account, you can safely ignore this email.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Verify your HarmonieCore account',
      html,
      text
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - HarmonieCore</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Click the button below to create a new password.</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this password reset, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 HarmonieCore. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request
      
      We received a request to reset your password. Click this link to reset it:
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this password reset, you can safely ignore this email.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Reset your HarmonieCore password',
      html,
      text
    });
  }

  /**
   * Send welcome email after successful registration
   */
  async sendWelcomeEmail(email, username) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to HarmonieCore</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to HarmonieCore!</h1>
          </div>
          <div class="content">
            <h2>Hello, ${username}!</h2>
            <p>Welcome to HarmonieCore, the decentralized platform for artists and creators. You're now part of a vibrant community where you can:</p>
            <ul>
              <li>Connect with other artists and fans</li>
              <li>Share your creative work</li>
              <li>Receive tips and support from your audience</li>
              <li>Build your artistic brand</li>
            </ul>
            <a href="${process.env.FRONTEND_URL}/profile" class="button">Complete Your Profile</a>
            <p>Get started by completing your profile and exploring the community!</p>
          </div>
          <div class="footer">
            <p>© 2024 HarmonieCore. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to HarmonieCore, ${username}!
      
      You're now part of a vibrant community where you can connect with artists, share your work, and receive support from your audience.
      
      Get started by completing your profile: ${process.env.FRONTEND_URL}/profile
      
      © 2024 HarmonieCore. All rights reserved.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Welcome to HarmonieCore!',
      html,
      text
    });
  }

  /**
   * Send new follower notification
   */
  async sendNewFollowerEmail(email, followerUsername, followerDisplayName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Follower - HarmonieCore</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Follower!</h1>
          </div>
          <div class="content">
            <h2>Great news!</h2>
            <p><strong>${followerDisplayName}</strong> (@${followerUsername}) just started following you on HarmonieCore!</p>
            <a href="${process.env.FRONTEND_URL}/@${followerUsername}" class="button">View Profile</a>
            <p>Keep creating amazing content to engage your growing audience!</p>
          </div>
          <div class="footer">
            <p>© 2024 HarmonieCore. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      New follower on HarmonieCore!
      
      ${followerDisplayName} (@${followerUsername}) just started following you.
      
      View their profile: ${process.env.FRONTEND_URL}/@${followerUsername}
      
      Keep creating amazing content!
    `;

    await this.sendEmail({
      to: email,
      subject: `${followerDisplayName} started following you on HarmonieCore`,
      html,
      text
    });
  }
}

const emailService = new EmailService();
module.exports = emailService;
