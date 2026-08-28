import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { AlarmsList } from '../components/AlarmsList.jsx';
import { ExportButtons } from '../components/ExportButtons.jsx';
import { TempHistoryChart } from '../components/TempHistoryChart.jsx';

const RANGE_PRESETS = [
  { key: '6h', label: 'Últimas 6 horas' },
  { key: '12h', label: 'Últimas 12 horas' },
  { key: '24h', label: 'Últimas 24 horas' },
  { key: '48h', label: 'Últimas 48 horas' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'custom', label: 'Personalizado' }
];

function getPresetRange(preset) {
  const to = new Date();
  const from = new Date(to);

  switch (preset) {
    case '6h':
      from.setHours(from.getHours() - 6);
      break;
    case '12h':
      from.setHours(from.getHours() - 12);
      break;
    case '48h':
      from.setHours(from.getHours() - 48);
      break;
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '24h':
    default:
      from.setHours(from.getHours() - 24);
      break;
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

function formatDateInputValue(date) {
  return new Date(date).toISOString().slice(0, 16);
}

export default function FridgeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [fridge, setFridge] = useState(null);
  const [readings, setReadings] = useState([]);
  const [stats, setStats] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [rangePreset, setRangePreset] = useState('24h');
  const [customFrom, setCustomFrom] = useState(() => formatDateInputValue(getPresetRange('24h').from));
  const [customTo, setCustomTo] = useState(() => formatDateInputValue(getPresetRange('24h').to));
  const [selectedRange, setSelectedRange] = useState(() => getPresetRange('24h'));
  const [editForm, setEditForm] = useState({
    name: '',
    tempMin: '',
    tempMax: '',
    humMin: '',
    humMax: ''
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const rangeLabel = useMemo(
    () => RANGE_PRESETS.find((preset) => preset.key === rangePreset)?.label || 'Últimas 24 horas',
    [rangePreset]
  );

  const exportPrefix = useMemo(() => fridge?.name || `refrigerador-${id}`, [fridge, id]);

  useEffect(() => {
    if (rangePreset !== 'custom') {
      setSelectedRange(getPresetRange(rangePreset));
    }
  }, [rangePreset]);

  useEffect(() => {
    if (fridge) {
      setEditForm({
        name: fridge.name || '',
        tempMin: String(fridge.tempMin ?? ''),
        tempMax: String(fridge.tempMax ?? ''),
        humMin: String(fridge.humMin ?? ''),
        humMax: String(fridge.humMax ?? '')
      });
    }
  }, [fridge]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError('');

      try {
        const queryFrom = selectedRange.from;
        const queryTo = selectedRange.to;

        // Soporte amplio para 70,000 puntos
        const limit = 70000;

        const [fridgeData, readingsData, statsData, alarmsData] = await Promise.all([
          apiRequest(`/fridges/${id}`),
          apiRequest(
            `/fridges/${id}/readings?from=${encodeURIComponent(queryFrom)}&to=${encodeURIComponent(queryTo)}&limit=${limit}`
          ),
          apiRequest(`/fridges/${id}/stats?from=${encodeURIComponent(queryFrom)}&to=${encodeURIComponent(queryTo)}`),
          apiRequest(`/alarms?status=all&fridgeId=${encodeURIComponent(id)}`)
        ]);

        if (!isMounted) {
          return;
        }

        const rawReadings = Array.isArray(readingsData?.readings) ? readingsData.readings : [];

        // Orden cronológico explícito (pasado -> presente)
        const sortedReadings = rawReadings.sort(
          (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        );

        setFridge(fridgeData);
        setReadings(sortedReadings);
        setStats(statsData);
        setAlarms(Array.isArray(alarmsData) ? alarmsData : []);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError?.data?.error || 'No se pudo cargar el detalle del refrigerador');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (id) {
      loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [id, selectedRange]);

  function handleCustomRangeSubmit(event) {
    event.preventDefault();
    setSelectedRange({
      from: new Date(customFrom).toISOString(),
      to: new Date(customTo).toISOString()
    });
  }

  function handlePresetChange(event) {
    const nextPreset = event.target.value;
    setRangePreset(nextPreset);

    if (nextPreset !== 'custom') {
      const nextRange = getPresetRange(nextPreset);
      setSelectedRange(nextRange);
      setCustomFrom(formatDateInputValue(nextRange.from));
      setCustomTo(formatDateInputValue(nextRange.to));
    }
  }

  async function handleFridgeUpdate(event) {
    event.preventDefault();
    setEditError('');
    setEditSuccess('');

    const payload = {
      name: editForm.name.trim(),
      tempMin: Number(editForm.tempMin),
      tempMax: Number(editForm.tempMax),
      humMin: Number(editForm.humMin),
      humMax: Number(editForm.humMax)
    };

    if (!payload.name || [payload.tempMin, payload.tempMax, payload.humMin, payload.humMax].some((value) => Number.isNaN(value))) {
      setEditError('Revisa nombre y rangos antes de guardar.');
      return;
    }

    if (payload.tempMin >= payload.tempMax || payload.humMin >= payload.humMax) {
      setEditError('El mínimo debe ser menor que el máximo.');
      return;
    }

    try {
      const updatedFridge = await apiRequest(`/fridges/${id}`, {
        method: 'PATCH',
        body: payload
      });

      setFridge(updatedFridge);
      setEditSuccess('Refrigerador actualizado.');
    } catch (updateError) {
      setEditError(updateError?.data?.error || 'No se pudo actualizar el refrigerador');
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading page-heading-split">
        <div>
          <span className="brand-kicker">Detalle</span>
          <h2>{fridge?.name || `Refrigerador ${id}`}</h2>
          <p>Histórico de temperatura y humedad para el rango {rangeLabel.toLowerCase()}.</p>
        </div>

        <div className="page-actions-stack">
          <div className="pill-grid">
            <div className="metric-pill">
              <span>Rango temp</span>
              <strong>{fridge ? `${fridge.tempMin}°C - ${fridge.tempMax}°C` : '--'}</strong>
            </div>
            <div className="metric-pill">
              <span>Rango hum</span>
              <strong>{fridge ? `${fridge.humMin}% - ${fridge.humMax}%` : '--'}</strong>
            </div>
          </div>
          {fridge ? (
            <ExportButtons
              fridgeId={fridge.id}
              from={selectedRange.from}
              to={selectedRange.to}
              filenamePrefix={exportPrefix}
            />
          ) : null}
        </div>
      </div>

      <div className="range-controls card-shell">
        <label>
          Rango
          <select value={rangePreset} onChange={handlePresetChange}>
            {RANGE_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        {rangePreset === 'custom' ? (
          <form className="custom-range-form" onSubmit={handleCustomRangeSubmit}>
            <label>
              Desde
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                required
              />
            </label>
            <label>
              Hasta
              <input
                type="datetime-local"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                required
              />
            </label>
            <button className="button button-secondary" type="submit">
              Aplicar rango
            </button>
          </form>
        ) : null}
      </div>

      {isLoading ? <div className="route-state">Cargando historial...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}

      {!isLoading && !error ? (
        <>
          <div className="stats-grid">
            <div className="state-card">
              <span className="card-label">Temperatura</span>
              <strong>{stats?.temperature?.avg != null ? `${Number(stats.temperature.avg).toFixed(1)}°C` : '--'}</strong>
              <small>
                Min {stats?.temperature?.min != null ? Number(stats.temperature.min).toFixed(1) : '--'} / Max {stats?.temperature?.max != null ? Number(stats.temperature.max).toFixed(1) : '--'}
              </small>
            </div>
            <div className="state-card">
              <span className="card-label">Humedad</span>
              <strong>{stats?.humidity?.avg != null ? `${Number(stats.humidity.avg).toFixed(1)}%` : '--'}</strong>
              <small>
                Min {stats?.humidity?.min != null ? Number(stats.humidity.min).toFixed(1) : '--'} / Max {stats?.humidity?.max != null ? Number(stats.humidity.max).toFixed(1) : '--'}
              </small>
            </div>
            <div className="state-card">
              <span className="card-label">Lecturas</span>
              <strong>{readings.length}</strong>
              <small>Registros en el período seleccionado</small>
            </div>
          </div>

          <div className="card-shell">
            <TempHistoryChart
              readings={readings}
              fridge={fridge}
              rangePreset={rangePreset}
              selectedRange={selectedRange}
            />
          </div>

          <div className="card-shell">
            <div className="section-heading">
              <div>
                <span className="brand-kicker">Alarmas</span>
                <h3>Eventos del refrigerador</h3>
              </div>
            </div>
            <AlarmsList alarms={alarms} />
          </div>

          {user?.role === 'ADMIN' && fridge ? (
            <div className="card-shell">
              <div className="section-heading">
                <div>
                  <span className="brand-kicker">ADMIN</span>
                  <h3>Editar refrigerador</h3>
                </div>
              </div>

              <form className="admin-form" onSubmit={handleFridgeUpdate}>
                <label>
                  Nombre
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                    required
                  />
                </label>

                <div className="admin-grid">
                  <label>
                    Temp min
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.tempMin}
                      onChange={(event) => setEditForm((current) => ({ ...current, tempMin: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Temp max
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.tempMax}
                      onChange={(event) => setEditForm((current) => ({ ...current, tempMax: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Hum min
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.humMin}
                      onChange={(event) => setEditForm((current) => ({ ...current, humMin: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Hum max
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.humMax}
                      onChange={(event) => setEditForm((current) => ({ ...current, humMax: event.target.value }))}
                      required
                    />
                  </label>
                </div>

                {editError ? <p className="form-error">{editError}</p> : null}
                {editSuccess ? <p className="form-success">{editSuccess}</p> : null}

                <button className="button button-primary" type="submit">
                  Guardar cambios
                </button>
              </form>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}