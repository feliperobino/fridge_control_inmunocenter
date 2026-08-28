import { apiRequest } from './client.js';

export function getFridges() {
  return apiRequest('/fridges');
}

export function getFridge(id) {
  return apiRequest(`/fridges/${id}`);
}

export function getFridgeReadings(id, from, to, limit = 70000) {
  return apiRequest(
    `/fridges/${id}/readings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`
  );
}

export function getFridgeStats(id, from, to) {
  return apiRequest(`/fridges/${id}/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export function getFridgeDailyStats(id, date) {
  return apiRequest(`/fridges/${id}/daily-stats?date=${encodeURIComponent(date)}`);
}

export function updateFridge(id, body) {
  return apiRequest(`/fridges/${id}`, {
    method: 'PATCH',
    body
  });
}