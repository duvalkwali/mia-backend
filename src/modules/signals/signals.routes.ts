import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { SignalsController } from './signals.controller';

const router = Router();
const controller = new SignalsController();

router.use(requireAuth);

router.post('/extract', (req, res, next) => controller.extractSignals(req, res, next));
router.get('/contact/:contactId', (req, res, next) => controller.getContactSignals(req, res, next));
router.get('/contact/:contactId/current', (req, res, next) => controller.getCurrentState(req, res, next));

export default router;
