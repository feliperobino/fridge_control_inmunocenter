import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(() => ({
      stop: vi.fn()
    }))
  }
}));

vi.mock('../src/services/export.service.js', () => ({
  exportReadingsToCsv: vi.fn(),
  exportReadingsToXlsx: vi.fn(),
  exportReadingsToPdf: vi.fn()
}));

vi.mock('../src/services/mailer.service.js', () => ({
  sendReportEmail: vi.fn()
}));

import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { exportReadingsToCsv } from '../src/services/export.service.js';
import { sendReportEmail } from '../src/services/mailer.service.js';
import { executeReportSchedule } from '../src/services/report-scheduler.service.js';

const adminEmail = 'phase8-admin@example.com';
const testFridge = {
  name: 'Phase 8 Report Fridge',
  location: 'QA Reports',
  modbusSlaveId: 308,
  tempMin: 2,
  tempMax: 8,
  humMin: 20,
  humMax: 90
};

async function loginAdmin() {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: adminEmail, password: 'AdminPassword123!' })
    .expect(200);

  return response.body.accessToken;
}

let fridgeId;

beforeEach(async () => {
  await prisma.reportSchedule.deleteMany({ where: { createdBy: { email: adminEmail } } });
  await prisma.reading.deleteMany({ where: { fridge: { modbusSlaveId: testFridge.modbusSlaveId } } });
  await prisma.alarmEvent.deleteMany({ where: { fridge: { modbusSlaveId: testFridge.modbusSlaveId } } });
  await prisma.fridge.deleteMany({ where: { modbusSlaveId: testFridge.modbusSlaveId } });
  await prisma.user.deleteMany({ where: { email: adminEmail } });

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash('AdminPassword123!', 10),
      role: 'ADMIN'
    }
  });

  const fridge = await prisma.fridge.create({ data: testFridge });
  fridgeId = fridge.id;

  await prisma.reading.createMany({
    data: [
      {
        fridgeId,
        temperature: 4,
        humidity: 35,
        recordedAt: new Date('2026-08-07T11:59:00.000Z')
      },
      {
        fridgeId,
        temperature: 5,
        humidity: 36,
        recordedAt: new Date('2026-08-07T12:00:00.000Z')
      }
    ]
  });
});

afterAll(async () => {
  await prisma.reportSchedule.deleteMany({ where: { createdBy: { email: adminEmail } } });
  await prisma.reading.deleteMany({ where: { fridge: { modbusSlaveId: testFridge.modbusSlaveId } } });
  await prisma.alarmEvent.deleteMany({ where: { fridge: { modbusSlaveId: testFridge.modbusSlaveId } } });
  await prisma.fridge.deleteMany({ where: { modbusSlaveId: testFridge.modbusSlaveId } });
  await prisma.user.deleteMany({ where: { email: adminEmail } });
  await prisma.$disconnect();
});

describe('report schedules', () => {
  it('creates, lists, updates and deletes schedules for ADMIN', async () => {
    const token = await loginAdmin();

    const createResponse = await request(app)
      .post('/api/report-schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Daily report',
        cronExpression: '* * * * *',
        format: 'CSV',
        recipients: ['ops@example.com'],
        fridgeIds: [fridgeId],
        active: true
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      name: 'Daily report',
      cronExpression: '* * * * *',
      format: 'CSV',
      recipients: ['ops@example.com'],
      fridgeIds: [fridgeId],
      active: true
    });

    const listResponse = await request(app)
      .get('/api/report-schedules')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);

    const scheduleId = listResponse.body[0].id;

    const updateResponse = await request(app)
      .patch(`/api/report-schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated report',
        cronExpression: '0 8 * * *',
        format: 'PDF',
        recipients: ['ops@example.com', 'qa@example.com'],
        fridgeIds: [fridgeId],
        active: false
      })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      name: 'Updated report',
      cronExpression: '0 8 * * *',
      format: 'PDF',
      active: false
    });

    await request(app)
      .delete(`/api/report-schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const emptyListResponse = await request(app)
      .get('/api/report-schedules')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(emptyListResponse.body).toHaveLength(0);
  });

  it('executes a schedule and sends an email attachment', async () => {
    exportReadingsToCsv.mockResolvedValue({
      buffer: Buffer.from('csv-data'),
      filename: 'report.csv',
      contentType: 'text/csv; charset=utf-8'
    });
    sendReportEmail.mockResolvedValue({ messageId: 'msg-1' });

    const schedule = {
      id: 'schedule-1',
      name: 'Every minute',
      cronExpression: '* * * * *',
      format: 'CSV',
      recipients: ['ops@example.com'],
      fridgeIds: [fridgeId],
      active: true
    };

    const result = await executeReportSchedule(schedule, new Date('2026-08-07T12:00:00.000Z'));

    expect(exportReadingsToCsv).toHaveBeenCalledWith(
      'all',
      '2026-08-07T11:59:00.000Z',
      '2026-08-07T12:00:00.000Z',
      {
        fridgeIds: [fridgeId]
      }
    );
    expect(sendReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['ops@example.com'],
        attachments: [
          expect.objectContaining({
            filename: 'report.csv',
            contentType: 'text/csv; charset=utf-8'
          })
        ]
      })
    );
    expect(result).toMatchObject({
      attachment: {
        filename: 'report.csv'
      }
    });
  });
});