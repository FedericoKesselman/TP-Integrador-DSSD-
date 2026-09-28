import { resolveUserRole } from '../lib/auth-roles.js';
import { apiRequest } from './api-client.js';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
const MOCK_SESSION_KEY = 'rescuesync:session';

// POST /api/auth/login — en modo real valida contra Bonita; en mock usa localStorage
export async function login(username, password) {
  if (USE_MOCK_API) {
    if (!username || !password) {
      throw new Error('Usuario y contraseña son obligatorios.');
    }
    const cleanUsername = username.trim();
    const user = {
      username: cleanUsername,
      role: resolveUserRole(cleanUsername),
    };
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
    return user;
  }
  const result = await apiRequest('/auth/login', { method: 'POST', body: { username, password } });
  return {
    ...result,
    role: result.role || resolveUserRole(result.username),
  };
}

// GET /api/auth/me — para ver si hay sesión iniciada
export async function getCurrentUser() {
  if (USE_MOCK_API) {
    try {
      const stored = localStorage.getItem(MOCK_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          role: parsed.role || resolveUserRole(parsed.username),
        };
      }
    } catch {
      // ignorar error de parseo
    }
    throw new Error('No hay sesión iniciada.');
  }
  const result = await apiRequest('/auth/me');
  return {
    ...result,
    role: result.role || resolveUserRole(result.username),
  };
}

// POST /api/auth/logout — cierra la sesión en la app y en Bonita
export function logout() {
  if (USE_MOCK_API) {
    localStorage.removeItem(MOCK_SESSION_KEY);
    return Promise.resolve();
  }
  return apiRequest('/auth/logout', { method: 'POST' });
}
