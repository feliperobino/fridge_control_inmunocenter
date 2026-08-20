import { Router } from 'express';
import { ingest } from '../controllers/ingest.controller.js';
import { apiKeyMiddleware } from '../middlewares/api-key.middleware.js';
import { ingestRateLimiter } from '../middlewares/rate-limiters.js';

const router = Router();

router.post('/', ingestRateLimiter, apiKeyMiddleware, ingest);

export default router;