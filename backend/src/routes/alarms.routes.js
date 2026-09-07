import { Router } from 'express';
import {
	createAlarmRecipient,
	deleteAlarmRecipient,
	listAlarmRecipients,
	listAlarms,
	updateAlarmRecipient
} from '../controllers/alarms.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { roleMiddleware } from '../middlewares/role.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(listAlarms));
router.use('/recipients', roleMiddleware(['ADMIN']));
router.get('/recipients', asyncHandler(listAlarmRecipients));
router.post('/recipients', asyncHandler(createAlarmRecipient));
router.patch('/recipients/:id', asyncHandler(updateAlarmRecipient));
router.delete('/recipients/:id', asyncHandler(deleteAlarmRecipient));

export default router;