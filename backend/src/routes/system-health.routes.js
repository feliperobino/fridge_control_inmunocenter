import { Router } from 'express';
import { getSystemHealth } from '../controllers/system-health.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { roleMiddleware } from '../middlewares/role.middleware.js';

const router = Router();

// Endpoint solo accesible para administradores
router.get('/system-health', authMiddleware, roleMiddleware(['admin']), getSystemHealth);

export default router;