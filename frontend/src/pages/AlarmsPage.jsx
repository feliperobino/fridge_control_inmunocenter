import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { AlarmsList } from '../components/AlarmsList.jsx';
import { ExportButtons } from '../components/ExportButtons.jsx';

function getLast24HoursRange() {
  const to = new Date();
  const from = new Date(to);
  from.setHours(from.getHours() - 24);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

export default function AlarmsPage() {
  const [fridges, setFridges] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [status, setStatus] = useState('all');
  const [fridgeId, setFridgeId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const exportRange = getLast24HoursRange();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError('');

      try {
        const [fridgesData, alarmsData] = await Promise.all([
          apiRequest('/fridges'),
          apiRequest(
            `/alarms?status=${encodeURIComponent(status)}${fridgeId ? `&fridgeId=${encodeURIComponent(fridgeId)}` : ''}`
          )
        ]);

        if (!isMounted) {
          return;
        }

        setFridges(Array.isArray(fridgesData) ? fridgesData : []);
        setAlarms(Array.isArray(alarmsData) ? alarmsData : []);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError?.data?.error || 'No se pudo cargar la vista de alarmas');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [status, fridgeId]);

  return (
    <section className="page-stack">
      <div className="page-heading page-heading-split">
        <div>
          <span className="brand-kicker">Alarmas</span>
          <h2>Eventos globales</h2>
          <p>Filtrar alarmas abiertas o resueltas, y acotar por refrigerador si lo necesitas.</p>
        </div>

        <div className="page-actions-stack">
          <div className="filters-bar card-shell">
            <label>
              Estado
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Todas</option>
                <option value="open">Abiertas</option>
                <option value="resolved">Resueltas</option>
              </select>
            </label>

            <label>
              Refrigerador
              <select value={fridgeId} onChange={(event) => setFridgeId(event.target.value)}>
                <option value="">Todos</option>
                {fridges.map((fridge) => (
                  <option key={fridge.id} value={fridge.id}>
                    {fridge.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ExportButtons fridgeId="all" from={exportRange.from} to={exportRange.to} filenamePrefix="alarmas" />
        </div>
      </div>

      {isLoading ? <div className="route-state">Cargando alarmas...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}

      {!isLoading && !error ? (
        <div className="card-shell">
          <AlarmsList alarms={alarms} emptyMessage="No hay alarmas para los filtros seleccionados." />
        </div>
      ) : null}
    </section>
  );
}