// Cliente SSE compartido: una sola conexión para toda la app, sin importar
// cuántos FridgeCard estén montados escuchando.
let source = null;
const listeners = new Set();

function ensureConnection() {
  if (source) return;

  const apiUrl = import.meta.env.VITE_API_URL;
  source = new EventSource(`${apiUrl}/api/events`);

  source.addEventListener('readings-updated', (event) => {
    let detail = null;
    try {
      detail = JSON.parse(event.data);
    } catch {
      // payload no crítico, seguimos igual
    }
    listeners.forEach((cb) => cb(detail));
  });

  source.onerror = () => {
    // EventSource reintenta la conexión solo; no hace falta manejarlo aquí.
    // eslint-disable-next-line no-console
    console.warn('SSE de lecturas desconectado, reintentando...');
  };
}

/**
 * Se suscribe a "llegó una ráfaga nueva de lecturas". El callback se llama
 * una vez por request de ingest procesado (no una vez por muestra/sensor).
 * Devuelve una función para cancelar la suscripción.
 */
export function subscribeToReadingsUpdated(callback) {
  ensureConnection();
  listeners.add(callback);
  return () => listeners.delete(callback);
}