import { Router } from 'express';
import { downloadMonthlyPdfReport } from '../controllers/reports.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

// Accesible por cualquier usuario autenticado
router.use(authMiddleware);

router.get('/monthly-pdf', asyncHandler(downloadMonthlyPdfReport));

export default router;