import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { BusinessController } from './business.controller';

const router = Router();
const controller = new BusinessController();

// All routes require authentication
router.use(requireAuth);

router.post('/', (req, res, next) => controller.createOrUpdateBusiness(req, res, next));
router.get('/', (req, res, next) => controller.getBusiness(req, res, next));
router.post('/faqs', (req, res, next) => controller.createFAQ(req, res, next));
router.get('/faqs', (req, res, next) => controller.getFAQs(req, res, next));

export default router;
