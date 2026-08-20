import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

const testEmail = 'phase7-export@example.com';
const testFridge = {
  name: 'Phase 7 Export Fridge',
  location: 'QA Export',
  modbusSlaveId: 107,
  tempMin: 2,
  tempMax: 8,
  humMin: 20,
  humMax: 90
};

async function login() {
  const user = await prisma.user.upsert({
    where: { email: testEmail },
    update: {
      passwordHash: await bcrypt.hash('Password123!', 10),
      role: 'USER'
    },
    create: {
      email: testEmail,
      passwordHash: await bcrypt.hash('Password123!', 10),
      role: 'USER'
    }
  });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: 'Password123!' })
    .expect(200);

  return response.body.accessToken;
}

let fridgeId;

function binaryParser(response, callback) {
  const chunks = [];

  response.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  response.on('end', () => {
    callback(null, Buffer.concat(chunks));
  });
}

beforeEach(async () => {
  const fridge = await prisma.fridge.upsert({
    where: { modbusSlaveId: testFridge.modbusSlaveId },
    update: testFridge,
    create: testFridge
  });

  fridgeId = fridge.id;

  await prisma.reading.deleteMany({ where: { fridgeId } });

  await prisma.reading.createMany({
    data: [
      {
        fridgeId,
        temperature: 4,
        humidity: 35,
        recordedAt: new Date('2026-08-01T12:00:00.000Z')
      },
      {
        fridgeId,
        temperature: 5,
        humidity: 36,
        recordedAt: new Date('2026-08-02T12:00:00.000Z')
      }
    ]
  });
});

afterAll(async () => {
  await prisma.reading.deleteMany({ where: { fridgeId } });
  await prisma.fridge.deleteMany({ where: { modbusSlaveId: testFridge.modbusSlaveId } });
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe('export endpoint', () => {
  it('downloads CSV, XLSX and PDF exports', async () => {
    const token = await login();
    const from = '2026-08-01T00:00:00.000Z';
    const to = '2026-08-03T00:00:00.000Z';

    const csvResponse = await request(app)
      .get(`/api/exports/readings?format=csv&fridgeId=${fridgeId}&from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(csvResponse.headers['content-type']).toContain('text/csv');
    expect(csvResponse.text).toContain('fridgeName,fridgeId,temperature,humidity');

    const xlsxResponse = await request(app)
      .get(`/api/exports/readings?format=xlsx&fridgeId=${fridgeId}&from=${from}&to=${to}`)
      .buffer(true)
      .parse(binaryParser)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(xlsxResponse.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxResponse.body);
    expect(workbook.worksheets[0].rowCount).toBeGreaterThan(1);

    const pdfResponse = await request(app)
      .get(`/api/exports/readings?format=pdf&fridgeId=${fridgeId}&from=${from}&to=${to}`)
      .buffer(true)
      .parse(binaryParser)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
    expect(pdfResponse.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});