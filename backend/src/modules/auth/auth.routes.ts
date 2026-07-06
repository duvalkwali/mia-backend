import { Router } from 'express';
import { AuthController } from '@/modules/auth/auth.controller';

/**
 * ============================
 * AUTH ROUTES
 * ============================
 *
 * This file defines all HTTP routes related to authentication.
 *
 * Responsibilities:
 * - Map HTTP endpoints (URLs + methods) to controller methods
 * - Keep routing logic separate from business logic
 *
 * IMPORTANT:
 * - Routes do NOT contain business logic
 * - Routes do NOT handle authentication logic
 * - Routes ONLY connect endpoints to controllers
 */

const router = Router();

/**
 * Create an instance of AuthController
 * This controller will handle incoming auth-related requests
 */
const controller = new AuthController();

/**
 * Register a new user (Sign Up)
 *
 * HTTP Method: POST
 * Endpoint: /auth/register
 *
 * Flow:
 * Client → Route → Controller → Service → Response
 */
router.post(
  '/register',
  (req, res, next) => controller.register(req, res, next)
);

/**
 * Authenticate an existing user (Login)
 *
 * HTTP Method: POST
 * Endpoint: /auth/login
 *
 * Flow:
 * Client → Route → Controller → Service → Response
 */
router.post(
  '/login',
  (req, res, next) => controller.login(req, res, next)
);

/**
 * Export router to be mounted in the main application
 */
export default router;
 
