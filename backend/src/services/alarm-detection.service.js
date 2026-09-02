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
const OUT_OF_RANGE_RATIO_THRESHOLD = 0.9;

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

function getEvaluationWindow(readings, currentReading) {
  const windowStart = toTime(currentReading.recordedAt) - TWENTY_MINUTES_MS;
  return readings.filter((reading) => toTime(reading.recordedAt) >= windowStart);
}

function qualifiesForAlarm(readings, fridge, rule, currentReading) {
  const evaluationWindow = getEvaluationWindow(readings, currentReading);

  if (
    evaluationWindow.length === 0 ||
    toTime(currentReading.recordedAt) - toTime(evaluationWindow[0].recordedAt) < TWENTY_MINUTES_MS
  ) {
    return false;
  }

  const values = evaluationWindow.map((reading) => Number(reading[rule.field]));
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const outsideCount = evaluationWindow.filter((reading) => isOutsideRange(reading, fridge, rule)).length;

  return rule.isOutside(average, fridge) || outsideCount / evaluationWindow.length >= OUT_OF_RANGE_RATIO_THRESHOLD;
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

    if (openAlarms.length > 0 && !currentOutside) {
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

    if (qualifiesForAlarm(orderedReadings, fridge, rule, currentReading)) {
      const evaluationWindow = getEvaluationWindow(orderedReadings, currentReading);
      create.push({
        type: rule.type,
        startedAt: new Date(evaluationWindow[0].recordedAt).toISOString()
      });
    }
  }

  return { create, close };
}

export { ALARM_RULES };