import cron from 'node-cron';
import prisma from '../config/prisma.js';
import env from '../config/env.js';
import {
  exportReadingsToCsv,
  exportReadingsToPdf,
  exportReadingsToXlsx
} from './export.service.js';
import { sendReportEmail } from './mailer.service.js';

// HARDCODED TIMEZONE FOR CHILE
const CHILE_TIMEZONE = 'America/Santiago';

const scheduledJobs = new Map();

function isEveryMinute(expressionParts) {
  return expressionParts[0] === '*' && expressionParts[1] === '*' && expressionParts.slice(2).every((part) => part === '*');
}

function isEveryHour(expressionParts) {
  return expressionParts[1] === '*' && expressionParts.slice(2).every((part) => part === '*');
}

function isDaily(expressionParts) {
  return expressionParts[2] === '*' && expressionParts[3] === '*' && expressionParts[4] === '*';
}

function getRangeForCronExpression(cronExpression, now = new Date()) {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return getLast24HoursRange(now);
  }

  if (isEveryMinute(parts)) {
    const to = new Date(now);
    const from = new Date(to);
    from.setMinutes(from.getMinutes() - 1);
    return { from, to };
  }

  if (isEveryHour(parts)) {
    const to = new Date(now);
    const from = new Date(to);
    from.setHours(from.getHours() - 1);
    return { from, to };
  }

  if (isDaily(parts)) {
    // Calculado en hora local en lugar de UTC
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const from = new Date(end);
    from.setDate(from.getDate() - 1);
    return { from, to: end };
  }

  return getLast24HoursRange(now);
}

function getLast24HoursRange(now = new Date()) {
  const to = new Date(now);
  const from = new Date(to);
  from.setHours(from.getHours() - 24);
  return { from, to };
}

function getExportFunction(format) {
  if (format === 'XLSX') {
    return exportReadingsToXlsx;
  }

  if (format === 'PDF') {
    return exportReadingsToPdf;
  }

  return exportReadingsToCsv;
}

async function buildAttachment(schedule, from, to) {
  const exportFn = getExportFunction(schedule.format);
  const result = await exportFn('all', from.toISOString(), to.toISOString(), {
    fridgeIds: schedule.fridgeIds
  });

  return {
    filename: result.filename,
    content: result.buffer,
    contentType: result.contentType
  };
}

export async function executeReportSchedule(schedule, now = new Date()) {
  if (!schedule || !schedule.active) {
    return null;
  }

  const { from, to } = getRangeForCronExpression(schedule.cronExpression, now);
  const attachment = await buildAttachment(schedule, from, to);

  await sendReportEmail({
    to: schedule.recipients,
    subject: `Reporte ${schedule.name}`,
    text: `Reporte programado ${schedule.name} (${from.toISOString()} - ${to.toISOString()})`,
    attachments: [attachment]
  });

  return { from, to, attachment };
}

export async function reloadReportSchedules() {
  for (const job of scheduledJobs.values()) {
    job.stop();
  }

  scheduledJobs.clear();

  const schedules = await prisma.reportSchedule.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' }
  });

  for (const schedule of schedules) {
    const job = cron.schedule(
      schedule.cronExpression,
      async () => {
        executeReportSchedule(schedule).catch((error) => {
          // eslint-disable-next-line no-console
          console.error(`Report schedule ${schedule.id} failed`, error);
        });
      },
      { timezone: CHILE_TIMEZONE }
    );

    scheduledJobs.set(schedule.id, job);
  }

  return scheduledJobs.size;
}

export function stopAllReportScheduleJobs() {
  for (const job of scheduledJobs.values()) {
    job.stop();
  }

  scheduledJobs.clear();
}