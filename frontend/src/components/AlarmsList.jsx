function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function formatAlarmType(type) {
  return type
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AlarmsList({ alarms, emptyMessage = 'No hay alarmas para mostrar.' }) {
  if (!alarms?.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="alarms-list">
      {alarms.map((alarm) => (
        <article key={alarm.id} className={`alarm-row ${alarm.resolvedAt ? 'alarm-resolved' : 'alarm-open'}`}>
          <div>
            <span className="card-label">{alarm.fridge?.name || alarm.fridgeId}</span>
            <h4>{formatAlarmType(alarm.type)}</h4>
          </div>
          <div>
            <strong>{formatDateTime(alarm.startedAt)}</strong>
            <small>{alarm.resolvedAt ? `Resuelta ${formatDateTime(alarm.resolvedAt)}` : 'Sigue abierta'}</small>
          </div>
        </article>
      ))}
    </div>
  );
}