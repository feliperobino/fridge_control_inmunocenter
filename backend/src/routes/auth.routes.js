import { Router } from 'express';
import { login, logout, refresh } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middlewares/rate-limiters.js';

const router = Router();

router.post('/login', authRateLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
