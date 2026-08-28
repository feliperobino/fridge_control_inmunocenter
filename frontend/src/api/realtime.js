let source = null;
const listeners = new Set();
const statusListeners = new Set();

let connectionStatus = 'DISCONNECTED'; // 'CONNECTED' | 'DISCONNECTED'
let lastActivityTimestamp = null;
let activityTimer = null;

// Tiempo máximo sin recibir datos/ping antes de considerar desconectado (5 minutos)
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; 

function setStatus(newStatus) {
  if (connectionStatus !== newStatus) {
    connectionStatus = newStatus;
    statusListeners.forEach((cb) => cb(connectionStatus));
  }
}

function registerActivity() {
  lastActivityTimestamp = Date.now();
  setStatus('CONNECTED');

  // Reiniciar el temporizador de inactividad
  if (activityTimer) clearTimeout(activityTimer);
  activityTimer = setTimeout(() => {
    setStatus('DISCONNECTED');
  }, INACTIVITY_TIMEOUT_MS);
}

function ensureConnection() {
  if (source) return;

  const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
  const token = localStorage.getItem('token');

  // ✅ Ahora construye /api/events correctamente sin duplicar el prefijo
  const endpoint = `${apiUrl}/api/events`;
  const url = token
    ? `${endpoint}?token=${encodeURIComponent(token)}`
    : endpoint;

  source = new EventSource(url);

  // Al conectar exitosamente
  source.onopen = () => {
    registerActivity();
  };

  // Evento custom de bienvenida o pings
  source.addEventListener('connected', () => {
    registerActivity();
  });

  // Evento de nuevas lecturas
  source.addEventListener('readings-updated', (event) => {
    registerActivity();
    let detail = null;
    try {
      detail = JSON.parse(event.data);
    } catch {
      // payload no crítico
    }
    listeners.forEach((cb) => cb(detail));
  });

  // Pings del heartbeat
  source.addEventListener('ping', () => {
    registerActivity();
  });

  source.onerror = () => {
    // Si hay error de red, no cambiamos inmediatamente el estado visual 
    // a menos que venza el INACTIVITY_TIMEOUT_MS, o si la conexión se cierra.
    if (source && source.readyState === EventSource.CLOSED) {
      source = null; // Permitir reconexión limpia
    }
  };
}

export function subscribeToReadingsUpdated(callback) {
  ensureConnection();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function subscribeToRealtimeStatus(callback) {
  ensureConnection();
  statusListeners.add(callback);
  callback(connectionStatus);
  return () => statusListeners.delete(callback);
}

export function getRealtimeStatus() {
  return connectionStatus;
}

export function getLastActivityTimestamp() {
  return lastActivityTimestamp;
}