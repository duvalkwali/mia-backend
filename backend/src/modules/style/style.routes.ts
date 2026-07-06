import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { StyleController } from './style.controller';

const router = Router();
const controller = new StyleController();

router.use(requireAuth);

router.post('/onboard',       (req, res, next) => controller.createStyleProfile(req, res, next));
router.get('/',               (req, res, next) => controller.getStyleProfile(req, res, next));
router.put('/',               (req, res, next) => controller.updateStyleProfile(req, res, next));
router.post('/learn',         (req, res, next) => controller.recordLearningEvent(req, res, next));
router.get('/learned-rules',  (req, res, next) => controller.getLearnedRules(req, res, next));
router.patch('/learned-rules/:id', (req, res, next) => controller.patchLearnedRule(req, res, next));

export default router;
