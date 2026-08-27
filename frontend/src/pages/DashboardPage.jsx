import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { FridgeCard } from '../components/FridgeCard.jsx';
import { subscribeToReadingsUpdated } from '../api/realtime.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [fridges, setFridges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFridges = useCallback(async ({ silent } = {}) => {
    if (!silent) setIsLoading(true);
    setError('');

    try {
      const data = await apiRequest('/fridges');
      setFridges(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError?.data?.error || 'No se pudo cargar el dashboard');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFridges();
  }, [loadFridges]);

  // Refresco en vivo: el backend emite un evento por cada ráfaga de ingesta
  // procesada (no uno por sensor), así que esto no re-dispara 4 veces por lectura.
  useEffect(() => {
    return subscribeToReadingsUpdated(() => {
      loadFridges({ silent: true });
    });
  }, [loadFridges]);

  return (
    <section className="page-stack">

      {isLoading ? <div className="route-state">Cargando refrigeradores...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}

      {!isLoading && !error ? (
        fridges.length > 0 ? (
          <div className="fridge-grid">
            {fridges.map((fridge) => (
              <FridgeCard
                key={fridge.id}
                fridge={fridge}
                onClick={(e) => {
                  // Si el clic viene de un input, botón o selector, detiene la navegación
                  if (e.target.closest('input, button, select, textarea')) {
                    return;
                  }
                  navigate(`/fridges/${fridge.id}`);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="state-card">Todavía no hay refrigeradores cargados.</div>
        )
      ) : null}
    </section>
  );
}