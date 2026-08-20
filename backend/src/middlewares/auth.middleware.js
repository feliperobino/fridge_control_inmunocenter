import { verifyAccessToken } from '../services/auth.service.js';

export function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [, token] = authorization.split(' ');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
