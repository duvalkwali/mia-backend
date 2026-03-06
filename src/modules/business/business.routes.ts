import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { BusinessController } from './business.controller';

/**
 * ============================
 * BUSINESS ROUTES
 * ============================
 *
 * This file defines all HTTP endpoints related to:
 * - Business configuration
 * - FAQ management
 *
 * Responsibilities:
 * - Define URL paths and HTTP methods
 * - Apply authentication middleware
 * - Forward requests to the controller
 *
 * IMPORTANT:
 * - Routes contain NO business logic
 * - Routes contain NO validation logic
 */

const router = Router();

/**
 * Create a single instance of BusinessController
 * The controller handles request orchestration
 */
const controller = new BusinessController();

/**
 * Apply authentication middleware to ALL routes below
 *
 * This ensures:
 * - Only authenticated users can access business data
 * - tenantContext is injected into the request
 */
router.use(requireAuth);

/**
 * Create or update the business profile for the tenant
 *
 * POST /business
 */
router.post(
  '/',
  (req, res, next) => controller.createOrUpdateBusiness(req, res, next)
);

/**
 * Get the business profile for the tenant
 *
 * GET /business
 */
router.get(
  '/',
  (req, res, next) => controller.getBusiness(req, res, next)
);

/**
 * Create a new FAQ entry
 *
 * POST /business/faqs
 */
router.post(
  '/faqs',
  (req, res, next) => controller.createFAQ(req, res, next)
);

/**
 * Retrieve all FAQs for the tenant
 *
 * GET /business/faqs
 */
router.get(
  '/faqs',
  (req, res, next) => controller.getFAQs(req, res, next)
);

/**
 * Delete a FAQ by ID
 * DELETE /business/faqs/:id
 */
router.delete(
  '/faqs/:id',
  (req, res, next) => controller.deleteFAQ(req, res, next)
);

/**
 * GET /business/profile → alias for GET /business (frontend-friendly)
 */
router.get(
  '/profile',
  (req, res, next) => controller.getBusiness(req, res, next)
);

/**
 * PUT /business/profile → simple upsert for frontend (accepts flat fields)
 */
router.put(
  '/profile',
  (req, res, next) => controller.updateProfile(req, res, next)
);

/**
 * Export router to be mounted in the main app
 */
export default router;

