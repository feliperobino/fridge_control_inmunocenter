import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../src/config/prisma.js';
import app from '../src/app.js';

const testEmails = ['phase4-user@example.com', 'phase4-admin@example.com'];
const testFridge = {
  name: 'Phase 4 Test Fridge',
  location: 'QA Floor',
  modbusSlaveId: 97,
  tempMin: 2,
  tempMax: 8,
  humMin: 20,
  humMax: 90
};

async function createUser(email, password, role) {
  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await bcrypt.hash(password, 10),
      role
    },
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role
    }
  });
}

async function login(email, password) {
  const response = await request(app).post('/api/auth/login').send({ email, password }).expect(200);

  return response.body.accessToken;
}

beforeEach(async () => {
  await prisma.reading.deleteMany({ where: { fridge: { modbusSlaveId: testFridge.modbusSlaveId } } });
  await prisma.alarmEvent.deleteMany({ where: { fridge: { modbusSlaveId: testFridge.modbusSlaveId } } });
  await prisma.fridge.deleteMany({ where: { modbusSlaveId: testFridge.modbusSlaveId } });
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });

  await createUser('phase4-user@example.com', 'UserPassword123!', 'USER');
  await createUser('phase4-admin@example.com', 'AdminPassword123!', 'ADMIN');

  const fridge = await prisma.fridge.create({ data: testFridge });

  await prisma.reading.createMany({
    data: [
      {
        fridgeId: fridge.id,
        temperature: 4,
        humidity: 35,
        recordedAt: new Date('2026-08-07T12:00:00.000Z')
      },
      {
        fridgeId: fridge.id,
        temperature: 5,
        humidity: 36,
        recordedAt: new Date('2026-08-07T13:00:00.000Z')
      },
      {
        fridgeId: fridge.id,
        temperature: 6,
        humidity: 37,
        recordedAt: new Date('2026-08-07T14:00:00.000Z')
      }
    ]
  });

  await prisma.alarmEvent.createMany({
    data: [
      {
        fridgeId: fridge.id,
        type: 'TEMP_HIGH',
        startedAt: new Date('2026-08-07T15:00:00.000Z')
      },
      {
        fridgeId: fridge.id,
        type: 'HUM_LOW',
        startedAt: new Date('2026-08-07T10:00:00.000Z'),
        resolvedAt: new Date('2026-08-07T11:00:00.000Z')
      }
    ]
  });
});

afterAll(async () => {
  await prisma.reading.deleteMany({ where: { fridge: { modbusSlaveId: testFridge.modbusSlaveId } } });
  await prisma.alarmEvent.deleteMany({ where: { fridge: { modbusSlaveId: testFridge.modbusSlaveId } } });
  await prisma.fridge.deleteMany({ where: { modbusSlaveId: testFridge.modbusSlaveId } });
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
  await prisma.$disconnect();
});

describe('dashboard APIs', () => {
  it('lists fridges with latest readings and requires auth', async () => {
    await request(app).get('/api/fridges').expect(401);

    const token = await login('phase4-user@example.com', 'UserPassword123!');
    const response = await request(app)
      .get('/api/fridges')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const fridge = response.body.find((item) => item.modbusSlaveId === testFridge.modbusSlaveId);

    expect(Array.isArray(response.body)).toBe(true);
    expect(fridge).toMatchObject({
      name: testFridge.name,
      latestReading: {
        temperature: 6,
        humidity: 37
      }
    });
  });

  it('returns fridge details with configured ranges', async () => {
    const token = await login('phase4-user@example.com', 'UserPassword123!');
    const fridge = await prisma.fridge.findUnique({ where: { modbusSlaveId: testFridge.modbusSlaveId } });

    const response = await request(app)
      .get(`/api/fridges/${fridge.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: fridge.id,
      name: testFridge.name,
      tempMin: 2,
      tempMax: 8,
      humMin: 20,
      humMax: 90,
      latestReading: {
        temperature: 6,
        humidity: 37
      }
    });
  });

  it('paginates readings in recordedAt order', async () => {
    const token = await login('phase4-user@example.com', 'UserPassword123!');
    const fridge = await prisma.fridge.findUnique({ where: { modbusSlaveId: testFridge.modbusSlaveId } });

    const response = await request(app)
      .get(`/api/fridges/${fridge.id}/readings?limit=2&offset=1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.pagination).toMatchObject({
      limit: 2,
      offset: 1,
      total: 3
    });
    expect(response.body.readings).toHaveLength(2);
    expect(response.body.readings[0]).toMatchObject({
      temperature: 5,
      humidity: 36
    });
  });

  it('returns min max avg stats for a date range', async () => {
    const token = await login('phase4-user@example.com', 'UserPassword123!');
    const fridge = await prisma.fridge.findUnique({ where: { modbusSlaveId: testFridge.modbusSlaveId } });

    const response = await request(app)
      .get(
        `/api/fridges/${fridge.id}/stats?from=2026-08-07T00:00:00.000Z&to=2026-08-08T00:00:00.000Z`
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      temperature: {
        min: 4,
        max: 6,
        avg: 5
      },
      humidity: {
        min: 35,
        max: 37,
        avg: 36
      }
    });
  });

  it('filters alarms by status and fridge', async () => {
    const token = await login('phase4-user@example.com', 'UserPassword123!');
    const fridge = await prisma.fridge.findUnique({ where: { modbusSlaveId: testFridge.modbusSlaveId } });

    const response = await request(app)
      .get(`/api/alarms?status=open&fridgeId=${fridge.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      fridgeId: fridge.id,
      type: 'TEMP_HIGH',
      resolvedAt: null
    });
  });

  it('allows ADMIN to patch a fridge and rejects USER role', async () => {
    const userToken = await login('phase4-user@example.com', 'UserPassword123!');
    const adminToken = await login('phase4-admin@example.com', 'AdminPassword123!');
    const fridge = await prisma.fridge.findUnique({ where: { modbusSlaveId: testFridge.modbusSlaveId } });

    await request(app)
      .patch(`/api/fridges/${fridge.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Forbidden Update' })
      .expect(403);

    const response = await request(app)
      .patch(`/api/fridges/${fridge.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Phase 4 Fridge',
        tempMin: 1.5,
        tempMax: 7.5,
        humMin: 18,
        humMax: 88
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: fridge.id,
      name: 'Updated Phase 4 Fridge',
      tempMin: 1.5,
      tempMax: 7.5,
      humMin: 18,
      humMax: 88
    });
  });
});