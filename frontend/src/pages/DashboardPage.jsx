import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { FridgeCard } from '../components/FridgeCard.jsx';
import { FridgeTile } from '../components/FridgeTile.jsx';
import { subscribeToReadingsUpdated } from '../api/realtime.js';

export default function DashboardPage({ isKiosk = false }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Permite activar modo kiosk por prop o por querystring ?fullscreen=1
  const isFullscreenParam = searchParams.get('fullscreen') === '1';
  const [isFullscreen, setIsFullscreen] = useState(isKiosk || isFullscreenParam);

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

  // Sincronizar cambios de pantalla completa nativa con el navegador
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // Si sale de fullscreen nativo, actualizamos estado y URL
        setIsFullscreen(false);
        if (searchParams.get('fullscreen') === '1') {
          searchParams.delete('fullscreen');
          setSearchParams(searchParams);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [searchParams, setSearchParams]);

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Fullscreen API bloqueda o no soportada', e);
      }
      setIsFullscreen(true);
      setSearchParams({ fullscreen: '1' });
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
      searchParams.delete('fullscreen');
      setSearchParams(searchParams);
    }
  };

  return (
    <section className={`page-stack ${isFullscreen ? 'kiosk-mode-active' : ''}`}>
      <div className="dashboard-controls-bar">
        <button
          type="button"
          className={`button ${isFullscreen ? 'button-secondary' : 'button-primary'} kiosk-toggle-btn`}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? '✕ Salir de Fullscreen' : '⛶ Modo Fullscreen / Kiosk'}
        </button>
      </div>

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