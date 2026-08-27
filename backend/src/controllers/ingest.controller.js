import { z } from 'zod';
import prisma from '../config/prisma.js';
import { evaluateAlarmTransitions } from '../services/alarm-detection.service.js';

const DATA_KEY = 'modbus_temp_RH';
const SCALE = 10; // XY-MD02 manda valores x10 (211 = 21.1)

const batchItemSchema = z.object({
  TS: z.union([z.string(), z.number()]).optional(),
  ID: z.string(), // "read_sens_1".."read_sens_4"
  D: z.string().optional(), // ISO8601
  data: z.array(z.number()).length(2) // [rawTemp, rawHum]
});

const batchSchema = z.array(batchItemSchema).min(1);

function extractSlaveId(requestName) {
  const match = requestName.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

function resolveRecordedAt(item) {
  if (item.D) {
    const d = new Date(item.D);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (item.TS !== undefined) {
    const t = Number(item.TS);
    if (Number.isFinite(t)) {
      // Si el timestamp viene en segundos (ej. 1724731200), multiplicar por 1000
      return new Date(t < 10000000000 ? t * 1000 : t);
    }
  }
  return new Date(); // último fallback: hora de recepción
}

async function processSingleReading({ modbusSlaveId, temperature, humidity, recordedAt }) {
  const fridge = await prisma.fridge.findUnique({ where: { modbusSlaveId } });
  if (!fridge) {
    throw new Error(`Fridge no encontrado para modbusSlaveId=${modbusSlaveId}`);
  }

  const receivedAt = new Date();

  const reading = await prisma.reading.create({
    data: { fridgeId: fridge.id, temperature, humidity, recordedAt, receivedAt }
  });

  const [readings, openAlarmEvents] = await Promise.all([
    prisma.reading.findMany({
      where: { fridgeId: fridge.id, recordedAt: { lte: recordedAt } },
      orderBy: { recordedAt: 'asc' }
    }),
    prisma.alarmEvent.findMany({
      where: { fridgeId: fridge.id, resolvedAt: null }
    })
  ]);

  const alarmTransitions = evaluateAlarmTransitions({
    fridge,
    readings,
    openAlarmEvents,
    now: receivedAt
  });

  await Promise.all([
    ...alarmTransitions.create.map((alarmEvent) =>
      prisma.alarmEvent.create({
        data: {
          fridgeId: fridge.id,
          type: alarmEvent.type,
          startedAt: new Date(alarmEvent.startedAt)
        }
      })
    ),
    ...alarmTransitions.close.map((alarmEvent) =>
      prisma.alarmEvent.update({
        where: { id: alarmEvent.id },
        data: { resolvedAt: new Date(alarmEvent.resolvedAt) }
      })
    )
  ]);

  return { fridgeId: fridge.id, readingId: reading.id };
}

export async function ingest(req, res) {
  // -------------------------------------------------------------
  // PASO 1.1: LOG DE INSPECCIÓN (Imprime headers y body recibidos)
  // -------------------------------------------------------------
  console.log("================ INGEST PAYLOAD RECIBIDO ================");
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("========================================================");

  // Soporta el batch real del router ({ modbus_temp_RH: [...] }) y un array top-level.
  const rawItems = Array.isArray(req.body) ? req.body : req.body?.[DATA_KEY];

  const parsedBatch = batchSchema.safeParse(rawItems);
  if (!parsedBatch.success) {
    console.error("Error en formato de payload recibidito:", parsedBatch.error.flatten());
    return res.status(400).json({ error: 'Invalid payload', details: parsedBatch.error.flatten() });
  }

  const results = await Promise.allSettled(
    parsedBatch.data.map((item) => {
      const modbusSlaveId = extractSlaveId(item.ID);
      if (modbusSlaveId === null) {
        return Promise.reject(new Error(`No pude resolver slaveId desde ID="${item.ID}"`));
      }
      return processSingleReading({
        modbusSlaveId,
        temperature: item.data[0] / SCALE,
        humidity: item.data[1] / SCALE,
        recordedAt: resolveRecordedAt(item)
      });
    })
  );

  const processed = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results
    .filter((r) => r.status === 'rejected')
    .map((r) => ({ error: r.reason?.message ?? 'Unknown error' }));

  if (failed.length > 0) {
    console.warn('Ingest: algunos items fallaron', failed);
  }

  return res.status(201).json({ processed, failed });
}