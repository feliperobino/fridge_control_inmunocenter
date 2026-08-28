import { Router } from 'express';
import { downloadMonthlyPdfReport } from '../controllers/reports.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Accesible por cualquier usuario autenticado
router.use(authMiddleware);

router.get('/monthly-pdf', downloadMonthlyPdfReport);

export default router;