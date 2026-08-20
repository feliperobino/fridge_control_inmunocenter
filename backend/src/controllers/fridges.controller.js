import prisma from '../config/prisma.js';

function parseBoundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
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
    latestReading: latestReading || null,
    readings: undefined
  };
}

export async function listFridges(req, res) {
  const fridges = await prisma.fridge.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      readings: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      }
    }
  });

  return res.json(fridges.map(withLatestReading));
}

export async function getFridge(req, res) {
  const { id } = req.params;

  const fridge = await prisma.fridge.findUnique({
    where: { id },
    include: {
      readings: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      }
    }
  });

  if (!fridge) {
    return res.status(404).json({ error: 'Fridge not found' });
  }

  return res.json(withLatestReading(fridge));
}

export async function listReadings(req, res) {
  const { id } = req.params;
  const limit = parseBoundedInteger(req.query.limit, 50, 1, 200, 'limit');
  const offset = parseBoundedInteger(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
  const from = parseDateFilter(req.query.from);
  const to = parseDateFilter(req.query.to);

  if (limit === null || offset === null || req.query.from && !from || req.query.to && !to) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }

  const fridge = await prisma.fridge.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!fridge) {
    return res.status(404).json({ error: 'Fridge not found' });
  }

  const where = {
    fridgeId: fridge.id,
    ...(from || to
      ? {
          recordedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {})
          }
        }
      : {})
  };

  const [total, readings] = await Promise.all([
    prisma.reading.count({ where }),
    prisma.reading.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      skip: offset,
      take: limit
    })
  ]);

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

  const where = {
    fridgeId: fridge.id,
    ...(from || to
      ? {
          recordedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {})
          }
        }
      : {})
  };

  const stats = await prisma.reading.aggregate({
    where,
    _min: {
      temperature: true,
      humidity: true
    },
    _max: {
      temperature: true,
      humidity: true
    },
    _avg: {
      temperature: true,
      humidity: true
    }
  });

  return res.json({
    temperature: {
      min: stats._min.temperature,
      max: stats._max.temperature,
      avg: stats._avg.temperature
    },
    humidity: {
      min: stats._min.humidity,
      max: stats._max.humidity,
      avg: stats._avg.humidity
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

  // parse date boundaries in UTC to avoid timezone surprises
  const from = new Date(`${date}T00:00:00.000Z`);
  const to = new Date(`${date}T23:59:59.999Z`);

  const readings = await prisma.reading.findMany({
    where: {
      fridgeId: fridge.id,
      recordedAt: {
        gte: from,
        lte: to
      }
    },
    orderBy: { recordedAt: 'asc' },
    select: { recordedAt: true, temperature: true }
  });

  // compute time in/out of range
  let inRangeMs = 0;
  let outRangeMs = 0;

  const dayStart = from.getTime();
  const dayEnd = to.getTime();

  if (readings.length > 0) {
    for (let i = 0; i < readings.length; i++) {
      const cur = readings[i];
      const next = readings[i + 1];
      const curTs = new Date(cur.recordedAt).getTime();
      const nextTs = next ? new Date(next.recordedAt).getTime() : dayEnd;
      const duration = Math.max(0, Math.min(nextTs, dayEnd) - Math.max(curTs, dayStart));
      const temp = cur.temperature;
      if (temp >= fridge.tempMin && temp <= fridge.tempMax) {
        inRangeMs += duration;
      } else {
        outRangeMs += duration;
      }
    }
  }

  // morning / afternoon min/max
  const morningStart = new Date(`${date}T00:00:00.000Z`).getTime();
  const morningEnd = new Date(`${date}T11:59:59.999Z`).getTime();
  const afterStart = new Date(`${date}T12:00:00.000Z`).getTime();
  const afterEnd = new Date(`${date}T23:59:59.999Z`).getTime();

  let morningMin = null;
  let morningMax = null;
  let afterMin = null;
  let afterMax = null;

  for (const r of readings) {
    const ts = new Date(r.recordedAt).getTime();
    const t = r.temperature;
    if (ts >= morningStart && ts <= morningEnd) {
      morningMin = morningMin === null ? t : Math.min(morningMin, t);
      morningMax = morningMax === null ? t : Math.max(morningMax, t);
    }

    if (ts >= afterStart && ts <= afterEnd) {
      afterMin = afterMin === null ? t : Math.min(afterMin, t);
      afterMax = afterMax === null ? t : Math.max(afterMax, t);
    }
  }

  return res.json({
    inRangeMs,
    outRangeMs,
    morning: { min: morningMin, max: morningMax },
    afternoon: { min: afterMin, max: afterMax },
    readingsCount: readings.length
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