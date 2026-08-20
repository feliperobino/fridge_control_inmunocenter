import env from '../config/env.js';

export function apiKeyMiddleware(req, res, next) {
  const apiKey = req.get('X-API-Key');

  if (!apiKey || apiKey !== env.ingestApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}