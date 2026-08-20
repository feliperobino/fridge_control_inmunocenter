import cronValidate from 'cron-validate';
import prisma from '../config/prisma.js';
import { reloadReportSchedules } from '../services/report-scheduler.service.js';

const allowedFormats = ['CSV', 'XLSX', 'PDF'];

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());
}

function validateCronExpression(expression) {
  const validator = cronValidate?.default?.default || cronValidate?.default || cronValidate;
  return validator(expression).isValid();
}

function normalizeSchedule(schedule) {
  return {
    ...schedule,
    createdBy: schedule.createdBy
      ? {
          id: schedule.createdBy.id,
          email: schedule.createdBy.email,
          role: schedule.createdBy.role
        }
      : null
  };
}

export async function listReportSchedules(req, res) {
  const schedules = await prisma.reportSchedule.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: { id: true, email: true, role: true }
      }
    }
  });

  return res.json(schedules.map(normalizeSchedule));
}

export async function createReportSchedule(req, res) {
  const { name, cronExpression, format, recipients, fridgeIds, active = true } = req.body || {};

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Valid name is required' });
  }

  if (!validateCronExpression(cronExpression || '')) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }

  if (!allowedFormats.includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  if (!isStringArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Valid recipients are required' });
  }

  if (!isStringArray(fridgeIds)) {
    return res.status(400).json({ error: 'Valid fridgeIds are required' });
  }

  const schedule = await prisma.reportSchedule.create({
    data: {
      name,
      cronExpression,
      format,
      recipients,
      fridgeIds,
      active: Boolean(active),
      createdById: req.user.id
    },
    include: {
      createdBy: {
        select: { id: true, email: true, role: true }
      }
    }
  });

  await reloadReportSchedules();

  return res.status(201).json(normalizeSchedule(schedule));
}

export async function updateReportSchedule(req, res) {
  const { id } = req.params;
  const { name, cronExpression, format, recipients, fridgeIds, active } = req.body || {};
  const data = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    data.name = name;
  }

  if (cronExpression !== undefined) {
    if (!validateCronExpression(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    data.cronExpression = cronExpression;
  }

  if (format !== undefined) {
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ error: 'Invalid format' });
    }

    data.format = format;
  }

  if (recipients !== undefined) {
    if (!isStringArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Invalid recipients' });
    }

    data.recipients = recipients;
  }

  if (fridgeIds !== undefined) {
    if (!isStringArray(fridgeIds)) {
      return res.status(400).json({ error: 'Invalid fridgeIds' });
    }

    data.fridgeIds = fridgeIds;
  }

  if (active !== undefined) {
    data.active = Boolean(active);
  }

  const schedule = await prisma.reportSchedule.update({
    where: { id },
    data,
    include: {
      createdBy: {
        select: { id: true, email: true, role: true }
      }
    }
  });

  await reloadReportSchedules();

  return res.json(normalizeSchedule(schedule));
}

export async function deleteReportSchedule(req, res) {
  const { id } = req.params;

  await prisma.reportSchedule.delete({ where: { id } });
  await reloadReportSchedules();

  return res.status(204).send();
}