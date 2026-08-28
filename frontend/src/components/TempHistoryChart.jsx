import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

function formatTick(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

// Algoritmo de muestreo uniforme por promedios en intervalos fijos
function resampleReadings(readings, targetPoints = 180) {
  if (!readings || readings.length === 0) return [];
  if (readings.length <= targetPoints) {
    return readings.map((r) => ({
      ...r,
      temperature: Number(r.temperature.toFixed(1)),
      humidity: Number(r.humidity.toFixed(1)),
      timestamp: new Date(r.recordedAt).getTime()
    }));
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const startTime = new Date(sorted[0].recordedAt).getTime();
  const endTime = new Date(sorted[sorted.length - 1].recordedAt).getTime();
  const interval = (endTime - startTime) / targetPoints;

  const resampled = [];
  let currentIndex = 0;

  for (let i = 0; i < targetPoints; i++) {
    const bucketStart = startTime + i * interval;
    const bucketEnd = bucketStart + interval;
    const bucketReadings = [];

    while (
      currentIndex < sorted.length &&
      new Date(sorted[currentIndex].recordedAt).getTime() < bucketEnd
    ) {
      bucketReadings.push(sorted[currentIndex]);
      currentIndex++;
    }

    if (bucketReadings.length > 0) {
      const avgTemp =
        bucketReadings.reduce((sum, r) => sum + r.temperature, 0) / bucketReadings.length;
      const avgHum =
        bucketReadings.reduce((sum, r) => sum + r.humidity, 0) / bucketReadings.length;
      const midTimestamp = Math.floor((bucketStart + bucketEnd) / 2);

      resampled.push({
        timestamp: midTimestamp,
        temperature: Number(avgTemp.toFixed(1)),
        humidity: Number(avgHum.toFixed(1)),
        count: bucketReadings.length
      });
    }
  }

  return resampled;
}

export function TempHistoryChart({ readings, fridge, selectedRange }) {
  // Re-muestreo inteligente uniforme a 180 puntos
  const data = useMemo(() => {
    return resampleReadings(readings, 180);
  }, [readings]);

  // Eje X desde 00:00 hasta 24:00 fijado según la fecha pedida
  const xDomain = useMemo(() => {
    if (selectedRange?.from && selectedRange?.to) {
      return [new Date(selectedRange.from).getTime(), new Date(selectedRange.to).getTime()];
    }
    return ['dataMin', 'dataMax'];
  }, [selectedRange]);

  const tempDomain = useMemo(() => {
    if (!fridge) return ['auto', 'auto'];
    const minConfig = Number(fridge.tempMin) ?? 2;
    const maxConfig = Number(fridge.tempMax) ?? 8;

    let realMin = minConfig;
    let realMax = maxConfig;

    data.forEach((d) => {
      if (typeof d.temperature === 'number') {
        if (d.temperature < realMin) realMin = d.temperature;
        if (d.temperature > realMax) realMax = d.temperature;
      }
    });

    return [Math.floor(realMin - 2), Math.ceil(realMax + 2)];
  }, [fridge, data]);

  const humDomain = useMemo(() => {
    if (!fridge) return [0, 100];
    const minConfig = Number(fridge.humMin) ?? 30;
    const maxConfig = Number(fridge.humMax) ?? 70;

    let realMin = minConfig;
    let realMax = maxConfig;

    data.forEach((d) => {
      if (typeof d.humidity === 'number') {
        if (d.humidity < realMin) realMin = d.humidity;
        if (d.humidity > realMax) realMax = d.humidity;
      }
    });

    return [Math.max(0, Math.floor(realMin - 5)), Math.min(100, Math.ceil(realMax + 5))];
  }, [fridge, data]);

  return (
    <div className="chart-shell">
      <div className="section-heading">
        <div>
          <span className="brand-kicker">Histórico continuo</span>
          <h3>Temperatura y humedad</h3>
        </div>
        <p>
          {data.length > 0
            ? `${readings.length.toLocaleString('es-CL')} lecturas promediadas dinámicamente en ${data.length} puntos uniformes`
            : 'No hay lecturas registradas para este día'}
        </p>
      </div>

      <div className="chart-frame">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 12 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={xDomain}
                tickFormatter={formatTick}
                stroke="rgba(255,255,255,0.55)"
                minTickGap={45}
              />
              
              <YAxis
                yAxisId="left"
                stroke="rgba(77,215,183,0.9)"
                domain={tempDomain}
                unit="°C"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="rgba(152,183,255,0.9)"
                domain={humDomain}
                unit="%"
              />
              
              <Tooltip
                contentStyle={{
                  background: '#08111f',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  color: '#edf2ff'
                }}
                labelFormatter={(ts) =>
                  new Intl.DateTimeFormat('es-CL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit'
                  }).format(new Date(ts))
                }
                formatter={(val, name) => [
                  `${typeof val === 'number' ? val.toFixed(1) : val} ${name === 'Temperatura' ? '°C' : '%'}`,
                  name
                ]}
              />

              {fridge?.tempMin !== undefined && fridge?.tempMax !== undefined ? (
                <>
                  <ReferenceArea
                    yAxisId="left"
                    y1={fridge.tempMin}
                    y2={fridge.tempMax}
                    fill="rgba(77, 215, 183, 0.08)"
                    stroke="none"
                  />
                  <ReferenceLine
                    yAxisId="left"
                    y={fridge.tempMin}
                    stroke="rgba(77, 215, 183, 0.4)"
                    strokeDasharray="3 3"
                  />
                  <ReferenceLine
                    yAxisId="left"
                    y={fridge.tempMax}
                    stroke="rgba(77, 215, 183, 0.4)"
                    strokeDasharray="3 3"
                  />
                </>
              ) : null}

              <Line
                type="monotone"
                dataKey="temperature"
                yAxisId="left"
                stroke="#4dd7b7"
                strokeWidth={2}
                dot={false}
                name="Temperatura"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                yAxisId="right"
                stroke="#98b7ff"
                strokeWidth={2}
                dot={false}
                name="Humedad"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-chart">No hay lecturas registradas para la fecha seleccionada.</div>
        )}
      </div>
    </div>
  );
}