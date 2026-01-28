/**
 * Error handling middleware for the MIA Backend.
 * Provides centralized error processing and standardized API error responses.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../config/logger';
import { ApiResponse } from '../shared/types/common.types';

/**
 * Custom application error class with structured error information.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Global error handling middleware.
 * Logs errors and returns standardized JSON error responses.
 * Handles different types of errors (Zod validation, custom AppError, unknown).
 *
 * @param err - The error that occurred
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (unused)
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.issues,
      },
    };
    return res.status(400).json(response);
  }

  // Handle custom app errors
  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    return res.status(err.statusCode).json(response);
  }

  // Handle unknown errors
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  res.status(500).json(response);
}
