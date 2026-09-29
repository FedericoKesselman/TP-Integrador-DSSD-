import { apiRequest } from './api-client.js';

// Mientras el backend no exista, VITE_USE_MOCK_API=true guarda las emergencias en localStorage.
// Por defecto se usa el mock; poner VITE_USE_MOCK_API=false en .env para pegarle a Express.
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
const MOCK_STORAGE_KEY = 'rescuesync:emergencies';
const MOCK_LATENCY_MS = 700;

const SEED_EMERGENCIES = [
  {
    id: 'emg-001',
    type: 'inundacion',
    typeOther: null,
    severity: 'alta',
    provinceId: '06',
    province: 'Buenos Aires',
    municipalityId: '060441',
    municipality: 'La Plata',
    affectedZone: 'Barrios Tolosa y Ringuelet, márgenes del arroyo El Gato',
    latitude: -34.9214,
    longitude: -57.9544,
    occurredAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    estimatedAffectedPeople: 350,
    description: 'Desborde del arroyo tras 180 mm de lluvia en 6 horas. Viviendas anegadas y cortes de energía.',
    contactName: 'María Gómez',
    contactPhone: '+54 221 555-1234',
    status: 'registrada',
    bonitaCaseId: null,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'emg-002',
    type: 'incendio',
    typeOther: null,
    severity: 'critica',
    provinceId: '14',
    province: 'Córdoba',
    municipalityId: '140112',
    municipality: 'Capilla del Monte',
    affectedZone: 'Laderas este del cerro Uritorco y parajes vecinos',
    latitude: -30.8601,
    longitude: -64.5244,
    occurredAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    estimatedAffectedPeople: 720,
    description: 'Foco ígneo propagado por ráfagas de 60 km/h en pastizales secos. Riesgo de interfaz con viviendas.',
    contactName: 'Esteban Morales',
    contactPhone: '+54 3548 45-6789',
    status: 'registrada',
    bonitaCaseId: null,
    createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
  },
];

function readMockEmergencies() {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(SEED_EMERGENCIES));
      return SEED_EMERGENCIES;
    }
    return JSON.parse(raw) ?? [];
  } catch {
    return SEED_EMERGENCIES;
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
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify([emergency, ...readMockEmergencies()]));
  return emergency;
}

// POST /api/emergencies — ver rescuesync/docs/api-contracts.md
export function createEmergency(payload) {
  if (USE_MOCK_API) return createEmergencyMock(payload);
  return apiRequest('/emergencies', { method: 'POST', body: payload });
}

// GET /api/emergencies — ver rescuesync/docs/api-contracts.md
export async function listEmergencies() {
  if (USE_MOCK_API) {
    return [...readMockEmergencies()].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }
  return apiRequest('/emergencies');
}

// Obtener una emergencia por id (para la vista de desglose de lotes)
export async function getEmergency(id) {
  if (USE_MOCK_API) {
    const list = readMockEmergencies();
    const found = list.find((item) => String(item.id) === String(id));
    if (!found) throw new Error('Emergencia no encontrada.');
    return found;
  }
  const list = await apiRequest('/emergencies');
  const found = list.find((item) => String(item.id) === String(id));
  if (!found) throw new Error('Emergencia no encontrada.');
  return found;
}

// Actualizar el estado de una emergencia en mock (ej: pasar a convocatoria_abierta)
export function updateEmergencyStatusMock(id, newStatus) {
  const list = readMockEmergencies();
  const updated = list.map((item) =>
    String(item.id) === String(id) ? { ...item, status: newStatus } : item,
  );
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(updated));
}
