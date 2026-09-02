import { Router } from 'express';
import { exportReadings } from '../controllers/exports.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/readings', asyncHandler(exportReadings));

export default router;