import { apiRequest } from './api-client.js';

// Pasos del ciclo que dependen de Bonita y del Sistema Nacional (validación,
// decisión, adjudicación, ejecución). No tienen modo mock: hace falta el backend
// real (VITE_USE_MOCK_API=false). Contratos: docs/api-contracts.md → "Entrega 5".

// GET /api/emergencies/:id — incluye duracionConvocatoriaMin y ultimoConflictoCompromiso
export function getEmergencyDetail(emergencyId) {
  return apiRequest(`/emergencies/${emergencyId}`);
}

// GET /api/emergencies/:id/ofertas (coordinador) — { status, todosLosLotesCubiertos, lotes, ofertas }
export function getOfertasConValidacion(emergencyId) {
  return apiRequest(`/emergencies/${emergencyId}/ofertas`);
}

// GET /api/emergencies/:id/ofertas/validadas (municipio) — mismo shape, solo `validada`
export function getOfertasValidadas(emergencyId) {
  return apiRequest(`/emergencies/${emergencyId}/ofertas/validadas`);
}

// POST /api/emergencies/:id/decision — camino: continuar | reabrir | reformular
export function decidirContinuacion(emergencyId, camino, duracionMinutos = undefined) {
  return apiRequest(`/emergencies/${emergencyId}/decision`, {
    method: 'POST',
    body: camino === 'reabrir' ? { camino, duracionMinutos } : { camino },
  });
}

// POST /api/emergencies/:id/adjudicacion — { ofertaIds }
export function adjudicarOfertas(emergencyId, ofertaIds) {
  return apiRequest(`/emergencies/${emergencyId}/adjudicacion`, {
    method: 'POST',
    body: { ofertaIds },
  });
}

// POST /api/emergencies/:id/cierre-ejecucion
export function confirmarCierreEjecucion(emergencyId) {
  return apiRequest(`/emergencies/${emergencyId}/cierre-ejecucion`, { method: 'POST' });
}

// POST /api/ofertas/:id/finalizar (ONG)
export function finalizarOferta(ofertaId) {
  return apiRequest(`/ofertas/${ofertaId}/finalizar`, { method: 'POST' });
}
