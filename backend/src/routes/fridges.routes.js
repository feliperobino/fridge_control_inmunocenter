import { Router } from 'express';
import {
  getFridge,
  getStats,
  getDailyStats,
  listFridges,
  listReadings,
  updateFridge
} from '../controllers/fridges.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { roleMiddleware } from '../middlewares/role.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(listFridges));
router.get('/:id/readings', asyncHandler(listReadings));
router.get('/:id/stats', asyncHandler(getStats));
router.get('/:id/daily-stats', asyncHandler(getDailyStats));
router.get('/:id', asyncHandler(getFridge));
router.patch('/:id', roleMiddleware(['ADMIN']), asyncHandler(updateFridge));

export default router;