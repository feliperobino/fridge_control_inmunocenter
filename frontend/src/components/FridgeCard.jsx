import { useCallback, useEffect, useState } from 'react';
import { getFridgeReadings, updateFridge } from '../api/fridges.js';
import { subscribeToReadingsUpdated } from '../api/realtime.js';

function formatTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

// helper to check temp range only (as requirement states 2-8°C range)
function tempInRange(r, fridge) {
  if (!r || !fridge) return false;
  return r.temperature >= fridge.tempMin && r.temperature <= fridge.tempMax;
}

function isWithinRange(fridge, reading) {
  if (!fridge || !reading) {
    return false;
  }

  const tempOk = reading.temperature >= fridge.tempMin && reading.temperature <= fridge.tempMax;
  const humOk = reading.humidity >= fridge.humMin && reading.humidity <= fridge.humMax;

  return tempOk && humOk;
}

export function FridgeCard({ fridge, onClick }) {
  const latestReading = fridge?.latestReading || null;
  const hasData = Boolean(latestReading?.recordedAt);
  const isHealthy = hasData ? isWithinRange(fridge, latestReading) : false;
  const statusLabel = !hasData ? 'sin datos' : isHealthy ? 'en rango' : 'fuera de rango';

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fridge.name || '');
  const [savingName, setSavingName] = useState(false);

  const [dayOffset, setDayOffset] = useState(0);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setName(fridge.name || '');
  }, [fridge.name]);

  useEffect(() => {
    function handleReset() {
      setDayOffset(0);
    }

    window.addEventListener('fridge-monitor:reset-day', handleReset);
    return () => window.removeEventListener('fridge-monitor:reset-day', handleReset);
  }, []);

  const loadStats = useCallback(
    async ({ silent } = {}) => {
      if (!silent) setStats(null);

      try {
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).toISOString();
        const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString();

        const resp = await getFridgeReadings(fridge.id, from, to, 10000);
        const readings = Array.isArray(resp?.readings) ? resp.readings : [];

        // compute time in range and out of range
        let inRangeMs = 0;
        let outRangeMs = 0;

        // sort ascending
        readings.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

        const dayStart = new Date(from).getTime();
        const dayEnd = new Date(to).getTime();

        if (readings.length > 0) {
          for (let i = 0; i < readings.length; i++) {
            const cur = readings[i];
            const next = readings[i + 1];
            const curTs = new Date(cur.recordedAt).getTime();
            const nextTs = next ? new Date(next.recordedAt).getTime() : dayEnd;
            const duration = Math.max(0, Math.min(nextTs, dayEnd) - Math.max(curTs, dayStart));
            if (tempInRange(cur, fridge)) {
              inRangeMs += duration;
            } else {
              outRangeMs += duration;
            }
          }
        }

        // compute morning/afternoon min/max
        const morningStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).getTime();
        const morningEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 11, 59, 59).getTime();
        const afterStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0).getTime();
        const afterEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).getTime();

        let morningMin = null;
        let morningMax = null;
        let afterMin = null;
        let afterMax = null;

        for (const r of readings) {
          const ts = new Date(r.recordedAt).getTime();
          if (ts >= morningStart && ts <= morningEnd) {
            const t = r.temperature;
            morningMin = morningMin === null ? t : Math.min(morningMin, t);
            morningMax = morningMax === null ? t : Math.max(morningMax, t);
          }

          if (ts >= afterStart && ts <= afterEnd) {
            const t = r.temperature;
            afterMin = afterMin === null ? t : Math.min(afterMin, t);
            afterMax = afterMax === null ? t : Math.max(afterMax, t);
          }
        }

        const result = {
          inRangeMs,
          outRangeMs,
          morning: { min: morningMin, max: morningMax },
          afternoon: { min: afterMin, max: afterMax },
          readingsCount: readings.length
        };

        setStats(result);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load fridge stats', fridge.id, err && (err.message || err));
        setStats(null);
      }
    },
    [fridge, dayOffset]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Refresco en vivo: el backend emite un evento por cada ráfaga de ingesta procesada
  // (no uno por muestra), así que esto no re-dispara 4 veces por lectura.
  useEffect(() => {
    return subscribeToReadingsUpdated(() => {
      // Solo refrescamos si se está viendo "hoy"; si el usuario navegó a un día
      // anterior, una lectura nueva no debería moverle el piso de golpe.
      if (dayOffset === 0) {
        loadStats({ silent: true });
      }
    });
  }, [dayOffset, loadStats]);

  function formatDuration(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return `${hours}h ${rem}m`;
  }

  async function saveName() {
    if (name === fridge.name) {
      setEditing(false);
      return;
    }

    setSavingName(true);
    try {
      const updated = await updateFridge(fridge.id, { name });
      // eslint-disable-next-line no-console
      console.log('Fridge updated', updated);
      setEditing(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update fridge name', err && (err.message || err));
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="fridge-card flat" onClick={onClick} role="button" tabIndex={0}>
      <div className="fridge-card-top">
        <div style={{ flex: 1 }}>
          <span className="card-label">{fridge.location || `Slave ${fridge.modbusSlaveId}`}</span>
          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') {
                    setName(fridge.name || '');
                    setEditing(false);
                  }
                }}
                onBlur={saveName}
                disabled={savingName}
                className="fridge-name-input"
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3
                style={{ margin: 0 }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
              >
                {name}
              </h3>

              <button
                type="button"
                className="icon-button"
                aria-label="Editar nombre"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
              >
                ✎
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            aria-label="previous day"
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation();
              setDayOffset((d) => d + 1);
            }}
          >
            ←
          </button>

          <button
            type="button"
            aria-label="next day"
            className="icon-button"
            disabled={dayOffset === 0}
            onClick={(e) => {
              e.stopPropagation();
              setDayOffset((d) => Math.max(0, d - 1));
            }}
          >
            →
          </button>
          <div style={{ textAlign: 'right' }}>
            <div className={`status-dot ${!hasData ? 'status-neutral' : isHealthy ? 'status-ok' : 'status-alert'}`}>
              {statusLabel}
            </div>
            <small style={{ display: 'block', color: '#666' }}>{dayOffset === 0 ? 'Hoy' : `${dayOffset}d atrás`}</small>
          </div>
        </div>
      </div>

      <div className="section-title">Estado actual</div>

      <div className="fridge-metrics flat-metrics">
        <div>
          <span>Temperatura</span>
          <strong>{hasData ? `${latestReading.temperature.toFixed(1)}°C` : '--'}</strong>
        </div>
        <div>
          <span>Humedad</span>
          <strong>{hasData ? `${latestReading.humidity.toFixed(1)}%` : '--'}</strong>
        </div>
        <div>
          <span>Última lectura</span>
          <strong>{hasData ? formatTime(latestReading.recordedAt) || '--' : '--'}</strong>
        </div>
      </div>

      <div className="section-title">Estadísticas del día</div>

      <div className="fridge-meta flat-meta">
        <div>
          <small>Tiempo en rango</small>
          <strong>{stats ? formatDuration(stats.inRangeMs) : '--'}</strong>
        </div>
        <div>
          <small>Tiempo fuera</small>
          <strong>{stats ? formatDuration(stats.outRangeMs) : '--'}</strong>
        </div>
        <div>
          <small>T mañana</small>
          <strong>{stats && stats.morning.min !== null ? `${stats.morning.min.toFixed(1)} / ${stats.morning.max.toFixed(1)}°C` : '--'}</strong>
        </div>
        <div>
          <small>T tarde</small>
          <strong>{stats && stats.afternoon.min !== null ? `${stats.afternoon.min.toFixed(1)} / ${stats.afternoon.max.toFixed(1)}°C` : '--'}</strong>
        </div>
      </div>
    </div>
  );
}