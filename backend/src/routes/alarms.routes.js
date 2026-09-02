import { Router } from 'express';
import { listAlarms } from '../controllers/alarms.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(listAlarms));

export default router;