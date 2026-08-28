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

function formatTick(timestamp, rangePreset) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  // Si el rango cubre varios días, incluimos día/mes
  if (rangePreset === '7d' || rangePreset === '30d') {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // Para ventanas de horas (6h, 12h, 24h, 48h)
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function TempHistoryChart({ readings, fridge, rangePreset = '24h' }) {
  const data = useMemo(() => {
    return (readings || []).map((reading) => ({
      ...reading,
      timestamp: new Date(reading.recordedAt).getTime()
    }));
  }, [readings]);

  // Cálculo de dominios para los ejes Y con márgenes
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
          <span className="brand-kicker">Histórico</span>
          <h3>Temperatura y humedad</h3>
        </div>
        <p>
          {data.length > 0
            ? `${data.length} lecturas ordenadas cronológicamente`
            : 'No hay lecturas para mostrar en este rango'}
        </p>
      </div>

      <div className="chart-frame">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 12 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts) => formatTick(ts, rangePreset)}
                stroke="rgba(255,255,255,0.55)"
                minTickGap={30}
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
                labelFormatter={(ts) => formatTick(ts, '7d')}
                formatter={(val, name) => [
                  `${val} ${name === 'Temperatura' ? '°C' : '%'}`,
                  name
                ]}
              />

              {/* Bandas de tolerancia visual para la Temperatura Óptima */}
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
          <div className="empty-chart">No hay datos para el rango seleccionado.</div>
        )}
      </div>
    </div>
  );
}