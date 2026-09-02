import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { AlarmsList } from '../components/AlarmsList.jsx';
import { ExportButtons } from '../components/ExportButtons.jsx';
import { TempHistoryChart } from '../components/TempHistoryChart.jsx';
import { getLocalDateString, getLocalDayRange, shiftLocalDate } from '../utils/date-range.js';

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
  
  // Estado para capturar los extremos filtrados (suavizados) que calcula el gráfico
  const [smoothedExtremes, setSmoothedExtremes] = useState({ tempMin: null, tempMax: null });

  const [selectedDay, setSelectedDay] = useState(() => getLocalDateString());
  const selectedRange = useMemo(() => getLocalDayRange(selectedDay), [selectedDay]);

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
    return selectedDay === getLocalDateString();
  }, [selectedDay]);

  const handleExtremesCalculated = useCallback((extremes) => {
    setSmoothedExtremes(extremes);
  }, []);

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

    const tempMinConfig = Number(fridge.tempMin);
    const tempMaxConfig = Number(fridge.tempMax);
    const humMinConfig = Number(fridge.humMin);
    const humMaxConfig = Number(fridge.humMax);

    let tempInCount = 0;
    let humInCount = 0;

    readings.forEach((r) => {
      if (r.temperature >= tempMinConfig && r.temperature <= tempMaxConfig) {
        tempInCount++;
      }
      if (r.humidity >= humMinConfig && r.humidity <= humMaxConfig) {
        humInCount++;
      }
    });

    const total = readings.length;
    const tempInPercent = ((tempInCount / total) * 100).toFixed(1);
    const humInPercent = ((humInCount / total) * 100).toFixed(1);

    const minutesPerReading = (24 * 60) / total;
    const tempOutMinutes = (total - tempInCount) * minutesPerReading;
    const humOutMinutes = (total - humInCount) * minutesPerReading;

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
    setSelectedDay(shiftLocalDate(selectedDay, -1));
  }

  function handleNextDay() {
    setSelectedDay(shiftLocalDate(selectedDay, 1));
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
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            
            {/* 1. Temperatura Promedio */}
            <div className="state-card">
              <span className="card-label">Temperatura Prom.</span>
              <strong>
                {stats?.temperature?.avg != null ? `${Number(stats.temperature.avg).toFixed(1)}°C` : '--'}
              </strong>
              <small>
                En rango: <strong style={{ color: '#4dd7b7' }}>{analytics.tempInPercent}</strong> ({analytics.tempOutTime} fuera)
              </small>
            </div>

            {/* 2. Temperatura Máxima / Mínima (Valores suavizados) */}
            <div className="state-card">
              <span className="card-label">Temp Máxima / Mínima</span>
              <strong>
                {smoothedExtremes.tempMax != null ? `${smoothedExtremes.tempMax.toFixed(1)}°C` : '--'}
                <span style={{ fontSize: '0.9rem', color: '#8f9bba', margin: '0 6px' }}>/</span>
                {smoothedExtremes.tempMin != null ? `${smoothedExtremes.tempMin.toFixed(1)}°C` : '--'}
              </strong>
              <small>Calculados sobre la curva promediada</small>
            </div>

            {/* 3. Humedad Promedio */}
            <div className="state-card">
              <span className="card-label">Humedad Prom.</span>
              <strong>
                {stats?.humidity?.avg != null ? `${Number(stats.humidity.avg).toFixed(1)}%` : '--'}
              </strong>
              <small>
                En rango: <strong style={{ color: '#98b7ff' }}>{analytics.humInPercent}</strong> ({analytics.humOutTime} fuera)
              </small>
            </div>

            {/* 4. Hora Última Lectura */}
            <div className="state-card">
              <span className="card-label">Última lectura registrada</span>
              <strong>{analytics.lastReadingTime}</strong>
              <small>{readings.length.toLocaleString('es-CL')} lecturas hoy</small>
            </div>

          </div>

          <div className="card-shell">
            <TempHistoryChart
              readings={readings}
              fridge={fridge}
              selectedRange={selectedRange}
              onExtremesCalculated={handleExtremesCalculated}
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