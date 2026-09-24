import { apiRequest } from './api-client.js';

// Mientras el backend no exista, VITE_USE_MOCK_API=true guarda las emergencias en localStorage.
// Por defecto se usa el mock; poner VITE_USE_MOCK_API=false en .env para pegarle a Express.
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
const MOCK_STORAGE_KEY = 'rescuesync:emergencies';
const MOCK_LATENCY_MS = 700;

function readMockEmergencies() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function createEmergencyMock(payload) {
  await new Promise((resolve) => {
    setTimeout(resolve, MOCK_LATENCY_MS);
  });

  const emergency = {
    id: crypto.randomUUID(),
    ...payload,
    status: 'registrada',
    bonitaCaseId: null,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify([...readMockEmergencies(), emergency]));
  return emergency;
}

// POST /api/emergencies — ver rescuesync/docs/api-contracts.md
export function createEmergency(payload) {
  if (USE_MOCK_API) return createEmergencyMock(payload);
  return apiRequest('/emergencies', { method: 'POST', body: payload });
}
