import env from '../config/env.js';

export function apiKeyMiddleware(req, res, next) {
  // Extrae la API Key buscando en req.headers tanto en mayúsculas como en minúsculas
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'] || req.get('X-API-Key');

  if (!apiKey || apiKey !== env.ingestApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}