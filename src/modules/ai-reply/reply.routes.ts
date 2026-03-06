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
 * - GET  /           -> list all replies for the tenant (frontend table)
 * - POST /generate   -> generate a reply for an incoming message
 * - POST /approve    -> approve a generated reply
 * - POST /edit       -> edit an existing generated reply
 * - PATCH /:id/status -> approve or reject via status string (frontend-friendly)
 * - PATCH /:id       -> update reply text (frontend edit dialog)
 * - DELETE /:replyId -> reject/delete a generated reply
 */
router.get('/', (req, res, next) => controller.listReplies(req, res, next));
router.post('/generate', (req, res, next) => controller.generateReply(req, res, next));
router.post('/approve', (req, res, next) => controller.approveReply(req, res, next));
router.post('/edit', (req, res, next) => controller.editReply(req, res, next));
router.patch('/:id/status', (req, res, next) => controller.patchStatus(req, res, next));
router.patch('/:id', (req, res, next) => controller.patchText(req, res, next));
router.delete('/:replyId', (req, res, next) => controller.rejectReply(req, res, next));

// Export the configured router (mounted by the main app)
export default router;
