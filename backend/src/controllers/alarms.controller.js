import prisma from '../config/prisma.js';

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

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

export async function listAlarmRecipients(req, res) {
  const recipients = await prisma.alarmRecipient.findMany({ orderBy: { createdAt: 'asc' } });
  return res.json(recipients);
}

export async function createAlarmRecipient(req, res) {
  const email = normalizeEmail(req.body?.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const recipient = await prisma.alarmRecipient.create({ data: { email } });
  return res.status(201).json(recipient);
}

export async function updateAlarmRecipient(req, res) {
  const data = {};
  if (req.body?.email !== undefined) {
    const email = normalizeEmail(req.body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    data.email = email;
  }
  if (req.body?.active !== undefined) {
    if (typeof req.body.active !== 'boolean') {
      return res.status(400).json({ error: 'Active must be a boolean' });
    }
    data.active = req.body.active;
  }

  const recipient = await prisma.alarmRecipient.update({ where: { id: req.params.id }, data });
  return res.json(recipient);
}

export async function deleteAlarmRecipient(req, res) {
  await prisma.alarmRecipient.delete({ where: { id: req.params.id } });
  return res.status(204).send();
}