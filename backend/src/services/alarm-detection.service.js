const ALARM_RULES = [
  {
    type: 'TEMP_HIGH',
    field: 'temperature',
    isOutside: (value, fridge) => value > fridge.tempMax
  },
  {
    type: 'TEMP_LOW',
    field: 'temperature',
    isOutside: (value, fridge) => value < fridge.tempMin
  },
  {
    type: 'HUM_HIGH',
    field: 'humidity',
    isOutside: (value, fridge) => value > fridge.humMax
  },
  {
    type: 'HUM_LOW',
    field: 'humidity',
    isOutside: (value, fridge) => value < fridge.humMin
  }
];

const TWENTY_MINUTES_MS = 20 * 60 * 1000;

function toTime(value) {
  return new Date(value).getTime();
}

function isFiniteDate(value) {
  return Number.isFinite(toTime(value));
}

function getLatestReading(readings) {
  if (!readings.length) {
    return null;
  }

  return [...readings].sort((left, right) => toTime(left.recordedAt) - toTime(right.recordedAt)).at(-1);
}

function getOpenAlarmsByType(openAlarmEvents) {
  return openAlarmEvents.reduce((accumulator, alarmEvent) => {
    if (!accumulator[alarmEvent.type]) {
      accumulator[alarmEvent.type] = [];
    }

    accumulator[alarmEvent.type].push(alarmEvent);
    return accumulator;
  }, {});
}

function isOutsideRange(reading, fridge, rule) {
  return rule.isOutside(reading[rule.field], fridge);
}

function findContinuousStreakStart(readings, fridge, rule) {
  let index = readings.length - 1;

  while (index >= 0 && isOutsideRange(readings[index], fridge, rule)) {
    index -= 1;
  }

  const firstOutsideIndex = index + 1;

  if (firstOutsideIndex >= readings.length) {
    return null;
  }

  return readings[firstOutsideIndex];
}

export function evaluateAlarmTransitions({ fridge, readings, openAlarmEvents = [], now = new Date() }) {
  const orderedReadings = [...readings]
    .filter((reading) => isFiniteDate(reading.recordedAt))
    .sort((left, right) => toTime(left.recordedAt) - toTime(right.recordedAt));

  const currentReading = getLatestReading(orderedReadings);

  if (!fridge || !currentReading) {
    return { create: [], close: [] };
  }

  const openAlarmsByType = getOpenAlarmsByType(openAlarmEvents);
  const create = [];
  const close = [];

  for (const rule of ALARM_RULES) {
    const currentOutside = isOutsideRange(currentReading, fridge, rule);
    const openAlarms = openAlarmsByType[rule.type] || [];

    if (!currentOutside) {
      close.push(
        ...openAlarms.map((alarmEvent) => ({
          id: alarmEvent.id,
          type: rule.type,
          resolvedAt: now.toISOString()
        }))
      );
      continue;
    }

    if (openAlarms.length > 0) {
      continue;
    }

    const streakStart = findContinuousStreakStart(orderedReadings, fridge, rule);

    if (!streakStart) {
      continue;
    }

    if (toTime(currentReading.recordedAt) - toTime(streakStart.recordedAt) >= TWENTY_MINUTES_MS) {
      create.push({
        type: rule.type,
        startedAt: new Date(streakStart.recordedAt).toISOString()
      });
    }
  }

  return { create, close };
}

export { ALARM_RULES };