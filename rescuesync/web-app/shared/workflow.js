// Constantes del ciclo de una emergencia, compartidas entre client y server.
// Fuente única: si cambia un estado, una transición o un tipo de aviso,
// se edita acá y en docs/api-contracts.md (secciones "Estados" y "Avisos").

export const EMERGENCY_STATES = [
  'registrada',
  'convocatoria_abierta',
  'convocatoria_cerrada',
  'validada',
  'adjudicada',
  'en_ejecucion',
  'finalizada',
];

export const OFERTA_STATES = [
  'registrada',
  'retirada',
  'validada',
  'adjudicada',
  'no_seleccionada',
  'finalizada',
];

// Whitelist de transiciones de una emergencia (desde → hacia[]).
export const EMERGENCY_TRANSITIONS = {
  registrada: ['convocatoria_abierta'],
  convocatoria_abierta: ['convocatoria_cerrada'],
  convocatoria_cerrada: ['validada'],
  validada: ['convocatoria_abierta', 'registrada', 'adjudicada'],
  adjudicada: ['en_ejecucion'],
  en_ejecucion: ['finalizada'],
  finalizada: [],
};

export function canTransition(from, to) {
  return (EMERGENCY_TRANSITIONS[from] ?? []).includes(to);
}

// Estados que Bonita puede pedir por `PATCH /api/internal/emergencies/:id/estado`.
// Los demás cambios tienen su propio endpoint porque mueven datos
// (validaciones, compromiso-confirmado, decision, convocatoria).
export const BONITA_PATCHABLE_STATES = ['convocatoria_cerrada', 'en_ejecucion', 'finalizada'];

// Tipos de aviso que ve la ONG en su bandeja.
export const NOTIFICATION_TYPES = [
  'CONVOCATORIA',
  'CIERRE_CONVOCATORIA',
  'OFERTA_RETIRADA',
  'ADJUDICADA',
  'NO_SELECCIONADA',
];

// Tipos que Bonita puede pedir en `POST /api/internal/emergencies/:id/notificaciones`.
// OFERTA_RETIRADA la emite la web-app sola al reformular; ADJUDICADA y
// NO_SELECCIONADA salen del tipo COMPROMISO.
export const BONITA_NOTIFICATION_TYPES = ['CONVOCATORIA', 'CIERRE_CONVOCATORIA', 'COMPROMISO'];

export const DECISION_CAMINOS = ['continuar', 'reabrir', 'reformular'];

// Duración de la ventana de ofertas (minutos). Con 2 minutos se hace la demo.
export const CONVOCATORIA_DURACION = { defaultMin: 120, minMin: 1, maxMin: 10080 };

// Devuelve un mensaje de error, o null si la duración es válida.
export function validateDuracionMinutos(value) {
  const { minMin, maxMin } = CONVOCATORIA_DURACION;
  if (!Number.isInteger(value)) return 'La duración debe ser un número entero de minutos.';
  if (value < minMin || value > maxMin) {
    return `La duración debe estar entre ${minMin} y ${maxMin} minutos.`;
  }
  return null;
}
