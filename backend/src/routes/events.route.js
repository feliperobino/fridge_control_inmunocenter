import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { realtimeBus } from '../services/realtime.service.js';

const router = Router();

router.get('/events', (req, res) => {
  // Opcional: Validar JWT enviado en query param
  const token = req.query.token;
  if (token) {
    try {
      jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send('connected', { ok: true });

  const onUpdate = (payload) => send('readings-updated', payload);
  realtimeBus.on('readings-updated', onUpdate);

  // Heartbeat cada 25 segundos
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    realtimeBus.off('readings-updated', onUpdate);
  });
});

export default router;