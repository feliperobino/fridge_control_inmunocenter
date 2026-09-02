import { Router } from 'express';
import { login, logout, refresh } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middlewares/rate-limiters.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.post('/login', authRateLimiter, asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));

export default router;
