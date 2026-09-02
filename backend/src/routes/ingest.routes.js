import { Router } from 'express';
import { ingest } from '../controllers/ingest.controller.js';
import { apiKeyMiddleware } from '../middlewares/api-key.middleware.js';
import { ingestRateLimiter } from '../middlewares/rate-limiters.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';

const router = Router();

router.post('/', ingestRateLimiter, apiKeyMiddleware, asyncHandler(ingest));

export default router;