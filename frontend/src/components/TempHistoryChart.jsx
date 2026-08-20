import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

function formatTick(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-AR', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function TempHistoryChart({ readings, fridge }) {
  const data = (readings || []).map((reading) => ({
    ...reading,
    time: reading.recordedAt
  }));

  return (
    <div className="chart-shell">
      <div className="section-heading">
        <div>
          <span className="brand-kicker">Histórico</span>
          <h3>Temperatura y humedad</h3>
        </div>
        <p>
          {data.length > 0
            ? `${data.length} lecturas en el período seleccionado`
            : 'No hay lecturas para mostrar en este rango'}
        </p>
      </div>

      <div className="chart-frame">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTick}
                stroke="rgba(255,255,255,0.55)"
                minTickGap={24}
              />
              <YAxis
                yAxisId="left"
                stroke="rgba(77,215,183,0.7)"
                domain={[fridge?.tempMin ?? 'auto', fridge?.tempMax ?? 'auto']}
              />
              <YAxis yAxisId="right" orientation="right" stroke="rgba(152,183,255,0.7)" />
              <Tooltip
                contentStyle={{
                  background: '#08111f',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16,
                  color: '#edf2ff'
                }}
                labelFormatter={formatTick}
              />
              <Line
                type="monotone"
                dataKey="temperature"
                yAxisId="left"
                stroke="#4dd7b7"
                strokeWidth={2}
                dot={false}
                name="Temperatura"
              />
              <Line
                type="monotone"
                dataKey="humidity"
                yAxisId="right"
                stroke="#98b7ff"
                strokeWidth={2}
                dot={false}
                name="Humedad"
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