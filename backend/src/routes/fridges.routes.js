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

const router = Router();

router.use(authMiddleware);

router.get('/', listFridges);
router.get('/:id/readings', listReadings);
router.get('/:id/stats', getStats);
router.get('/:id/daily-stats', getDailyStats);
router.get('/:id', getFridge);
router.patch('/:id', roleMiddleware(['ADMIN']), updateFridge);

export default router;