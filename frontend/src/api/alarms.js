import { apiRequest } from './client.js';

export function listAlarmRecipients() {
  return apiRequest('/alarms/recipients');
}

export function createAlarmRecipient(body) {
  return apiRequest('/alarms/recipients', { method: 'POST', body });
}

export function updateAlarmRecipient(id, body) {
  return apiRequest(`/alarms/recipients/${id}`, { method: 'PATCH', body });
}

export function deleteAlarmRecipient(id) {
  return apiRequest(`/alarms/recipients/${id}`, { method: 'DELETE' });
}