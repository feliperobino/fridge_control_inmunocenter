const WINDOW_MS = 40_000; // ventana de suavizado (~4 muestras a intervalos de 10s + margen)
const MAX_SAMPLES = 4;    // tope de muestras por promedio, aunque lleguen más rápido

// Estado en memoria: modbusSlaveId -> array de muestras crudas ordenadas por recordedAt
const buffers = new Map();

/**
 * Agrega una muestra al buffer de un sensor y devuelve el promedio
 * de la ventana vigente (autolimpiada por tiempo).
 * Siempre devuelve un resultado: nunca queda "esperando" una muestra que no llega.
 */
export function pushSample(modbusSlaveId, { temperature, humidity, recordedAt }) {
  const buf = buffers.get(modbusSlaveId) ?? [];
  buf.push({ temperature, humidity, recordedAt });

  const newestTime = recordedAt.getTime();

  // Descarta muestras fuera de la ventana de tiempo (sensor se cayó y volvió, reloj saltó, etc.)
  let windowed = buf.filter((s) => newestTime - s.recordedAt.getTime() <= WINDOW_MS);

  // Tope duro de muestras, por si llegan más rápido de lo esperado
  if (windowed.length > MAX_SAMPLES) {
    windowed = windowed.slice(windowed.length - MAX_SAMPLES);
  }

  buffers.set(modbusSlaveId, windowed);

  const avgTemperature = windowed.reduce((sum, s) => sum + s.temperature, 0) / windowed.length;
  const avgHumidity = windowed.reduce((sum, s) => sum + s.humidity, 0) / windowed.length;

  return {
    temperature: avgTemperature,
    humidity: avgHumidity,
    recordedAt,          // timestamp de la muestra más reciente
    sampleCount: windowed.length
  };
}