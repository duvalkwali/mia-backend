import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { ReplyController } from './reply.controller';

const router = Router();
const controller = new ReplyController();

router.use(requireAuth);

router.post('/generate', (req, res, next) => controller.generateReply(req, res, next));
router.post('/approve', (req, res, next) => controller.approveReply(req, res, next));
router.post('/edit', (req, res, next) => controller.editReply(req, res, next));
router.delete('/:replyId', (req, res, next) => controller.rejectReply(req, res, next));

export default router;
