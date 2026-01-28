/**
 * Authentication middleware for the MIA Backend.
 * Handles JWT token verification and injects tenant context into requests.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../modules/auth/auth.services';
import { AppError } from './errorHandler';
import { TenantContext } from '@/shared/types/common.types';

const authService = new AuthService();

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

/**
 * Middleware function to require authentication for protected routes.
 * Verifies the JWT token from the Authorization header and injects tenant context.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'NO_TOKEN', 'No authentication token provided');
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);

    // Inject tenant context into request
    req.tenantContext = {
      tenantId: decoded.tenantId,
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}
