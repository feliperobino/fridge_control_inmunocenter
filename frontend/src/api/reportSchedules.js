import { apiRequest } from './client.js';

export function listReportSchedules() {
  return apiRequest('/report-schedules');
}

export function createReportSchedule(body) {
  return apiRequest('/report-schedules', {
    method: 'POST',
    body
  });
}

export function updateReportSchedule(id, body) {
  return apiRequest(`/report-schedules/${id}`, {
    method: 'PATCH',
    body
  });
}

export function deleteReportSchedule(id) {
  return apiRequest(`/report-schedules/${id}`, {
    method: 'DELETE'
  });
}