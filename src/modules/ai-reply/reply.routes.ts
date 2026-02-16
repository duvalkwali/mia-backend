/**
 * Routes for AI reply operations (protected by authentication middleware)
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { ReplyController } from './reply.controller';

const router = Router();
const controller = new ReplyController();

router.use(requireAuth);

/**
 * Route bindings for AI reply operations:
 * - POST /generate  -> generate a reply for an incoming message
 * - POST /approve   -> approve a generated reply
 * - POST /edit      -> edit an existing generated reply
 * - DELETE /:replyId -> reject/delete a generated reply
 */
router.post('/generate', (req, res, next) => controller.generateReply(req, res, next));
router.post('/approve', (req, res, next) => controller.approveReply(req, res, next));
router.post('/edit', (req, res, next) => controller.editReply(req, res, next));
router.delete('/:replyId', (req, res, next) => controller.rejectReply(req, res, next));

// Export the configured router (mounted by the main app)
export default router;
