import { Router } from 'express';
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportSchedules,
  updateReportSchedule
} from '../controllers/report-schedules.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { roleMiddleware } from '../middlewares/role.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.use(authMiddleware, roleMiddleware(['ADMIN']));

router.get('/', asyncHandler(listReportSchedules));
router.post('/', asyncHandler(createReportSchedule));
router.patch('/:id', asyncHandler(updateReportSchedule));
router.delete('/:id', asyncHandler(deleteReportSchedule));

export default router;