const CRITICAL_TYPES = new Set(['TEMP_HIGH', 'TEMP_LOW']);

function formatAlarmTitle(type) {
  const labels = {
    TEMP_HIGH: 'Temperatura alta confirmada',
    TEMP_LOW: 'Temperatura baja confirmada',
    HUM_HIGH: 'Humedad alta confirmada',
    HUM_LOW: 'Humedad baja confirmada'
  };

  return labels[type] || 'Alarma confirmada';
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatMeasurement(alarm) {
  if (alarm.type.startsWith('TEMP')) {
    return `${Number(alarm.temperature).toFixed(1)} °C (rango ${alarm.tempMin} °C - ${alarm.tempMax} °C)`;
  }

  return `${Number(alarm.humidity).toFixed(1)} % (rango ${alarm.humMin} % - ${alarm.humMax} %)`;
}

export function isCriticalAlarm(alarm) {
  return CRITICAL_TYPES.has(alarm?.type);
}

export function CriticalAlarmOverlay({ alarms, isSoundEnabled, isMuted, onEnableSound, onMute, onStopTest }) {
  if (!alarms.length) return null;

  const alarm = alarms[0];

  return (
    <div className="critical-alarm-overlay" role="alertdialog" aria-live="assertive" aria-label="Alarma confirmada">
      <div className="critical-alarm-panel">
        <div className="critical-alarm-heading">
          <span className="critical-alarm-kicker">ALARMA CONFIRMADA</span>
          <span className="critical-alarm-count">{alarms.length} activa{alarms.length === 1 ? '' : 's'}</span>
        </div>
        <h2>{formatAlarmTitle(alarm.type)}</h2>
        <strong className="critical-alarm-fridge">{alarm.fridgeName || alarm.fridge?.name || alarm.fridgeId}</strong>
        <p className="critical-alarm-reading">{formatMeasurement(alarm)}</p>
        <p>Fuera de rango desde las {formatTime(alarm.startedAt)}.</p>

        <div className="critical-alarm-actions">
          {alarm.isTest ? (
            <button type="button" className="button button-secondary alarm-test-stop" onClick={onStopTest}>
              Finalizar prueba
            </button>
          ) : null}
          {!isSoundEnabled ? (
            <button type="button" className="button button-alarm" onClick={onEnableSound}>
              Activar sonido
            </button>
          ) : (
            <button type="button" className="button button-alarm" onClick={onMute} disabled={isMuted}>
              {isMuted ? 'Sonido silenciado' : 'Silenciar sonido'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
