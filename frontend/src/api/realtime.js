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
  const token = localStorage.getItem('token'); // Recuperar JWT si existe

  const url = token
    ? `${apiUrl}/api/events?token=${encodeURIComponent(token)}`
    : `${apiUrl}/api/events`;

  setStatus('CONNECTING');
  source = new EventSource(url);

  source.onopen = () => {
    setStatus('CONNECTED');
  };

  source.addEventListener('connected', () => {
    setStatus('CONNECTED');
  });

  source.addEventListener('readings-updated', (event) => {
    let detail = null;
    try {
      detail = JSON.parse(event.data);
    } catch {
      // payload no crítico
    }
    listeners.forEach((cb) => cb(detail));
  });

  source.onerror = () => {
    setStatus('DISCONNECTED');
    // EventSource reconecta automáticamente
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