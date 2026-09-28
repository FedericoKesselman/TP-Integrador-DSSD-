import { apiRequest } from './api-client.js';
import { updateEmergencyStatusMock } from './emergency-service.js';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
const MOCK_LOTES_STORAGE_KEY = 'rescuesync:lotes';
const MOCK_LATENCY_MS = 500;

function readMockLotesStore() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_LOTES_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeMockLotesStore(store) {
  localStorage.setItem(MOCK_LOTES_STORAGE_KEY, JSON.stringify(store));
}

// GET /api/emergencies/:emergencyId/lotes
export async function getLotes(emergencyId) {
  if (USE_MOCK_API) {
    const store = readMockLotesStore();
    return store[emergencyId] ?? [];
  }
  return apiRequest(`/emergencies/${emergencyId}/lotes`);
}

// POST /api/emergencies/:emergencyId/lotes
export async function saveLotes(emergencyId, lotes) {
  if (USE_MOCK_API) {
    await new Promise((resolve) => {
      setTimeout(resolve, MOCK_LATENCY_MS);
    });

    const store = readMockLotesStore();
    const formattedLotes = lotes.map((lote) => ({
      id: lote.id || crypto.randomUUID(),
      resourceType: lote.resourceType.trim(),
      unit: lote.unit?.trim() || null,
      quantityRequested: Number(lote.quantityRequested),
      notes: lote.notes?.trim() || null,
      createdAt: lote.createdAt || new Date().toISOString(),
    }));

    store[emergencyId] = formattedLotes;
    writeMockLotesStore(store);

    return {
      emergencyId,
      lotes: formattedLotes,
    };
  }

  return apiRequest(`/emergencies/${emergencyId}/lotes`, {
    method: 'POST',
    body: {
      lotes: lotes.map((lote) => ({
        resourceType: lote.resourceType.trim(),
        unit: lote.unit?.trim() || null,
        quantityRequested: Number(lote.quantityRequested),
        notes: lote.notes?.trim() || null,
      })),
    },
  });
}

// POST /api/emergencies/:emergencyId/convocatoria
export async function publishConvocatoria(emergencyId) {
  if (USE_MOCK_API) {
    await new Promise((resolve) => {
      setTimeout(resolve, MOCK_LATENCY_MS);
    });

    const store = readMockLotesStore();
    const existingLotes = store[emergencyId] ?? [];
    if (existingLotes.length === 0) {
      throw new Error('La emergencia debe tener al menos un lote para abrir la convocatoria.');
    }

    updateEmergencyStatusMock(emergencyId, 'convocatoria_abierta');
    return {
      emergencyId,
      status: 'convocatoria_abierta',
    };
  }

  return apiRequest(`/emergencies/${emergencyId}/convocatoria`, {
    method: 'POST',
  });
}
