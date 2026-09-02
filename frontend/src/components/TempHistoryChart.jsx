import { useEffect, useMemo, useState } from 'react';
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

function resampleReadings(readings, range, targetPoints = 180) {
  if (!readings || readings.length === 0) return [];

  const sorted = [...readings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const startTime = range?.from ? new Date(range.from).getTime() : new Date(sorted[0].recordedAt).getTime();
  const endTime = range?.to ? new Date(range.to).getTime() : new Date(sorted[sorted.length - 1].recordedAt).getTime();
  const interval = (endTime - startTime) / targetPoints;

  if (!Number.isFinite(interval) || interval <= 0) return [];

  const resampled = [];
  let currentIndex = 0;

  for (let i = 0; i < targetPoints; i++) {
    const bucketStart = startTime + i * interval;
    const bucketEnd = bucketStart + interval;
    const bucketReadings = [];

    while (currentIndex < sorted.length) {
      const readingTime = new Date(sorted[currentIndex].recordedAt).getTime();
      if (readingTime < bucketStart) {
        currentIndex++;
      } else if (readingTime < bucketEnd || (i === targetPoints - 1 && readingTime <= endTime)) {
        bucketReadings.push(sorted[currentIndex]);
        currentIndex++;
      } else {
        break;
      }
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
    } else {
      resampled.push({
        timestamp: Math.floor((bucketStart + bucketEnd) / 2),
        temperature: null,
        humidity: null,
        count: 0
      });
    }
  }

  return resampled;
}

export function TempHistoryChart({ readings, fridge, selectedRange, onExtremesCalculated }) {
  const [showTemp, setShowTemp] = useState(true);
  const [showHum, setShowHum] = useState(true);

  // 1. Datos promediados para graficar
  const data = useMemo(() => {
    return resampleReadings(readings, selectedRange, 180);
  }, [readings, selectedRange]);

  // 2. Extremos calculados estrictamente sobre la curva promediada (resilientes al ruido)
  const smoothedExtremes = useMemo(() => {
    if (!data || data.length === 0) return { tempMin: null, tempMax: null };

    let min = Infinity;
    let max = -Infinity;

    data.forEach((d) => {
      if (typeof d.temperature === 'number' && !Number.isNaN(d.temperature)) {
        if (d.temperature < min) min = d.temperature;
        if (d.temperature > max) max = d.temperature;
      }
    });

    return {
      tempMin: min !== Infinity ? min : null,
      tempMax: max !== -Infinity ? max : null
    };
  }, [data]);

  // Comunicar los valores suavizados al componente padre (FridgeDetailPage)
  useEffect(() => {
    if (onExtremesCalculated) {
      onExtremesCalculated(smoothedExtremes);
    }
  }, [smoothedExtremes, onExtremesCalculated]);

  const xDomain = useMemo(() => {
    if (selectedRange?.from && selectedRange?.to) {
      return [new Date(selectedRange.from).getTime(), new Date(selectedRange.to).getTime()];
    }
    return ['dataMin', 'dataMax'];
  }, [selectedRange]);

  const ticks = useMemo(() => {
    if (!selectedRange?.from) return undefined;
    const start = new Date(selectedRange.from).getTime();
    const step = 3 * 3600 * 1000;
    const ticksArr = [];
    for (let t = start; t <= start + 24 * 3600 * 1000; t += step) {
      ticksArr.push(t);
    }
    return ticksArr;
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
      <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="brand-kicker">Histórico continuo</span>
          <h3>Temperatura y humedad</h3>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#4dd7b7' }}>
            <input
              type="checkbox"
              checked={showTemp}
              onChange={(e) => setShowTemp(e.target.checked)}
            />
            Temperatura
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#98b7ff' }}>
            <input
              type="checkbox"
              checked={showHum}
              onChange={(e) => setShowHum(e.target.checked)}
            />
            Humedad
          </label>
        </div>
      </div>

      <div className="chart-frame">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={data} margin={{ top: 16, right: 35, left: 10, bottom: 25 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={xDomain}
                ticks={ticks}
                tickFormatter={formatTick}
                stroke="#8f9bba"
                tick={{ fill: '#8f9bba', fontSize: 12 }}
                dy={10}
              />
              
              <YAxis
                yAxisId="left"
                stroke="rgba(77,215,183,0.9)"
                tick={{ fill: 'rgba(77,215,183,0.9)', fontSize: 12 }}
                domain={tempDomain}
                unit="°C"
                hide={!showTemp}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="rgba(152,183,255,0.9)"
                tick={{ fill: 'rgba(152,183,255,0.9)', fontSize: 12 }}
                domain={humDomain}
                unit="%"
                hide={!showHum}
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

              {showTemp && fridge?.tempMin !== undefined && fridge?.tempMax !== undefined ? (
                <ReferenceArea
                  yAxisId="left"
                  y1={fridge.tempMin}
                  y2={fridge.tempMax}
                  fill="rgba(77, 215, 183, 0.2)"
                  stroke="none"
                />
              ) : null}

              {/* Intersectan exactamente la cresta y valle de la curva suavizada */}
              {showTemp && smoothedExtremes.tempMax != null ? (
                <ReferenceLine
                  yAxisId="left"
                  y={smoothedExtremes.tempMax}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{
                    value: `T_max: ${smoothedExtremes.tempMax.toFixed(1)}°C`,
                    fill: '#ef4444',
                    position: 'top',
                    fontSize: 12
                  }}
                />
              ) : null}

              {showTemp && smoothedExtremes.tempMin != null ? (
                <ReferenceLine
                  yAxisId="left"
                  y={smoothedExtremes.tempMin}
                  stroke="#3b82f6"
                  strokeDasharray="5 5"
                  label={{
                    value: `T_min: ${smoothedExtremes.tempMin.toFixed(1)}°C`,
                    fill: '#3b82f6',
                    position: 'bottom',
                    fontSize: 12
                  }}
                />
              ) : null}

              {showTemp ? (
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
              ) : null}

              {showHum ? (
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
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-chart">No hay lecturas registradas para la fecha seleccionada.</div>
        )}
      </div>
    </div>
  );
}