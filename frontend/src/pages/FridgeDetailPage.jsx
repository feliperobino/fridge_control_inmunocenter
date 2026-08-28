import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { AlarmsList } from '../components/AlarmsList.jsx';
import { ExportButtons } from '../components/ExportButtons.jsx';
import { TempHistoryChart } from '../components/TempHistoryChart.jsx';

function getDayRange(dateString) {
  const baseDate = dateString ? new Date(dateString) : new Date();
  
  const from = new Date(baseDate);
  from.setHours(0, 0, 0, 0);

  const to = new Date(baseDate);
  to.setHours(23, 59, 59, 999);

  return {
    fromDate: from.toISOString().slice(0, 10),
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function formatDuration(minutes) {
  if (minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

export default function FridgeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [fridge, setFridge] = useState(null);
  const [readings, setReadings] = useState([]);
  const [stats, setStats] = useState(null);
  const [alarms, setAlarms] = useState([]);
  
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const selectedRange = useMemo(() => getDayRange(selectedDay), [selectedDay]);

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

  const exportPrefix = useMemo(() => fridge?.name || `refrigerador-${id}`, [fridge, id]);

  const isToday = useMemo(() => {
    return selectedDay === new Date().toISOString().slice(0, 10);
  }, [selectedDay]);

  // Cálculos de Time in Range y Última Lectura
  const analytics = useMemo(() => {
    if (!readings || readings.length === 0 || !fridge) {
      return {
        tempInPercent: '--',
        tempOutTime: '--',
        humInPercent: '--',
        humOutTime: '--',
        lastReadingTime: '--'
      };
    }

    const tempMin = Number(fridge.tempMin);
    const tempMax = Number(fridge.tempMax);
    const humMin = Number(fridge.humMin);
    const humMax = Number(fridge.humMax);

    let tempInCount = 0;
    let humInCount = 0;

    readings.forEach((r) => {
      if (r.temperature >= tempMin && r.temperature <= tempMax) {
        tempInCount++;
      }
      if (r.humidity >= humMin && r.humidity <= humMax) {
        humInCount++;
      }
    });

    const total = readings.length;
    const tempInPercent = ((tempInCount / total) * 100).toFixed(1);
    const humInPercent = ((humInCount / total) * 100).toFixed(1);

    // Estimación del tiempo fuera basado en la franja activa (24h)
    const minutesPerReading = (24 * 60) / total;
    const tempOutMinutes = (total - tempInCount) * minutesPerReading;
    const humOutMinutes = (total - humInCount) * minutesPerReading;

    // Obtener la hora del último registro cronológico
    const sorted = [...readings].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    const lastDate = new Date(sorted[sorted.length - 1].recordedAt);
    const lastReadingTime = new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(lastDate);

    return {
      tempInPercent: `${tempInPercent}%`,
      tempOutTime: formatDuration(tempOutMinutes),
      humInPercent: `${humInPercent}%`,
      humOutTime: formatDuration(humOutMinutes),
      lastReadingTime
    };
  }, [readings, fridge]);

  function handlePrevDay() {
    const current = new Date(selectedDay + 'T00:00:00');
    current.setDate(current.getDate() - 1);
    setSelectedDay(current.toISOString().slice(0, 10));
  }

  function handleNextDay() {
    const current = new Date(selectedDay + 'T00:00:00');
    current.setDate(current.getDate() + 1);
    setSelectedDay(current.toISOString().slice(0, 10));
  }

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

        const [fridgeData, readingsData, statsData, alarmsData] = await Promise.all([
          apiRequest(`/fridges/${id}`),
          apiRequest(
            `/fridges/${id}/readings?from=${encodeURIComponent(queryFrom)}&to=${encodeURIComponent(queryTo)}&limit=70000`
          ),
          apiRequest(`/fridges/${id}/stats?from=${encodeURIComponent(queryFrom)}&to=${encodeURIComponent(queryTo)}`),
          apiRequest(`/alarms?status=all&fridgeId=${encodeURIComponent(id)}`)
        ]);

        if (!isMounted) return;

        setFridge(fridgeData);
        setReadings(Array.isArray(readingsData?.readings) ? readingsData.readings : []);
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

    if (!payload.name || [payload.tempMin, payload.tempMax, payload.humMin, payload.humMax].some((v) => Number.isNaN(v))) {
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
          <p>Lecturas continuas de 00:00 a 24:00 horas.</p>
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

      <div className="range-controls card-shell" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="button button-secondary" type="button" onClick={handlePrevDay}>
          ← Día anterior
        </button>
        <input
          type="date"
          value={selectedDay}
          onChange={(e) => e.target.value && setSelectedDay(e.target.value)}
          style={{ background: '#08111f', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '8px' }}
        />
        <button
          className="button button-secondary"
          type="button"
          onClick={handleNextDay}
          disabled={isToday}
        >
          Día siguiente →
        </button>
        {isToday ? <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>(Hoy)</span> : null}
      </div>

      {isLoading ? <div className="route-state">Cargando lecturas del día...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}

      {!isLoading && !error ? (
        <>
          {/* Métricas horizontales con Time in Range */}
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div className="state-card">
              <span className="card-label">Temperatura (Prom / TIR)</span>
              <strong>
                {stats?.temperature?.avg != null ? `${Number(stats.temperature.avg).toFixed(1)}°C` : '--'}
                <span style={{ fontSize: '0.9rem', color: '#4dd7b7', marginLeft: '8px' }}>
                  ({analytics.tempInPercent} en rango)
                </span>
              </strong>
              <small>
                Fuera de rango: <strong>{analytics.tempOutTime}</strong> | Min {stats?.temperature?.min != null ? Number(stats.temperature.min).toFixed(1) : '--'} / Max {stats?.temperature?.max != null ? Number(stats.temperature.max).toFixed(1) : '--'}
              </small>
            </div>

            <div className="state-card">
              <span className="card-label">Humedad (Prom / TIR)</span>
              <strong>
                {stats?.humidity?.avg != null ? `${Number(stats.humidity.avg).toFixed(1)}%` : '--'}
                <span style={{ fontSize: '0.9rem', color: '#98b7ff', marginLeft: '8px' }}>
                  ({analytics.humInPercent} en rango)
                </span>
              </strong>
              <small>
                Fuera de rango: <strong>{analytics.humOutTime}</strong> | Min {stats?.humidity?.min != null ? Number(stats.humidity.min).toFixed(1) : '--'} / Max {stats?.humidity?.max != null ? Number(stats.humidity.max).toFixed(1) : '--'}
              </small>
            </div>

            <div className="state-card">
              <span className="card-label">Última lectura registrada</span>
              <strong>{analytics.lastReadingTime}</strong>
              <small>{readings.length.toLocaleString('es-CL')} lecturas procesadas hoy</small>
            </div>
          </div>

          <div className="card-shell">
            <TempHistoryChart
              readings={readings}
              fridge={fridge}
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