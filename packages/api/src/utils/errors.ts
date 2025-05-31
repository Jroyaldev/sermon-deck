/**
 * Error Handling Utilities
 * 
 * This module provides comprehensive error handling utilities for the SermonFlow API,
 * including custom error classes, error formatting, and error handling middleware.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { ApiResponse } from '@sermonflow/types';

// =============================================================================
// ERROR CODE CONSTANTS
// =============================================================================

/**
 * Error codes for consistent error handling throughout the application
 */
export const ErrorCodes = {
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  
  // Authentication errors
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // Authorization errors
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNIQUE_CONSTRAINT: 'UNIQUE_CONSTRAINT',
  FOREIGN_KEY_CONSTRAINT: 'FOREIGN_KEY_CONSTRAINT',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // File upload errors
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  
  // Business logic errors
  INVALID_OPERATION: 'INVALID_OPERATION',
  RESOURCE_EXISTS: 'RESOURCE_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
  STORAGE_SERVICE_ERROR: 'STORAGE_SERVICE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// =============================================================================
// CUSTOM ERROR CLASSES
// =============================================================================

/**
 * Base API Error class for HTTP errors
 */
export class ApiError extends Error {
  statusCode: number;
  code: ErrorCode;
  details?: unknown;
  isOperational: boolean;
  
  constructor(
    statusCode: number,
    message: string,
    code: ErrorCode = ErrorCodes.UNKNOWN_ERROR,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where the error was thrown
    Error.captureStackTrace(this, this.constructor);
    
    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, message, ErrorCodes.NOT_FOUND, details);
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', code: ErrorCode = ErrorCodes.BAD_REQUEST, details?: unknown) {
    super(400, message, code, details);
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends BadRequestError {
  constructor(message = 'Validation error', details?: unknown) {
    super(message, ErrorCodes.VALIDATION_ERROR, details);
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends ApiError {
  constructor(
    message = 'Authentication required',
    code: ErrorCode = ErrorCodes.AUTHENTICATION_REQUIRED,
    details?: unknown
  ) {
    super(401, message, code, details);
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends ApiError {
  constructor(
    message = 'Insufficient permissions to access this resource',
    code: ErrorCode = ErrorCodes.FORBIDDEN,
    details?: unknown
  ) {
    super(403, message, code, details);
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends ApiError {
  constructor(
    message = 'Resource conflict',
    code: ErrorCode = ErrorCodes.RESOURCE_CONFLICT,
    details?: unknown
  ) {
    super(409, message, code, details);
  }
}

/**
 * Too Many Requests Error (429)
 */
export class TooManyRequestsError extends ApiError {
  constructor(
    message = 'Rate limit exceeded',
    details?: unknown
  ) {
    super(429, message, ErrorCodes.RATE_LIMIT_EXCEEDED, details);
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends ApiError {
  constructor(
    message = 'Internal server error',
    code: ErrorCode = ErrorCodes.UNKNOWN_ERROR,
    details?: unknown
  ) {
    super(500, message, code, details, false);
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends ApiError {
  constructor(
    message = 'Service temporarily unavailable',
    code: ErrorCode = ErrorCodes.EXTERNAL_SERVICE_ERROR,
    details?: unknown
  ) {
    super(503, message, code, details, false);
  }
}

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logError(err, req);
  
  // Format the error response
  const errorResponse = formatErrorResponse(err, req);
  
  // Send the error response
  res.status(errorResponse.statusCode).json({
    success: false,
    error: errorResponse.error
  } as ApiResponse);
};

// =============================================================================
// ERROR FORMATTING UTILITIES
// =============================================================================

/**
 * Format error response based on error type
 */
export function formatErrorResponse(err: Error, req: Request): {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
} {
  // Default error response
  const defaultResponse = {
    statusCode: 500,
    error: {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: 'An unexpected error occurred',
    },
  };
  
  // Check if it's a custom API error
  if (err instanceof ApiError) {
    return {
      statusCode: err.statusCode,
      error: {
        code: err.code,
        message: err.message,
        details: shouldIncludeErrorDetails(req) ? err.details : undefined,
      },
    };
  }
  
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation error',
        details: shouldIncludeErrorDetails(req) ? formatZodError(err) : undefined,
      },
    };
  }
  
  // Handle Prisma database errors
  if (err instanceof PrismaClientKnownRequestError) {
    return formatPrismaError(err, req);
  }
  
  if (err instanceof PrismaClientValidationError) {
    return {
      statusCode: 400,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Database validation error',
        details: shouldIncludeErrorDetails(req) ? err.message : undefined,
      },
    };
  }
  
  // Handle Multer file upload errors
  if (err instanceof MulterError) {
    return formatMulterError(err, req);
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      error: {
        code: ErrorCodes.TOKEN_INVALID,
        message: 'Invalid authentication token',
        details: shouldIncludeErrorDetails(req) ? err.message : undefined,
      },
    };
  }
  
  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      error: {
        code: ErrorCodes.TOKEN_EXPIRED,
        message: 'Authentication token has expired',
        details: shouldIncludeErrorDetails(req) ? err.message : undefined,
      },
    };
  }
  
  // Handle rate limit errors
  if (err.name === 'RateLimitExceeded' || err.message.includes('rate limit')) {
    return {
      statusCode: 429,
      error: {
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests, please try again later',
        details: shouldIncludeErrorDetails(req) ? err.message : undefined,
      },
    };
  }
  
  // For all other errors, return a generic error in production
  // and more details in development
  return {
    statusCode: 500,
    error: {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: 'An unexpected error occurred',
      details: shouldIncludeErrorDetails(req) ? {
        name: err.name,
        message: err.message,
        stack: err.stack,
      } : undefined,
    },
  };
}

/**
 * Format Zod validation errors
 */
function formatZodError(err: ZodError): unknown {
  return err.errors.map(e => ({
    path: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
}

/**
 * Format Prisma database errors
 */
function formatPrismaError(err: PrismaClientKnownRequestError, req: Request): {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
} {
  // Handle common Prisma error codes
  switch (err.code) {
    case 'P2002': // Unique constraint violation
      return {
        statusCode: 409,
        error: {
          code: ErrorCodes.UNIQUE_CONSTRAINT,
          message: 'A record with this information already exists',
          details: shouldIncludeErrorDetails(req) ? {
            fields: err.meta?.target,
            error: err.message,
          } : undefined,
        },
      };
      
    case 'P2003': // Foreign key constraint violation
      return {
        statusCode: 400,
        error: {
          code: ErrorCodes.FOREIGN_KEY_CONSTRAINT,
          message: 'Invalid reference to a related record',
          details: shouldIncludeErrorDetails(req) ? {
            field: err.meta?.field_name,
            error: err.message,
          } : undefined,
        },
      };
      
    case 'P2025': // Record not found
      return {
        statusCode: 404,
        error: {
          code: ErrorCodes.RECORD_NOT_FOUND,
          message: 'The requested record does not exist',
          details: shouldIncludeErrorDetails(req) ? {
            error: err.message,
          } : undefined,
        },
      };
      
    default:
      return {
        statusCode: 500,
        error: {
          code: ErrorCodes.DATABASE_ERROR,
          message: 'Database operation failed',
          details: shouldIncludeErrorDetails(req) ? {
            code: err.code,
            error: err.message,
          } : undefined,
        },
      };
  }
}

/**
 * Format Multer file upload errors
 */
function formatMulterError(err: MulterError, req: Request): {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
} {
  let errorCode: ErrorCode = ErrorCodes.UPLOAD_ERROR;
  let statusCode = 400;
  let message = 'File upload error';
  
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      errorCode = ErrorCodes.FILE_TOO_LARGE;
      message = 'File is too large';
      break;
      
    case 'LIMIT_UNEXPECTED_FILE':
      errorCode = ErrorCodes.INVALID_FILE_TYPE;
      message = 'Unexpected file field';
      break;
      
    case 'LIMIT_FILE_COUNT':
      message = 'Too many files uploaded';
      break;
      
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_PART_COUNT':
      message = 'File upload request is malformed';
      break;
  }
  
  return {
    statusCode,
    error: {
      code: errorCode,
      message,
      details: shouldIncludeErrorDetails(req) ? {
        field: err.field,
        code: err.code,
      } : undefined,
    },
  };
}

// =============================================================================
// ERROR LOGGING UTILITIES
// =============================================================================

/**
 * Log error with appropriate level and details
 */
export function logError(err: Error, req: Request): void {
  // Get logger from request or use console as fallback
  const logger = req.logger || console;
  
  // Determine if this is an operational error (expected) or programming error (unexpected)
  const isOperational = err instanceof ApiError && err.isOperational;
  
  // Log with appropriate level
  if (isOperational) {
    // Operational errors are expected and handled gracefully
    logger.info({
      err,
      requestId: req.id,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }, `Operational error: ${err.message}`);
  } else {
    // Programming errors are unexpected and need immediate attention
    logger.error({
      err,
      requestId: req.id,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      body: sanitizeRequestBody(req.body),
      query: req.query,
      params: req.params,
    }, `Unexpected error: ${err.message}`);
  }
}

/**
 * Sanitize request body for logging to remove sensitive information
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return body;
  
  // Create a copy to avoid modifying the original
  const sanitized = { ...body };
  
  // List of sensitive fields to redact
  const sensitiveFields = [
    'password',
    'newPassword',
    'currentPassword',
    'token',
    'refreshToken',
    'accessToken',
    'apiKey',
    'secret',
    'creditCard',
    'cardNumber',
    'cvv',
  ];
  
  // Redact sensitive fields
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Determine if detailed error information should be included in the response
 * based on the environment and request headers
 */
function shouldIncludeErrorDetails(req: Request): boolean {
  // Always include details in development environment
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return true;
  }
  
  // Check for debug mode header (can be used by admin tools)
  const debugMode = req.headers['x-debug-mode'];
  if (debugMode === process.env.DEBUG_SECRET) {
    return true;
  }
  
  // In production, only include details for specific error types or users
  return false;
}

// =============================================================================
// ERROR HANDLING HELPERS
// =============================================================================

/**
 * Wrap an async route handler with error catching
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Assert that a condition is true, or throw an error
 */
export function assert(condition: boolean, error: ApiError | string): void {
  if (!condition) {
    if (typeof error === 'string') {
      throw new BadRequestError(error);
    } else {
      throw error;
    }
  }
}

/**
 * Throw a not found error if the value is null or undefined
 */
export function assertExists<T>(value: T | null | undefined, message = 'Resource not found'): T {
  if (value === null || value === undefined) {
    throw new NotFoundError(message);
  }
  return value;
}

/**
 * Create an error response object
 */
export function createErrorResponse<T = unknown>(
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: T
): {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: T;
  };
} {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Create a success response object
 */
export function createSuccessResponse<T = unknown>(data?: T): {
  success: true;
  data?: T;
} {
  return {
    success: true,
    data,
  };
}
