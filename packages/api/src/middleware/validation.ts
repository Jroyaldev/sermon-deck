/**
 * Request Validation Middleware
 * 
 * This middleware uses Zod schemas to validate request data (body, query, params).
 * It provides type-safe validation with clear error messages and integrates with
 * the application's error handling system.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Options for the validation middleware
 */
interface ValidationOptions {
  /**
   * Whether to validate the request body
   * @default true
   */
  body?: boolean;
  
  /**
   * Whether to validate the request query parameters
   * @default false
   */
  query?: boolean;
  
  /**
   * Whether to validate the request route parameters
   * @default false
   */
  params?: boolean;
  
  /**
   * Whether to strip unknown properties from the validated data
   * @default true
   */
  stripUnknown?: boolean;
  
  /**
   * Whether to allow partial validation (useful for PATCH requests)
   * @default false
   */
  partial?: boolean;
}

/**
 * Default validation options
 */
const defaultOptions: ValidationOptions = {
  body: true,
  query: false,
  params: false,
  stripUnknown: true,
  partial: false,
};

/**
 * Middleware factory that creates a validation middleware for the given schema
 * 
 * @param schema The Zod schema to validate against
 * @param options Validation options
 * @returns Express middleware function
 */
export function validateRequest<T extends z.ZodType>(
  schema: T,
  options: ValidationOptions = {}
) {
  // Merge options with defaults
  const opts = { ...defaultOptions, ...options };
  
  // Create a partial schema if needed
  const validationSchema = opts.partial ? schema.partial() : schema;
  
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Create an object to store validation errors
      const errors: Record<string, z.ZodError> = {};
      
      // Validate request body if enabled
      if (opts.body && req.body) {
        try {
          const parsed = validationSchema.parse(req.body);
          // Replace request body with validated data
          req.body = parsed;
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.body = error;
          } else {
            throw error;
          }
        }
      }
      
      // Validate query parameters if enabled
      if (opts.query && req.query) {
        try {
          const parsed = validationSchema.parse(req.query);
          // Replace query with validated data
          req.query = parsed;
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.query = error;
          } else {
            throw error;
          }
        }
      }
      
      // Validate route parameters if enabled
      if (opts.params && req.params) {
        try {
          const parsed = validationSchema.parse(req.params);
          // Replace params with validated data
          req.params = parsed;
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.params = error;
          } else {
            throw error;
          }
        }
      }
      
      // If there are validation errors, throw a ValidationError
      if (Object.keys(errors).length > 0) {
        throw new ValidationError('Validation failed', formatValidationErrors(errors));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Format Zod validation errors into a user-friendly format
 * 
 * @param errors Object containing Zod errors for different parts of the request
 * @returns Formatted error messages
 */
function formatValidationErrors(errors: Record<string, z.ZodError>): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {};
  
  for (const [location, zodError] of Object.entries(errors)) {
    formattedErrors[location] = [];
    
    for (const issue of zodError.errors) {
      const path = issue.path.join('.');
      const message = issue.message;
      
      formattedErrors[location].push(
        path ? `${path}: ${message}` : message
      );
    }
  }
  
  return formattedErrors;
}

/**
 * Middleware to validate request body against a schema
 * 
 * @param schema The Zod schema to validate against
 * @param options Validation options
 * @returns Express middleware function
 */
export function validateBody<T extends z.ZodType>(
  schema: T,
  options: Omit<ValidationOptions, 'body' | 'query' | 'params'> = {}
) {
  return validateRequest(schema, { ...options, body: true, query: false, params: false });
}

/**
 * Middleware to validate query parameters against a schema
 * 
 * @param schema The Zod schema to validate against
 * @param options Validation options
 * @returns Express middleware function
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  options: Omit<ValidationOptions, 'body' | 'query' | 'params'> = {}
) {
  return validateRequest(schema, { ...options, body: false, query: true, params: false });
}

/**
 * Middleware to validate route parameters against a schema
 * 
 * @param schema The Zod schema to validate against
 * @param options Validation options
 * @returns Express middleware function
 */
export function validateParams<T extends z.ZodType>(
  schema: T,
  options: Omit<ValidationOptions, 'body' | 'query' | 'params'> = {}
) {
  return validateRequest(schema, { ...options, body: false, query: false, params: true });
}

/**
 * Middleware to validate partial request body (for PATCH requests)
 * 
 * @param schema The Zod schema to validate against
 * @param options Validation options
 * @returns Express middleware function
 */
export function validatePartial<T extends z.ZodType>(
  schema: T,
  options: Omit<ValidationOptions, 'partial'> = {}
) {
  return validateRequest(schema, { ...options, partial: true });
}
