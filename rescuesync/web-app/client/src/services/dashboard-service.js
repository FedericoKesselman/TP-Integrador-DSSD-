import { apiRequest } from './api-client.js';

// Sin modo mock: el dashboard necesita el backend real (y a Bonita para los tiempos).
function periodoQuery({ desde, hasta } = {}) {
  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  const query = params.toString();
  return query ? `?${query}` : '';
}

// GET /api/dashboard/indicadores — solo Postgres.
export function getIndicadores(periodo) {
  return apiRequest(`/dashboard/indicadores${periodoQuery(periodo)}`);
}

// GET /api/dashboard/tiempos-etapas — consulta a Bonita (puede fallar con 401/502).
export function getTiemposEtapas(periodo) {
  return apiRequest(`/dashboard/tiempos-etapas${periodoQuery(periodo)}`);
}

// URL de descarga: se navega con <a href download>, misma origin, las cookies viajan solas.
export function buildExportUrl({ formato, dataset, desde, hasta }) {
  const params = new URLSearchParams({ formato });
  if (dataset) params.set('dataset', dataset);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  return `/api/dashboard/export?${params.toString()}`;
}
