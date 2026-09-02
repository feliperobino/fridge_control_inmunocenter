import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FridgeCard } from '../components/FridgeCard.jsx';
import { FridgeTile } from '../components/FridgeTile.jsx';
import {
  subscribeToAlarmsResolved,
  subscribeToAlarmsTriggered,
  subscribeToReadingsUpdated,
  subscribeToRealtimeStatus
} from '../api/realtime.js';
import { CriticalAlarmOverlay, isCriticalAlarm } from '../components/CriticalAlarmOverlay.jsx';
import { enableAlarmSound, startAlarmSound, stopAlarmSound } from '../utils/alarm-sound.js';

function normalizeAlarm(alarm) {
  return {
    ...alarm,
    ...(alarm.fridge || {}),
    fridgeName: alarm.fridgeName || alarm.fridge?.name || alarm.fridgeId
  };
}

export default function DashboardPage({ isKiosk = false }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isFullscreenParam = searchParams.get('fullscreen') === '1';
  const isFullscreen = isKiosk || isFullscreenParam;

  const [fridges, setFridges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sseStatus, setSseStatus] = useState('DISCONNECTED');
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const knownAlarmIds = useRef(new Set());

  const testAlarm = {
    id: 'frontend-alarm-test',
    fridgeId: fridges[0]?.id || 'frontend-test-fridge',
    fridgeName: fridges[0]?.name || 'Prueba de alarma',
    type: 'TEMP_HIGH',
    temperature: Number(fridges[0]?.tempMax || 8) + 2,
    humidity: Number(fridges[0]?.humMin || 20) + 20,
    tempMin: fridges[0]?.tempMin || 2,
    tempMax: fridges[0]?.tempMax || 8,
    humMin: fridges[0]?.humMin || 20,
    humMax: fridges[0]?.humMax || 90,
    startedAt: new Date().toISOString(),
    isTest: true
  };

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

  const loadOpenAlarms = useCallback(async () => {
    try {
      const data = await apiRequest('/alarms?status=open');
      const alarms = Array.isArray(data) ? data.map(normalizeAlarm) : [];
      alarms.forEach((alarm) => knownAlarmIds.current.add(alarm.id));
      setActiveAlarms((current) => {
        const merged = [...alarms, ...current];
        return merged.filter((alarm, index, values) => values.findIndex((item) => item.id === alarm.id) === index);
      });
    } catch {
      // El dashboard sigue operativo aunque la carga inicial de alarmas falle.
    }
  }, []);

  useEffect(() => {
    loadFridges();
    loadOpenAlarms();
  }, [loadFridges, loadOpenAlarms]);

  // Suscripción al bus SSE
  useEffect(() => {
    const unsubscribeReadings = subscribeToReadingsUpdated(() => {
      loadFridges({ silent: true });
    });

    const unsubscribeTriggered = subscribeToAlarmsTriggered((payload) => {
      const incoming = (payload?.alarms || []).map(normalizeAlarm);
      const freshAlarms = incoming.filter((alarm) => !knownAlarmIds.current.has(alarm.id));

      freshAlarms.forEach((alarm) => knownAlarmIds.current.add(alarm.id));
      if (freshAlarms.some(isCriticalAlarm)) {
        setIsSoundMuted(false);
      }
      setActiveAlarms((current) => {
        const currentIds = new Set(current.map((alarm) => alarm.id));
        return [...current, ...freshAlarms.filter((alarm) => !currentIds.has(alarm.id))];
      });
    });

    const unsubscribeResolved = subscribeToAlarmsResolved((payload) => {
      const resolvedIds = new Set((payload?.alarms || []).map((alarm) => alarm.id));
      resolvedIds.forEach((id) => knownAlarmIds.current.delete(id));
      setActiveAlarms((current) => current.filter((alarm) => !resolvedIds.has(alarm.id)));
    });

    const unsubscribeStatus = subscribeToRealtimeStatus((status) => {
      setSseStatus(status);
    });

    return () => {
      unsubscribeReadings();
      unsubscribeTriggered();
      unsubscribeResolved();
      unsubscribeStatus();
    };
  }, [loadFridges]);

  useEffect(() => {
    const hasCriticalAlarm = activeAlarms.some(isCriticalAlarm);

    if (isSoundEnabled && hasCriticalAlarm && !isSoundMuted) {
      startAlarmSound();
    } else {
      stopAlarmSound();
    }

    return () => stopAlarmSound();
  }, [activeAlarms, isSoundEnabled, isSoundMuted]);

  // Polling de respaldo cada 45 segundos en caso de microcortes de SSE
  useEffect(() => {
    const interval = setInterval(() => {
      loadFridges({ silent: true });
    }, 45000);

    return () => clearInterval(interval);
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

  const handleEnableSound = async () => {
    try {
      await enableAlarmSound();
      setIsSoundEnabled(true);
      setIsSoundMuted(false);
    } catch {
      setError('No se pudo activar el sonido de alarmas en este navegador');
    }
  };

  const handleMuteSound = () => {
    setIsSoundMuted(true);
    stopAlarmSound();
  };

  const handleTestAlarm = async () => {
    try {
      await enableAlarmSound();
      setIsSoundEnabled(true);
      setIsSoundMuted(false);
      setActiveAlarms((current) => [
        testAlarm,
        ...current.filter((alarm) => alarm.id !== testAlarm.id)
      ]);
    } catch {
      setError('No se pudo activar el sonido de alarmas en este navegador');
    }
  };

  const handleStopTestAlarm = () => {
    setActiveAlarms((current) => current.filter((alarm) => !alarm.isTest));
  };

  return (
    <section className={isFullscreen ? 'kiosk-viewport' : 'page-stack'}>
      {!isFullscreen ? (
        <div className="dashboard-controls-bar">
          <div className="realtime-status-indicator">
            <span className={`status-dot-mini ${sseStatus.toLowerCase()}`} />
            <small>{sseStatus === 'CONNECTED' ? 'En vivo' : 'Reconectando...'}</small>
          </div>

          <button
            type="button"
            className="button button-primary kiosk-toggle-btn"
            onClick={toggleFullscreen}
          >
            ⛶ Modo Fullscreen / Kiosk
          </button>
          {isAdmin ? (
            <button type="button" className="button button-alarm-test" onClick={handleTestAlarm}>
              Test alarma
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="kiosk-status-overlay">
            <span className={`status-dot-mini ${sseStatus.toLowerCase()}`} />
            <span>{sseStatus === 'CONNECTED' ? 'EN VIVO' : 'RECONECTANDO'}</span>
          </div>

          <button
            type="button"
            className="kiosk-exit-btn"
            onClick={toggleFullscreen}
            title="Salir de modo kiosk"
          >
            ✕ Salir
          </button>
        </>
      )}

      {isLoading ? <div className="route-state">Cargando refrigeradores...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}

      {!isLoading && !error ? (
        fridges.length > 0 ? (
          <div className={isFullscreen ? 'kiosk-grid' : 'fridge-grid'}>
            {fridges.map((fridge) =>
              isFullscreen ? (
                <FridgeTile
                  key={fridge.id}
                  fridge={fridge}
                  hasConfirmedAlarm={activeAlarms.some((alarm) => alarm.fridgeId === fridge.id)}
                />
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

      {isFullscreen || activeAlarms.some((alarm) => alarm.isTest) ? (
        <CriticalAlarmOverlay
          alarms={activeAlarms}
          isSoundEnabled={isSoundEnabled}
          isMuted={isSoundMuted}
          onEnableSound={handleEnableSound}
          onMute={handleMuteSound}
          onStopTest={handleStopTestAlarm}
        />
      ) : null}
    </section>
  );
}