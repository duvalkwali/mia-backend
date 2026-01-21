import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { StyleController } from './style.controller';

const router = Router();
const controller = new StyleController();

router.use(requireAuth);

router.post('/onboard', (req, res, next) => controller.createStyleProfile(req, res, next));
router.get('/', (req, res, next) => controller.getStyleProfile(req, res, next));
router.post('/learn', (req, res, next) => controller.recordLearningEvent(req, res, next));

export default router;
