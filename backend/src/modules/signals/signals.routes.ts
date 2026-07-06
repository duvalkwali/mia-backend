/**
 * Routes configuration for the signals module.
 * Defines API endpoints for signal extraction and retrieval operations.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { SignalsController } from './signals.controller';

const router = Router();
const controller = new SignalsController();

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET / - List all signals for the tenant (frontend signals table)
router.get('/', (req, res, next) => controller.listSignals(req, res, next));

// POST /extract - Extract signals from a message
router.post('/extract', (req, res, next) => controller.extractSignals(req, res, next));

// POST /:signalId/generate-reply - Generate a reply from an existing signal
router.post('/:signalId/generate-reply', (req, res, next) => controller.generateReplyFromSignal(req, res, next));

// GET /contact/:contactId - Get signal history for a contact
router.get('/contact/:contactId', (req, res, next) => controller.getContactSignals(req, res, next));

// GET /contact/:contactId/current - Get current state for a contact
router.get('/contact/:contactId/current', (req, res, next) => controller.getCurrentState(req, res, next));

export default router;
