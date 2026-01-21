import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.services';
import { RegisterInput, LoginInput } from './auth.types';

/**
 * ============================
 * AUTH CONTROLLER
 * ============================
 *
 * The AuthController is responsible for:
 * - Receiving HTTP requests
 * - Extracting validated input data
 * - Calling the appropriate service methods
 * - Sending HTTP responses
 *
 * IMPORTANT:
 * - Controllers should NOT contain business logic
 * - Controllers should NOT handle errors directly
 * - Controllers should be thin and predictable
 */

const authService = new AuthService();

export class AuthController {
  /**
   * ============================
   * REGISTER (SIGN UP)
   * ============================
   *
   * Handles user registration requests.
   *
   * Flow:
   * 1. Read validated input from req.body
   * 2. Call the AuthService to perform business logic
   * 3. Return the created user and auth token
   *
   * Errors are forwarded to the global error handler.
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      // Request body is expected to match RegisterSchema
      // (validated earlier by a validation middleware)
      const input: RegisterInput = req.body;

      // Delegate registration logic to the service layer
      const result = await authService.register(input);

      // Respond with HTTP 201 (resource created)
      res.status(201).json(result);
    } catch (error) {
      // Forward any error to the global error handler
      next(error);
    }
  }

  /**
   * ============================
   * LOGIN
   * ============================
   *
   * Handles user login requests.
   *
   * Flow:
   * 1. Read validated login credentials from req.body
   * 2. Call the AuthService to authenticate the user
   * 3. Return a JWT token and user information
   *
   * Errors are forwarded to the global error handler.
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      // Request body is expected to match LoginSchema
      const input: LoginInput = req.body;

      // Delegate authentication logic to the service layer
      const result = await authService.login(input);

      // Respond with HTTP 200 and authentication payload
      res.json(result);
    } catch (error) {
      // Forward any error to the global error handler
      next(error);
    }
  }
}
