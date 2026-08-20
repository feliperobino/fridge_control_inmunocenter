import { describe, expect, it } from 'vitest';
import { evaluateAlarmTransitions } from '../src/services/alarm-detection.service.js';

const fridge = {
  tempMin: 2,
  tempMax: 8,
  humMin: 20,
  humMax: 90
};

function makeReading(minutesFromStart, values) {
  return {
    temperature: values.temperature,
    humidity: values.humidity,
    recordedAt: new Date(Date.UTC(2026, 7, 7, 12, minutesFromStart, 0))
  };
}

describe('evaluateAlarmTransitions', () => {
  it('creates a temperature alarm when the streak lasts 20 minutes or more', () => {
    const readings = [
      makeReading(0, { temperature: 9, humidity: 50 }),
      makeReading(10, { temperature: 9, humidity: 50 }),
      makeReading(20, { temperature: 9, humidity: 50 })
    ];

    const result = evaluateAlarmTransitions({ fridge, readings, openAlarmEvents: [] });

    expect(result.create).toEqual([
      {
        type: 'TEMP_HIGH',
        startedAt: readings[0].recordedAt.toISOString()
      }
    ]);
    expect(result.close).toEqual([]);
  });

  it('does not create an alarm when the streak is shorter than 20 minutes', () => {
    const readings = [
      makeReading(0, { temperature: 9, humidity: 50 }),
      makeReading(9, { temperature: 9, humidity: 50 }),
      makeReading(19, { temperature: 9, humidity: 50 })
    ];

    const result = evaluateAlarmTransitions({ fridge, readings, openAlarmEvents: [] });

    expect(result.create).toEqual([]);
    expect(result.close).toEqual([]);
  });

  it('resets the streak when an in-range reading appears in the middle', () => {
    const readings = [
      makeReading(0, { temperature: 9, humidity: 50 }),
      makeReading(10, { temperature: 9, humidity: 50 }),
      makeReading(15, { temperature: 6, humidity: 50 }),
      makeReading(25, { temperature: 9, humidity: 50 })
    ];

    const result = evaluateAlarmTransitions({ fridge, readings, openAlarmEvents: [] });

    expect(result.create).toEqual([]);
    expect(result.close).toEqual([]);
  });

  it('closes an open alarm when the current reading returns to range', () => {
    const readings = [
      makeReading(0, { temperature: 9, humidity: 50 }),
      makeReading(10, { temperature: 9, humidity: 50 }),
      makeReading(20, { temperature: 6, humidity: 50 })
    ];

    const result = evaluateAlarmTransitions({
      fridge,
      readings,
      openAlarmEvents: [
        {
          id: 'alarm-1',
          type: 'TEMP_HIGH'
        }
      ],
      now: new Date(Date.UTC(2026, 7, 7, 12, 20, 0))
    });

    expect(result.create).toEqual([]);
    expect(result.close).toEqual([
      {
        id: 'alarm-1',
        type: 'TEMP_HIGH',
        resolvedAt: '2026-08-07T12:20:00.000Z'
      }
    ]);
  });
});