import { z } from 'zod';
import prisma from '../config/prisma.js';
import { evaluateAlarmTransitions } from '../services/alarm-detection.service.js';

import { pushSample } from '../services/reading_buffer.service.js';
import env from '../config/env.js';
import { parseLoggerLocalDate } from '../utils/ingest-date.js';
import { updateReadingDailySummary } from '../services/reading-daily-summary.service.js';
import {
  emitAlarmsResolved,
  emitAlarmsTriggered,
  emitReadingsUpdated
} from '../services/realtime.service.js';

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

export function resolveRecordedAt(item) {
  if (item.D) {
    const parsedLocalDate = parseLoggerLocalDate(item.D, env.ingestTimezone);
    if (parsedLocalDate) return parsedLocalDate;

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

  await updateReadingDailySummary({ fridge, temperature, humidity, recordedAt });

  // REFACTOR NO QUERY HISTÓRICO - QUERY SOLO LOS ÚLTIMOS 2 HORAS PARA EVALUAR ALARMAS
  const LOOKBACK_HOURS = 2;
  const windowStart = new Date(recordedAt.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const [readings, openAlarmEvents] = await Promise.all([
    prisma.reading.findMany({
      where: { 
        fridgeId: fridge.id, 
        recordedAt: { 
          gte: windowStart, // SOLUCIÓN: Acota el inicio de la búsqueda
          lte: recordedAt 
        } 
      },
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

  const [createdAlarms, resolvedAlarms] = await Promise.all([
    Promise.all(
      alarmTransitions.create.map((alarmEvent) =>
        prisma.alarmEvent.create({
          data: {
            fridgeId: fridge.id,
            type: alarmEvent.type,
            startedAt: new Date(alarmEvent.startedAt)
          }
        })
      )
    ),
    Promise.all(
      alarmTransitions.close.map((alarmEvent) =>
        prisma.alarmEvent.update({
          where: { id: alarmEvent.id },
          data: { resolvedAt: new Date(alarmEvent.resolvedAt) }
        })
      )
    )
  ]);

  const alarmContext = {
    fridgeId: fridge.id,
    fridgeName: fridge.name,
    location: fridge.location,
    temperature: reading.temperature,
    humidity: reading.humidity,
    tempMin: fridge.tempMin,
    tempMax: fridge.tempMax,
    humMin: fridge.humMin,
    humMax: fridge.humMax
  };

  return {
    fridgeId: fridge.id,
    readingId: reading.id,
    createdAlarms: createdAlarms.map((alarm) => ({ ...alarm, ...alarmContext })),
    resolvedAlarms: resolvedAlarms.map((alarm) => ({ ...alarm, ...alarmContext }))
  };
}

export async function ingest(req, res) {
  console.log("================ INGEST PAYLOAD RECIBIDO ================");
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("========================================================");

  const rawItems = Array.isArray(req.body) ? req.body : req.body?.[DATA_KEY];

  const parsedBatch = batchSchema.safeParse(rawItems);
  if (!parsedBatch.success) {
    console.error("Error en formato de payload recibidito:", parsedBatch.error.flatten());
    return res.status(400).json({ error: 'Invalid payload', details: parsedBatch.error.flatten() });
  }

  const results = [];
  for (const item of parsedBatch.data) {
    try {
      const modbusSlaveId = extractSlaveId(item.ID);
      if (modbusSlaveId === null) {
        throw new Error(`No pude resolver slaveId desde ID="${item.ID}"`);
      }

      const averaged = pushSample(modbusSlaveId, {
        temperature: item.data[0] / SCALE,
        humidity: item.data[1] / SCALE,
        recordedAt: resolveRecordedAt(item)
      });

      results.push({ status: 'fulfilled', value: await processSingleReading({ modbusSlaveId, ...averaged }) });
    } catch (error) {
      results.push({ status: 'rejected', reason: error });
    }
  }

  const processed = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results
    .filter((r) => r.status === 'rejected')
    .map((r) => ({ error: r.reason?.message ?? 'Unknown error' }));

  if (failed.length > 0) {
    console.warn('Ingest: algunos items fallaron', failed);
  }

  // Un solo emit por request procesado (una ráfaga), no uno por item del batch.
  if (processed.length > 0) {
    emitReadingsUpdated(processed.map((p) => p.fridgeId));

    const createdAlarms = processed.flatMap((result) => result.createdAlarms || []);
    const resolvedAlarms = processed.flatMap((result) => result.resolvedAlarms || []);

    if (createdAlarms.length > 0) {
      emitAlarmsTriggered(createdAlarms);
    }

    if (resolvedAlarms.length > 0) {
      emitAlarmsResolved(resolvedAlarms);
    }
  }

  return res.status(201).json({ processed, failed });
}