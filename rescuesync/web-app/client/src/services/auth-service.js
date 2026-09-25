import { apiRequest } from './api-client.js';

// POST /api/auth/login — el server valida usuario y clave contra Bonita
export function login(username, password) {
  return apiRequest('/auth/login', { method: 'POST', body: { username, password } });
}

// GET /api/auth/me — es para ver si hay sesión iniciada. Responde 401 si no
export function getCurrentUser() {
  return apiRequest('/auth/me');
}

// POST /api/auth/logout — cierra la sesión en la app y en Bonita
export function logout() {
  return apiRequest('/auth/logout', { method: 'POST' });
}
