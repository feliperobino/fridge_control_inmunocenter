import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { FridgeCard } from '../components/FridgeCard.jsx';
import { FridgeTile } from '../components/FridgeTile.jsx';
import { subscribeToReadingsUpdated } from '../api/realtime.js';

export default function DashboardPage({ isKiosk = false }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isFullscreenParam = searchParams.get('fullscreen') === '1';
  const isFullscreen = isKiosk || isFullscreenParam;

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

  useEffect(() => {
    return subscribeToReadingsUpdated(() => {
      loadFridges({ silent: true });
    });
  }, [loadFridges]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreenParam) {
        searchParams.delete('fullscreen');
        setSearchParams(searchParams);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullscreenParam, searchParams, setSearchParams]);

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Fullscreen no soportado', e);
      }
      setSearchParams({ fullscreen: '1' });
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      searchParams.delete('fullscreen');
      setSearchParams(searchParams);
      if (isKiosk) navigate('/dashboard');
    }
  };

  return (
    <section className={isFullscreen ? 'kiosk-viewport' : 'page-stack'}>
      {!isFullscreen ? (
        <div className="dashboard-controls-bar">
          <button
            type="button"
            className="button button-primary kiosk-toggle-btn"
            onClick={toggleFullscreen}
          >
            ⛶ Modo Fullscreen / Kiosk
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="kiosk-exit-btn"
          onClick={toggleFullscreen}
          title="Salir de modo kiosk"
        >
          ✕ Salir
        </button>
      )}

      {isLoading ? <div className="route-state">Cargando refrigeradores...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}

      {!isLoading && !error ? (
        fridges.length > 0 ? (
          <div className={isFullscreen ? 'kiosk-grid' : 'fridge-grid'}>
            {fridges.map((fridge) =>
              isFullscreen ? (
                <FridgeTile key={fridge.id} fridge={fridge} />
              ) : (
                <FridgeCard
                  key={fridge.id}
                  fridge={fridge}
                  onClick={(e) => {
                    if (e.target.closest('input, button, select, textarea')) {
                      return;
                    }
                    navigate(`/fridges/${fridge.id}`);
                  }}
                />
              )
            )}
          </div>
        ) : (
          <div className="state-card">Todavía no hay refrigeradores cargados.</div>
        )
      ) : null}
    </section>
  );
}