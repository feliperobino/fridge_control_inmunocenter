import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { FridgeCard } from '../components/FridgeCard.jsx';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [fridges, setFridges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadFridges() {
      setIsLoading(true);
      setError('');

      try {
        const data = await apiRequest('/fridges');

        if (!isMounted) {
          return;
        }

        setFridges(Array.isArray(data) ? data : []);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError?.data?.error || 'No se pudo cargar el dashboard');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadFridges();

    return () => {
      isMounted = false;
    };
  }, []);

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