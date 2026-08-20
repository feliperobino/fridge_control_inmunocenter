import { Router } from 'express';
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportSchedules,
  updateReportSchedule
} from '../controllers/report-schedules.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { roleMiddleware } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authMiddleware, roleMiddleware(['ADMIN']));

router.get('/', listReportSchedules);
router.post('/', createReportSchedule);
router.patch('/:id', updateReportSchedule);
router.delete('/:id', deleteReportSchedule);

export default router;