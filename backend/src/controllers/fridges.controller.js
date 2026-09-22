import prisma from '../config/prisma.js';

function parseClampedInteger(value, fallback, minimum, maximum) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseDateFilter(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function withLatestReading(fridge) {
  const [latestReading] = fridge.readings || [];

  return {
    ...fridge,
    latestReading: latestReading || fridge.latestReading || null,
    readings: undefined,
    __latestReadingRaw: undefined
  };
}

export async function listFridges(req, res) {
  const fridges = await prisma.$queryRaw`
    SELECT
      f.id,
      f.name,
      f.location,
      f."modbusSlaveId" AS "modbusSlaveId",
      f."tempMin" AS "tempMin",
      f."tempMax" AS "tempMax",
      f."humMin" AS "humMin",
      f."humMax" AS "humMax",
      f."createdAt" AS "createdAt",
      f."updatedAt" AS "updatedAt",
      jsonb_build_object(
        'id', lr.id,
        'fridgeId', lr."fridgeId",
        'temperature', lr.temperature,
        'humidity', lr.humidity,
        'recordedAt', lr."recordedAt",
        'receivedAt', lr."receivedAt"
      ) AS "latestReading"
    FROM "Fridge" f
    LEFT JOIN LATERAL (
      SELECT r.id, r."fridgeId", r.temperature, r.humidity, r."recordedAt", r."receivedAt"
      FROM "Reading" r
      WHERE r."fridgeId" = f.id
      ORDER BY r."recordedAt" DESC
      LIMIT 1
    ) lr ON true
    ORDER BY f."createdAt" ASC;
  `;

  return res.json(fridges.map(withLatestReading));
}

export async function getFridge(req, res) {
  const { id } = req.params;

  const [fridge] = await prisma.$queryRaw`
    SELECT
      f.id,
      f.name,
      f.location,
      f."modbusSlaveId" AS "modbusSlaveId",
      f."tempMin" AS "tempMin",
      f."tempMax" AS "tempMax",
      f."humMin" AS "humMin",
      f."humMax" AS "humMax",
      f."createdAt" AS "createdAt",
      f."updatedAt" AS "updatedAt",
      jsonb_build_object(
        'id', lr.id,
        'fridgeId', lr."fridgeId",
        'temperature', lr.temperature,
        'humidity', lr.humidity,
        'recordedAt', lr."recordedAt",
        'receivedAt', lr."receivedAt"
      ) AS "latestReading"
    FROM "Fridge" f
    LEFT JOIN LATERAL (
      SELECT r.id, r."fridgeId", r.temperature, r.humidity, r."recordedAt", r."receivedAt"
      FROM "Reading" r
      WHERE r."fridgeId" = f.id
      ORDER BY r."recordedAt" DESC
      LIMIT 1
    ) lr ON true
    WHERE f.id = ${id};
  `;

  if (!fridge) {
    return res.status(404).json({ error: 'Fridge not found' });
  }

  return res.json(withLatestReading(fridge));
}

export async function listReadings(req, res) {
  const { id } = req.params;
  const MAX_BUCKETS_PER_QUERY = 1440;
  const limit = parseClampedInteger(req.query.limit, MAX_BUCKETS_PER_QUERY, 1, MAX_BUCKETS_PER_QUERY);
  const offset = parseClampedInteger(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const from = parseDateFilter(req.query.from);
  const to = parseDateFilter(req.query.to);

  if (req.query.from && !from || req.query.to && !to) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }

  const fridge = await prisma.fridge.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!fridge) {
    return res.status(404).json({ error: 'Fridge not found' });
  }

  const start = from ?? new Date('1970-01-01T00:00:00.000Z');
  const end = to ?? new Date();
  const [countRows, readings] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "total"
      FROM (
        SELECT DATE_TRUNC('minute', r."recordedAt")
        FROM "Reading" r
        WHERE r."fridgeId" = ${fridge.id}
          AND r."recordedAt" >= ${start}
          AND r."recordedAt" <= ${end}
        GROUP BY DATE_TRUNC('minute', r."recordedAt")
      ) minute_buckets;
    `,
    prisma.$queryRaw`
      SELECT
        MIN(r.id) AS "id",
        r."fridgeId" AS "fridgeId",
        AVG(r.temperature)::float AS "temperature",
        AVG(r.humidity)::float AS "humidity",
        DATE_TRUNC('minute', r."recordedAt") AS "recordedAt",
        MAX(r."receivedAt") AS "receivedAt"
      FROM "Reading" r
      WHERE r."fridgeId" = ${fridge.id}
        AND r."recordedAt" >= ${start}
        AND r."recordedAt" <= ${end}
      GROUP BY r."fridgeId", DATE_TRUNC('minute', r."recordedAt")
      ORDER BY DATE_TRUNC('minute', r."recordedAt") ASC
      OFFSET ${offset}
      LIMIT ${limit};
    `
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return res.json({
    readings,
    pagination: {
      limit,
      offset,
      total
    }
  });
}

export async function getStats(req, res) {
  const { id } = req.params;
  const from = parseDateFilter(req.query.from);
  const to = parseDateFilter(req.query.to);

  if (req.query.from && !from || req.query.to && !to) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }

  const fridge = await prisma.fridge.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!fridge) {
    return res.status(404).json({ error: 'Fridge not found' });
  }

  const stats = from || to
    ? await prisma.$queryRaw`
        SELECT
          MIN("temperature")::float AS "temperature_min",
          MAX("temperature")::float AS "temperature_max",
          AVG("temperature")::float AS "temperature_avg",
          MIN("humidity")::float AS "humidity_min",
          MAX("humidity")::float AS "humidity_max",
          AVG("humidity")::float AS "humidity_avg"
        FROM "Reading"
        WHERE "fridgeId" = ${fridge.id}
          AND "recordedAt" >= ${from ?? new Date('1970-01-01T00:00:00.000Z')}
          AND "recordedAt" <= ${to ?? new Date()}
      `
    : await prisma.$queryRaw`
        SELECT
          MIN("temperature")::float AS "temperature_min",
          MAX("temperature")::float AS "temperature_max",
          AVG("temperature")::float AS "temperature_avg",
          MIN("humidity")::float AS "humidity_min",
          MAX("humidity")::float AS "humidity_max",
          AVG("humidity")::float AS "humidity_avg"
        FROM "Reading"
        WHERE "fridgeId" = ${fridge.id}
      `;

  const row = Array.isArray(stats) ? stats[0] : null;

  return res.json({
    temperature: {
      min: row?.temperature_min ?? null,
      max: row?.temperature_max ?? null,
      avg: row?.temperature_avg ?? null
    },
    humidity: {
      min: row?.humidity_min ?? null,
      max: row?.humidity_max ?? null,
      avg: row?.humidity_avg ?? null
    }
  });
}

export async function getDailyStats(req, res) {
  const { id } = req.params;
  const { date } = req.query; // expected format YYYY-MM-DD

  if (!date) {
    return res.status(400).json({ error: 'Missing date query parameter (YYYY-MM-DD)' });
  }

  const fridge = await prisma.fridge.findUnique({ where: { id }, select: { id: true, tempMin: true, tempMax: true } });
  if (!fridge) {
    return res.status(404).json({ error: 'Fridge not found' });
  }

  const from = new Date(`${date}T00:00:00.000Z`);
  const to = new Date(`${date}T23:59:59.999Z`);
  const morningStart = new Date(`${date}T00:00:00.000Z`);
  const morningEnd = new Date(`${date}T11:59:59.999Z`);
  const afternoonStart = new Date(`${date}T12:00:00.000Z`);
  const afternoonEnd = new Date(`${date}T23:59:59.999Z`);

  const [row] = await prisma.$queryRaw`
    WITH ordered AS (
      SELECT
        r."recordedAt" AS "recordedAt",
        r."temperature" AS "temperature",
        CASE
          WHEN r."temperature" >= ${fridge.tempMin}
            AND r."temperature" <= ${fridge.tempMax}
            THEN EXTRACT(EPOCH FROM (
              COALESCE(LEAD(r."recordedAt") OVER (ORDER BY r."recordedAt"), ${to.toISOString()}::timestamptz) - r."recordedAt"
            )) * 1000
          ELSE 0
        END AS "inRangeMs",
        CASE
          WHEN r."temperature" < ${fridge.tempMin}
            OR r."temperature" > ${fridge.tempMax}
            THEN EXTRACT(EPOCH FROM (
              COALESCE(LEAD(r."recordedAt") OVER (ORDER BY r."recordedAt"), ${to.toISOString()}::timestamptz) - r."recordedAt"
            )) * 1000
          ELSE 0
        END AS "outRangeMs"
      FROM "Reading" r
      WHERE r."fridgeId" = ${fridge.id}
        AND r."recordedAt" >= ${from}
        AND r."recordedAt" <= ${to}
    )
    SELECT
      COALESCE(SUM("inRangeMs"), 0)::int AS "inRangeMs",
      COALESCE(SUM("outRangeMs"), 0)::int AS "outRangeMs",
      COUNT(*)::int AS "readingsCount",
      MIN(CASE WHEN "recordedAt" >= ${morningStart} AND "recordedAt" <= ${morningEnd} THEN "temperature" END) AS "morningMin",
      MAX(CASE WHEN "recordedAt" >= ${morningStart} AND "recordedAt" <= ${morningEnd} THEN "temperature" END) AS "morningMax",
      MIN(CASE WHEN "recordedAt" >= ${afternoonStart} AND "recordedAt" <= ${afternoonEnd} THEN "temperature" END) AS "afternoonMin",
      MAX(CASE WHEN "recordedAt" >= ${afternoonStart} AND "recordedAt" <= ${afternoonEnd} THEN "temperature" END) AS "afternoonMax"
    FROM ordered;
  `;

  const result = row || {
    inRangeMs: 0,
    outRangeMs: 0,
    readingsCount: 0,
    morningMin: null,
    morningMax: null,
    afternoonMin: null,
    afternoonMax: null
  };

  return res.json({
    inRangeMs: Number(result.inRangeMs ?? 0),
    outRangeMs: Number(result.outRangeMs ?? 0),
    morning: {
      min: result.morningMin === null ? null : Number(result.morningMin),
      max: result.morningMax === null ? null : Number(result.morningMax)
    },
    afternoon: {
      min: result.afternoonMin === null ? null : Number(result.afternoonMin),
      max: result.afternoonMax === null ? null : Number(result.afternoonMax)
    },
    readingsCount: Number(result.readingsCount ?? 0)
  });
}

export async function updateFridge(req, res) {
  const { id } = req.params;
  const { name, tempMin, tempMax, humMin, humMax } = req.body || {};
  const data = {};

  if (name !== undefined) {
    if (!name) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    data.name = name;
  }

  const numericFields = [
    ['tempMin', tempMin],
    ['tempMax', tempMax],
    ['humMin', humMin],
    ['humMax', humMax]
  ];

  for (const [field, value] of numericFields) {
    if (value !== undefined) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: `Invalid ${field}` });
      }

      data[field] = parsed;
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  const fridge = await prisma.fridge.update({
    where: { id },
    data
  });

  return res.json(fridge);
}