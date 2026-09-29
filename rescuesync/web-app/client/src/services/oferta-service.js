import { apiRequest } from './api-client.js';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
const MOCK_OFFERS_KEY = 'rescuesync:ofertas';
const MOCK_HISTORY_KEY = 'rescuesync:oferta-historial';

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function mockOferta(emergencyId, payload) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    emergencyId,
    status: 'registrada',
    observations: payload.observations?.trim() || null,
    ongs: [],
    items: payload.items.map((item) => ({
      id: crypto.randomUUID(),
      loteId: item.loteId,
      quantityOffered: Number(item.quantityOffered),
      notes: item.notes?.trim() || null,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export async function getOwnOfertas(emergencyId) {
  if (!USE_MOCK_API) return apiRequest(`/emergencies/${emergencyId}/ofertas/mine`);
  return readStore(MOCK_OFFERS_KEY)[emergencyId] ?? [];
}

export async function createOferta(emergencyId, payload) {
  if (!USE_MOCK_API) {
    return apiRequest(`/emergencies/${emergencyId}/ofertas`, {
      method: 'POST',
      body: payload,
    });
  }

  const store = readStore(MOCK_OFFERS_KEY);
  const oferta = mockOferta(emergencyId, payload);
  store[emergencyId] = [oferta, ...(store[emergencyId] ?? [])];
  writeStore(MOCK_OFFERS_KEY, store);
  return oferta;
}

export async function updateOferta(ofertaId, payload) {
  if (!USE_MOCK_API) {
    return apiRequest(`/ofertas/${ofertaId}`, { method: 'PUT', body: payload });
  }

  const store = readStore(MOCK_OFFERS_KEY);
  const history = readStore(MOCK_HISTORY_KEY);
  let updated = null;

  Object.keys(store).forEach((emergencyId) => {
    store[emergencyId] = store[emergencyId].map((oferta) => {
      if (oferta.id !== ofertaId) return oferta;

      const versions = history[ofertaId] ?? [];
      versions.push({
        version: versions.length + 1,
        snapshot: oferta,
        changedBy: 'mock-user',
        changedAt: new Date().toISOString(),
      });
      history[ofertaId] = versions;

      updated = {
        ...mockOferta(emergencyId, payload),
        id: oferta.id,
        createdAt: oferta.createdAt,
      };
      return updated;
    });
  });

  if (!updated) throw new Error('Oferta no encontrada.');
  writeStore(MOCK_OFFERS_KEY, store);
  writeStore(MOCK_HISTORY_KEY, history);
  return updated;
}

export async function getOfertaHistory(ofertaId) {
  if (!USE_MOCK_API) return apiRequest(`/ofertas/${ofertaId}/historial`);
  return readStore(MOCK_HISTORY_KEY)[ofertaId] ?? [];
}
