import { EventEmitter } from 'events';

// Un solo container, un solo proceso Node: un EventEmitter en memoria alcanza
// como bus pub-sub. Si en el futuro escalas a más de una instancia del backend,
// esto habría que moverlo a Redis pub-sub (o similar) para que todas las
// instancias se enteren del evento.
export const realtimeBus = new EventEmitter();
realtimeBus.setMaxListeners(0); // varias pestañas/clientes SSE conectados a la vez

/**
 * Se llama UNA VEZ por request de ingest ya procesado (una ráfaga = un llamado),
 * nunca por cada item individual del batch.
 */
export function emitReadingsUpdated(fridgeIds) {
  realtimeBus.emit('readings-updated', {
    fridgeIds,
    at: new Date().toISOString()
  });
}

export function emitAlarmsTriggered(alarms) {
  realtimeBus.emit('alarms-triggered', {
    alarms,
    at: new Date().toISOString()
  });
}

export function emitAlarmsResolved(alarms) {
  realtimeBus.emit('alarms-resolved', {
    alarms,
    at: new Date().toISOString()
  });
}