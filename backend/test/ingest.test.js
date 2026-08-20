import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../src/config/prisma.js';
import env from '../src/config/env.js';
import app from '../src/app.js';

const testFridge = {
  name: 'Phase 3 Test Fridge',
  location: 'QA Lab',
  modbusSlaveId: 99,
  tempMin: 2,
  tempMax: 8,
  humMin: 20,
  humMax: 90
};

let fridgeId;

beforeEach(async () => {
  const fridge = await prisma.fridge.upsert({
    where: { modbusSlaveId: testFridge.modbusSlaveId },
    update: {
      name: testFridge.name,
      location: testFridge.location,
      tempMin: testFridge.tempMin,
      tempMax: testFridge.tempMax,
      humMin: testFridge.humMin,
      humMax: testFridge.humMax
    },
    create: testFridge
  });

  fridgeId = fridge.id;

  await Promise.all([
    prisma.reading.deleteMany({ where: { fridgeId } }),
    prisma.alarmEvent.deleteMany({ where: { fridgeId } })
  ]);
});

afterAll(async () => {
  await prisma.reading.deleteMany({ where: { fridgeId } });
  await prisma.alarmEvent.deleteMany({ where: { fridgeId } });
  await prisma.fridge.deleteMany({ where: { modbusSlaveId: testFridge.modbusSlaveId } });
  await prisma.$disconnect();
});

describe('POST /api/ingest', () => {
  it('rejects requests without a valid API key', async () => {
    await request(app)
      .post('/api/ingest')
      .send({
        fridgeId: testFridge.modbusSlaveId,
        temperature: 5.2,
        humidity: 41.8,
        recordedAt: '2026-08-07T12:00:00.000Z'
      })
      .expect(401);
  });

  it('stores a reading when the API key is valid', async () => {
    const response = await request(app)
      .post('/api/ingest')
      .set('X-API-Key', env.ingestApiKey)
      .send({
        fridgeId: testFridge.modbusSlaveId,
        temperature: 5.2,
        humidity: 41.8,
        recordedAt: '2026-08-07T12:00:00.000Z'
      })
      .expect(201);

    expect(response.body.reading).toMatchObject({
      fridgeId,
      temperature: 5.2,
      humidity: 41.8,
      recordedAt: '2026-08-07T12:00:00.000Z'
    });

    const storedReading = await prisma.reading.findFirst({
      where: { fridgeId },
      orderBy: { createdAt: 'desc' }
    });

    expect(storedReading).toMatchObject({
      fridgeId,
      temperature: 5.2,
      humidity: 41.8
    });
  });
});