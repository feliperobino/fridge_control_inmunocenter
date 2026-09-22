import { useMemo, useState } from 'react';

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
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

export function AlarmsList({ alarms, emptyMessage = 'No hay alarmas para mostrar.', paginated = false, scrollable = false }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil((alarms?.length || 0) / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleAlarms = useMemo(() => {
    if (!paginated) return alarms || [];
    const start = (currentPage - 1) * pageSize;
    return (alarms || []).slice(start, start + pageSize);
  }, [alarms, currentPage, paginated]);

  if (!alarms?.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <>
      <div className={`alarms-list ${scrollable ? 'alarms-list-scroll' : ''}`}>
        {visibleAlarms.map((alarm) => (
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
      {paginated && pageCount > 1 ? (
        <div className="list-pagination">
          <button className="button button-secondary" type="button" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>
            Anteriores
          </button>
          <span>Página {currentPage} de {pageCount}</span>
          <button className="button button-secondary" type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>
            Siguientes
          </button>
        </div>
      ) : null}
    </>
  );
}