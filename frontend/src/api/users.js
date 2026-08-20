import { apiRequest } from './client.js';

export function listUsers() {
  return apiRequest('/users');
}

export function createUser(body) {
  return apiRequest('/users', {
    method: 'POST',
    body
  });
}

export function updateUser(id, body) {
  return apiRequest(`/users/${id}`, {
    method: 'PATCH',
    body
  });
}

export function deleteUser(id) {
  return apiRequest(`/users/${id}`, {
    method: 'DELETE'
  });
}