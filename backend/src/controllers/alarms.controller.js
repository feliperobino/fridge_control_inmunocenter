import prisma from '../config/prisma.js';

export async function listAlarms(req, res) {
  const { status = 'all', fridgeId } = req.query || {};

  if (!['open', 'resolved', 'all'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const where = {
    ...(fridgeId ? { fridgeId } : {}),
    ...(status === 'open'
      ? { resolvedAt: null }
      : status === 'resolved'
        ? { resolvedAt: { not: null } }
        : {})
  };

  const alarms = await prisma.alarmEvent.findMany({
    where,
    include: {
      fridge: {
        select: {
          id: true,
          name: true,
          location: true,
          tempMin: true,
          tempMax: true,
          humMin: true,
          humMax: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return res.json(alarms);
}