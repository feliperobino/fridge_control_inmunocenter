import { Router } from 'express';
import { exportReadings } from '../controllers/exports.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/readings', exportReadings);

export default router;