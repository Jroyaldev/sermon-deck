/**
 * Authentication Routes
 * 
 * This module provides all authentication-related routes for the SermonFlow API,
 * including user registration, login, token refresh, password reset, and profile management.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { 
  UserRole, 
  loginSchema, 
  registerSchema, 
  userProfileSchema 
} from '@sermonflow/types';
import { 
  ApiError, 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError, 
  asyncHandler,
  assertExists,
  createSuccessResponse
} from '../utils/errors';
import { authenticate, refreshToken as refreshTokenMiddleware, authRateLimiter } from '../middleware/authenticate';
import { sendEmail } from '../services/email';
import { validateRequest } from '../middleware/validation';

const router = express.Router();

// =============================================================================
// RATE LIMITERS
// =============================================================================

// Stricter rate limiting for authentication attempts
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again later',
});

// Rate limiting for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many password reset requests, please try again later',
});

// Rate limiting for registration
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many accounts created from this IP, please try again later',
});

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

// Password reset request schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

// Password reset confirmation schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Email verification schema
const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Change password schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// Update profile schema
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  churchName: z.string().optional(),
  denomination: z.string().optional(),
  bio: z.string().optional(),
});

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * @route POST /api/v1/auth/signup
 * @desc Register a new user
 * @access Public
 */
router.post('/signup', 
  registrationLimiter,
  validateRequest(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, churchName, denomination } = req.body;

    // Check if user already exists
    const existingUser = await req.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new BadRequestError('User with this email already exists');
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = await req.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        churchName,
        denomination,
        role: UserRole.PASTOR, // Default role
        verificationToken,
      }
    });

    // Log user creation
    req.logger.info({
      action: 'user-registration',
      userId: user.id,
      email: user.email,
    }, 'New user registered');

    // Send verification email
    await sendEmail({
      to: email,
      subject: 'Welcome to SermonFlow - Verify Your Email',
      template: 'email-verification',
      context: {
        firstName,
        verificationUrl: `${process.env.WEB_URL}/verify-email?token=${verificationToken}`,
      }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Return user data (excluding sensitive fields)
    const userProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      churchName: user.churchName,
      denomination: user.denomination,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };

    res.status(201).json(createSuccessResponse({
      user: userProfile,
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }));
  })
);

/**
 * @route POST /api/v1/auth/login
 * @desc Authenticate user & get tokens
 * @access Public
 */
router.post('/login',
  loginRateLimiter,
  validateRequest(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Find user by email
    const user = await req.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // If user doesn't exist or password doesn't match
    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Log failed login attempt
      req.logger.warn({
        action: 'login-failed',
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }, 'Failed login attempt');

      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Log successful login
    req.logger.info({
      action: 'login-success',
      userId: user.id,
      email: user.email,
      ip: req.ip,
    }, 'User logged in successfully');

    // Return user data and tokens
    const userProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      churchName: user.churchName,
      denomination: user.denomination,
      role: user.role,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };

    res.json(createSuccessResponse({
      user: userProfile,
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }));
  })
);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user / invalidate refresh token
 * @access Public
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  // If using Redis for token blacklisting
  if (req.redis && refreshToken) {
    try {
      // Decode token to get expiration
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || 'refresh-fallback-secret-key-change-in-production'
      ) as { exp?: number, sub: string };

      if (decoded.exp) {
        // Calculate TTL (time-to-live) for the blacklist entry
        const now = Math.floor(Date.now() / 1000);
        const ttl = decoded.exp - now;

        if (ttl > 0) {
          // Add token to blacklist with TTL
          await req.redis.set(`blacklist:${refreshToken}`, decoded.sub, 'EX', ttl);
          
          req.logger.info({
            action: 'logout',
            userId: decoded.sub,
          }, 'User logged out, token blacklisted');
        }
      }
    } catch (error) {
      // Invalid token, just ignore
      req.logger.info({
        action: 'logout',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Logout with invalid token');
    }
  }

  res.json(createSuccessResponse({ message: 'Logged out successfully' }));
}));

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh', refreshTokenMiddleware);

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password',
  passwordResetLimiter,
  validateRequest(forgotPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    // Find user by email
    const user = await req.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Don't reveal if user exists or not
    if (!user) {
      req.logger.info({
        action: 'password-reset-request',
        email,
        outcome: 'user-not-found',
      }, 'Password reset requested for non-existent user');
      
      // Return success even if user doesn't exist (security)
      return res.json(createSuccessResponse({
        message: 'If your email is registered, you will receive password reset instructions'
      }));
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await req.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      }
    });

    // Send password reset email
    await sendEmail({
      to: email,
      subject: 'SermonFlow - Password Reset Request',
      template: 'password-reset',
      context: {
        firstName: user.firstName,
        resetUrl: `${process.env.WEB_URL}/reset-password?token=${resetToken}`,
      }
    });

    req.logger.info({
      action: 'password-reset-request',
      userId: user.id,
      email: user.email,
    }, 'Password reset requested');

    res.json(createSuccessResponse({
      message: 'If your email is registered, you will receive password reset instructions'
    }));
  })
);

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password',
  passwordResetLimiter,
  validateRequest(resetPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;

    // Find user with valid reset token
    const user = await req.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user password and clear reset token
    await req.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      }
    });

    // Log password reset
    req.logger.info({
      action: 'password-reset',
      userId: user.id,
      email: user.email,
      ip: req.ip,
    }, 'Password reset successfully');

    // Send password change notification email
    await sendEmail({
      to: user.email,
      subject: 'SermonFlow - Your Password Has Been Changed',
      template: 'password-changed',
      context: {
        firstName: user.firstName,
      }
    });

    res.json(createSuccessResponse({
      message: 'Password has been reset successfully'
    }));
  })
);

