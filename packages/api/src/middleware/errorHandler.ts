/**
 * Error Handler Middleware
 * 
 * This middleware handles all errors thrown during request processing.
 * It formats errors into a consistent API response structure and
 * logs them appropriately based on their severity.
 * 
 * This is a simple re-export of the errorHandler from utils/errors
 * to maintain clean separation of concerns in the codebase.
 */

import { errorHandler } from '../utils/errors';

export { errorHandler };
