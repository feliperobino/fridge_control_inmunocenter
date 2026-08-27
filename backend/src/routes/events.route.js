import { Router } from 'express';
import { realtimeBus } from '../services/realtime.service.js';

const router = Router();

router.get('/events', (req, res) => {
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

  // heartbeat para que proxies/load balancers no corten la conexión por idle
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    realtimeBus.off('readings-updated', onUpdate);
  });
});

export default router;