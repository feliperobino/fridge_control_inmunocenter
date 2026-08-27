function formatTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function isWithinRange(fridge, reading) {
  if (!fridge || !reading) return false;
  const tempOk = reading.temperature >= fridge.tempMin && reading.temperature <= fridge.tempMax;
  const humOk = reading.humidity >= fridge.humMin && reading.humidity <= fridge.humMax;
  return tempOk && humOk;
}

export function FridgeTile({ fridge }) {
  const latestReading = fridge?.latestReading || null;
  const hasData = Boolean(latestReading?.recordedAt);
  const isHealthy = hasData ? isWithinRange(fridge, latestReading) : false;
  const statusLabel = !hasData ? 'SIN DATOS' : isHealthy ? 'EN RANGO' : 'ALERTA';

  const statusClass = !hasData ? 'kiosk-neutral' : isHealthy ? 'kiosk-ok' : 'kiosk-alert';

  return (
    <div className={`fridge-tile ${statusClass}`}>
      <div className="kiosk-tile-header">
        <span className="kiosk-location">{fridge.location || `Slave ${fridge.modbusSlaveId}`}</span>
        <h2 className="kiosk-name">{fridge.name}</h2>
        <span className={`kiosk-badge ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="kiosk-tile-metrics">
        <div className="kiosk-metric">
          <span className="kiosk-metric-label">TEMP</span>
          <span className="kiosk-metric-value">
            {hasData ? `${latestReading.temperature.toFixed(1)}°C` : '--'}
          </span>
          <small className="kiosk-range-hint">
            Rango: {fridge.tempMin}°C - {fridge.tempMax}°C
          </small>
        </div>

        <div className="kiosk-metric">
          <span className="kiosk-metric-label">HUMEDAD</span>
          <span className="kiosk-metric-value">
            {hasData ? `${latestReading.humidity.toFixed(1)}%` : '--'}
          </span>
          <small className="kiosk-range-hint">
            Rango: {fridge.humMin}% - {fridge.humMax}%
          </small>
        </div>
      </div>

      <div className="kiosk-tile-footer">
        <span>Última actualización: <strong>{hasData ? formatTime(latestReading.recordedAt) : '--'}</strong></span>
      </div>
    </div>
  );
}