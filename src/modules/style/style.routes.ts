import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { StyleController } from './style.controller';

// Create a new Express router instance
const router = Router();

// Create one controller instance
const controller = new StyleController();

/**
 * Apply authentication middleware to ALL routes below.
 * If the user is not authenticated, none of these routes can be accessed.
 */
router.use(requireAuth);

/**
 * POST /style/onboard
 * Used when a business completes the onboarding quiz
 * and defines how the AI should sound.
 */
router.post(
  '/onboard',
  (req, res, next) => controller.createStyleProfile(req, res, next)
);

/**
 * GET /style
 * Fetch the current style profile for the logged-in tenant.
 */
router.get(
  '/',
  (req, res, next) => controller.getStyleProfile(req, res, next)
);

/**
 * POST /style/learn
 * Records feedback on AI replies (approval, edit, rejection).
 * This is how the AI "learns" the user's preferences.
 */
router.post(
  '/learn',
  (req, res, next) => controller.recordLearningEvent(req, res, next)
);

export default router;

