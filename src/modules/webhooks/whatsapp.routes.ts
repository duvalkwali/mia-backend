/**
 * Routes for WhatsApp webhook endpoint
 * - GET  /webhook  -> verification challenge from Meta
 * - POST /webhook  -> incoming webhook events
 *
 * These routes are intentionally minimal; authentication/tenant
 * routing happens in the controller/service layers.
 */
import { Router } from 'express';
import { WhatsAppController } from './whatsapp.controller';

const router = Router();
const controller = new WhatsAppController();

router.get('/', (req, res) => controller.verifyWebhook(req, res));
router.post('/', (req, res, next) => controller.handleWebhook(req, res, next));

export default router;
