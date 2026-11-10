import { RESOURCE_CATEGORIES } from '../features/lotes/lote-constants.js';

import { apiRequest } from './api-client.js';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
const MOCK_INVENTARIO_KEY = 'rescuesync:inventario';
const MOCK_LATENCY_MS = 400;

const CATALOG = new Map(
  RESOURCE_CATEGORIES.flatMap((category) => category.resources).map((resource) => [
    resource.id,
    resource,
  ]),
);

function readMockStock() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_INVENTARIO_KEY)) ?? {};
  } catch {
    return {};
  }
}

function mockStockToList(stock) {
  return Object.entries(stock).map(([recursoCodigo, cantidadTotal]) => ({
    recursoCodigo,
    nombre: CATALOG.get(recursoCodigo)?.label ?? recursoCodigo,
    unidad: CATALOG.get(recursoCodigo)?.unit ?? null,
    cantidadTotal,
    cantidadComprometida: 0,
    cantidadDisponible: cantidadTotal,
  }));
}

// GET /api/inventario — [{recursoCodigo, nombre, unidad, cantidadTotal, cantidadComprometida, cantidadDisponible}]
// Solo trae los recursos que la ONG ya cargó; el catálogo completo es el de los lotes.
export async function getInventario() {
  if (!USE_MOCK_API) return apiRequest('/inventario');
  return mockStockToList(readMockStock());
}

// PUT /api/inventario con [{recursoCodigo, cantidadTotal}] — devuelve el stock completo.
export async function saveInventario(recursos) {
  if (!USE_MOCK_API) {
    return apiRequest('/inventario', { method: 'PUT', body: { recursos } });
  }

  await new Promise((resolve) => {
    setTimeout(resolve, MOCK_LATENCY_MS);
  });
  const stock = readMockStock();
  recursos.forEach(({ recursoCodigo, cantidadTotal }) => {
    stock[recursoCodigo] = cantidadTotal;
  });
  localStorage.setItem(MOCK_INVENTARIO_KEY, JSON.stringify(stock));
  return mockStockToList(stock);
}
