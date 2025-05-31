/**
 * Authentication Middleware
 * 
 * Handles JWT token verification, user authentication, and role-based access control.
 * This middleware extracts and validates JWT tokens from the Authorization header,
 * looks up the associated user, and attaches the user object to the request.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { UserRole, JwtPayload } from '@sermonflow/types';
import { ApiError } from '../utils/errors';

// Rate limiter specifically for authentication failures
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 failed attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  message: 'Too many failed authentication attempts, please try again later',
});

/**
 * Middleware to authenticate requests using JWT
 * Verifies the token and attaches the user to the request object
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    
    // If no token is found and this is an optional auth route, continue
    if (!token && req.path.includes('/public')) {
      return next();
    }
    
    // If no token is found, throw an error
    if (!token) {
      throw new ApiError(401, 'Authentication required. Please provide a valid token');
    }
    
    // Verify the token
    const decoded = verifyToken(token, req);
    
    // Look up the user in the database
    const user = await findUser(decoded, req);
    
    // Attach the user to the request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    
    // Log successful authentication
    req.logger.info({
      userId: user.id,
      action: 'authentication',
      outcome: 'success'
    }, 'User authenticated successfully');
    
    next();
  } catch (error) {
    // Handle authentication errors
    handleAuthError(error, req, res, next);
  }
};

/**
 * Middleware to require specific roles for access
 * @param roles - Array of roles that are allowed to access the route
 */
export const requireRoles = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user exists and has been authenticated
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    
    // Check if user has one of the required roles
    if (!roles.includes(req.user.role as UserRole)) {
      req.logger.warn({
        userId: req.user.id,
        action: 'authorization',
        outcome: 'failure',
        requiredRoles: roles,
        userRole: req.user.role
      }, 'Insufficient permissions');
      
      return next(new ApiError(403, 'Insufficient permissions to access this resource'));
    }
    
    next();
  };
};

/**
 * Middleware for optional authentication
 * Will attach user to request if valid token is provided, but won't fail if no token exists
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    
    // If no token, just continue without authentication
    if (!token) {
      return next();
    }
    
    // Verify token and attach user if valid
    const decoded = verifyToken(token, req);
    const user = await findUser(decoded, req);
    
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    // Just continue without authentication on error
    // But log the failed attempt
    if (error instanceof Error) {
      req.logger.info({
        action: 'optional-authentication',
        outcome: 'failure',
        error: error.message
      }, 'Optional authentication failed');
    }
    next();
  }
};

/**
 * Middleware to refresh an expired token
 * Uses the refresh token to issue a new access token
 */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token is required');
    }
    
    // Verify the refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET || 'refresh-fallback-secret-key-change-in-production'
    ) as JwtPayload;
    
    // Look up the user
    const user = await req.prisma.user.findUnique({
      where: { id: decoded.sub }
    });
    
    if (!user) {
      throw new ApiError(401, 'Invalid refresh token - user not found');
    }
    
    // Generate new access token
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    
    // Log token refresh
    req.logger.info({
      userId: user.id,
      action: 'token-refresh',
      outcome: 'success'
    }, 'Access token refreshed successfully');
    
    // Return new access token
    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
      }
    });
  } catch (error) {
    // Handle refresh token errors
    handleAuthError(error, req, res, next);
  }
};

/**
 * Helper function to extract the token from the request
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  // Check query parameter (less secure, but useful for WebSocket connections)
  if (req.query && req.query.token) {
    return req.query.token as string;
  }
  
  // Check cookies (if using cookie-based auth)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * Helper function to verify the JWT token
 */
function verifyToken(token: string, req: Request): JwtPayload {
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
    ) as JwtPayload;
  } catch (error) {
    // Log token verification failure
    req.logger.warn({
      action: 'token-verification',
      outcome: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Token verification failed');
    
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Token has expired. Please refresh your token or login again');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Invalid token. Please login again');
    } else {
      throw new ApiError(401, 'Token validation failed');
    }
  }
}

/**
 * Helper function to find the user in the database
 */
async function findUser(decoded: JwtPayload, req: Request) {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: decoded.sub }
    });
    
    if (!user) {
      req.logger.warn({
        action: 'user-lookup',
        outcome: 'failure',
        userId: decoded.sub
      }, 'User not found for valid token');
      
      throw new ApiError(401, 'User not found or has been deleted');
    }
    
    return user;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    req.logger.error({
      action: 'user-lookup',
      outcome: 'failure',
      userId: decoded.sub,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Database error during user lookup');
    
    throw new ApiError(500, 'Authentication error - please try again later');
  }
}

/**
 * Helper function to handle authentication errors
 */
function handleAuthError(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Apply rate limiting for failed authentication attempts
  authRateLimiter(req, res, (rateLimitError) => {
    if (rateLimitError) {
      return next(rateLimitError);
    }
    
    // Log the authentication failure
    req.logger.warn({
      action: 'authentication',
      outcome: 'failure',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Authentication failed');
    
    // Pass the error to the error handler
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(401, 'Authentication failed'));
    }
  });
}

/**
 * Helper function to check if the current user is the owner of a resource
 */
export function isResourceOwner(userId: string, req: Request): boolean {
  return req.user?.id === userId;
}

/**
 * Middleware to check if the user is the owner of a resource or has admin privileges
 * @param getUserId - Function to extract the owner user ID from the request
 */
export const requireOwnerOrAdmin = (
  getUserId: (req: Request) => string | Promise<string>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user exists and has been authenticated
      if (!req.user) {
        return next(new ApiError(401, 'Authentication required'));
      }
      
      // Admin can access any resource
      if (req.user.role === UserRole.ADMIN) {
        return next();
      }
      
      // Get the resource owner ID
      const ownerId = await Promise.resolve(getUserId(req));
      
      // Check if the current user is the owner
      if (req.user.id !== ownerId) {
        req.logger.warn({
          userId: req.user.id,
          action: 'resource-access',
          outcome: 'failure',
          resourceOwnerId: ownerId
        }, 'Unauthorized resource access attempt');
        
        return next(new ApiError(403, 'You do not have permission to access this resource'));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};
