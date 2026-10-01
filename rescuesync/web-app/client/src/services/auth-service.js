import { apiRequest } from './api-client.js';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
const MOCK_SESSION_KEY = 'rescuesync:session';

// Solo para el modo mock (sin Bonita): usuarios de prueba y su rol,
// los mismos de la organización RescueSync (ver bonita/README.md).
const MOCK_ROLES = {
  OperadorM: 'operador_municipal',
  CoordinadorR: 'coordinador_regional',
  RescatistasUnidos: 'representante_ong',
  'Manos Solidarias': 'representante_ong',
  Dirección: 'auditor',
};

// POST /api/auth/login — el server valida contra Bonita y devuelve { username, role, groupPath }
export async function login(username, password) {
  if (USE_MOCK_API) {
    const role = MOCK_ROLES[username.trim()];
    if (!role || !password) throw new Error('Usuario o contraseña incorrectos.');
    const user = { username: username.trim(), role };
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
    return user;
  }
  return apiRequest('/auth/login', { method: 'POST', body: { username, password } });
}

// GET /api/auth/me — ¿hay sesión iniciada? Responde 401 si no
export async function getCurrentUser() {
  if (USE_MOCK_API) {
    const stored = localStorage.getItem(MOCK_SESSION_KEY);
    if (stored) return JSON.parse(stored);
    throw new Error('No hay sesión iniciada.');
  }
  return apiRequest('/auth/me');
}

// POST /api/auth/logout — cierra la sesión en la app y en Bonita
export function logout() {
  if (USE_MOCK_API) {
    localStorage.removeItem(MOCK_SESSION_KEY);
    return Promise.resolve();
  }
  return apiRequest('/auth/logout', { method: 'POST' });
}