/**
 * @route POST /api/v1/auth/verify-email
 * @desc Verify email with token
 * @access Public
 */
router.post('/verify-email',
  validateRequest(verifyEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    // Find user with matching verification token
    const user = await req.prisma.user.findFirst({
      where: {
        verificationToken: token
      }
    });

    if (!user) {
      throw new BadRequestError('Invalid verification token');
    }

    // Mark email as verified and clear verification token
    await req.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
      }
    });

    // Log email verification
    req.logger.info({
      action: 'email-verification',
      userId: user.id,
      email: user.email,
    }, 'Email verified successfully');

    res.json(createSuccessResponse({
      message: 'Email verified successfully'
    }));
  })
);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // User should be attached to request by authenticate middleware
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Get user from database with fresh data
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id }
    });

    assertExists(user, 'User not found');

    // Return user profile (excluding sensitive fields)
    const userProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      churchName: user.churchName,
      denomination: user.denomination,
      role: user.role,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };

    res.json(createSuccessResponse({ user: userProfile }));
  })
);

/**
 * @route PUT /api/v1/auth/me
 * @desc Update current user profile
 * @access Private
 */
router.put('/me',
  authenticate,
  validateRequest(updateProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // User should be attached to request by authenticate middleware
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { firstName, lastName, churchName, denomination, bio } = req.body;

    // Update user profile
    const updatedUser = await req.prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(churchName !== undefined && { churchName }),
        ...(denomination !== undefined && { denomination }),
        ...(bio !== undefined && { bio }),
      }
    });

    // Log profile update
    req.logger.info({
      action: 'profile-update',
      userId: updatedUser.id,
      email: updatedUser.email,
    }, 'User profile updated');

    // Return updated user profile
    const userProfile = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      churchName: updatedUser.churchName,
      denomination: updatedUser.denomination,
      role: updatedUser.role,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
      isEmailVerified: updatedUser.isEmailVerified,
      createdAt: updatedUser.createdAt,
    };

    res.json(createSuccessResponse({ user: userProfile }));
  })
);

/**
 * @route POST /api/v1/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password',
  authenticate,
  authRateLimiter,
  validateRequest(changePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // User should be attached to request by authenticate middleware
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id }
    });

    assertExists(user, 'User not found');

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      // Log failed password change attempt
      req.logger.warn({
        action: 'password-change',
        userId: user.id,
        outcome: 'invalid-current-password',
        ip: req.ip,
      }, 'Invalid current password for password change');
      
      throw new BadRequestError('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await req.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword
      }
    });

    // Log password change
    req.logger.info({
      action: 'password-change',
      userId: user.id,
      email: user.email,
      ip: req.ip,
    }, 'Password changed successfully');

    // Send password change notification email
    await sendEmail({
      to: user.email,
      subject: 'SermonFlow - Your Password Has Been Changed',
      template: 'password-changed',
      context: {
        firstName: user.firstName,
      }
    });

    res.json(createSuccessResponse({
      message: 'Password changed successfully'
    }));
  })
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate JWT access token
 */
function generateAccessToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { sub: userId, email, role },
    process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId },
    process.env.REFRESH_TOKEN_SECRET || 'refresh-fallback-secret-key-change-in-production',
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );
}

export default router;
