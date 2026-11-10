import { apiRequest } from './api-client.js';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';

// Los avisos los generan Bonita y el backend; el modo mock no tiene bandeja.

// GET /api/notifications — [{id, tipo, leida, emergencyId, emergencyType, ..., createdAt}]
export async function listNotifications() {
  if (USE_MOCK_API) return [];
  const items = await apiRequest('/notifications');
  return Array.isArray(items) ? items : [];
}

// PATCH /api/notifications/:id/leida
export async function markNotificationRead(id) {
  if (USE_MOCK_API) return { id, leida: true };
  return apiRequest(`/notifications/${id}/leida`, { method: 'PATCH' });
}
