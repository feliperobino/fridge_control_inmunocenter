import { Router } from 'express';
import { listAlarms } from '../controllers/alarms.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listAlarms);

export default router;