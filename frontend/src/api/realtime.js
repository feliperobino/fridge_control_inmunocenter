let source = null;
const listeners = new Set();
const statusListeners = new Set();

let connectionStatus = 'DISCONNECTED'; // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'

function setStatus(newStatus) {
  if (connectionStatus !== newStatus) {
    connectionStatus = newStatus;
    statusListeners.forEach((cb) => cb(connectionStatus));
  }
}

function ensureConnection() {
  if (source) return;

  const apiUrl = import.meta.env.VITE_API_URL || '';
  const token = localStorage.getItem('token');

  const url = token
    ? `${apiUrl}/api/events?token=${encodeURIComponent(token)}`
    : `${apiUrl}/api/events`;

  setStatus('CONNECTING');
  source = new EventSource(url);

  // 1. Al abrir el socket nativo SSE
  source.onopen = () => {
    setStatus('CONNECTED');
  };

  // 2. Por si el servidor emite el evento custom 'connected'
  source.addEventListener('connected', () => {
    setStatus('CONNECTED');
  });

  // 3. Si llega un evento de lecturas, confirmamos que estamos conectados
  source.addEventListener('readings-updated', (event) => {
    setStatus('CONNECTED');
    let detail = null;
    try {
      detail = JSON.parse(event.data);
    } catch {
      // payload no crítico
    }
    listeners.forEach((cb) => cb(detail));
  });

  // 4. Si hay un corte o error de red
  source.onerror = () => {
    // Solo pasamos a DISCONNECTED si la conexión se cerró realmente
    if (source.readyState === EventSource.CLOSED || source.readyState === EventSource.CONNECTING) {
      setStatus('CONNECTING');
    } else {
      setStatus('DISCONNECTED');
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
  callback(connectionStatus); // Notificar estado actual inmediatamente
  return () => statusListeners.delete(callback);
}

export function getRealtimeStatus() {
  return connectionStatus;
}