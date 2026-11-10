// Re-exporta las constantes compartidas del ciclo de emergencias para el server.
export {
  BONITA_NOTIFICATION_TYPES,
  BONITA_PATCHABLE_STATES,
  CONVOCATORIA_DURACION,
  DECISION_CAMINOS,
  EMERGENCY_STATES,
  EMERGENCY_TRANSITIONS,
  NOTIFICATION_TYPES,
  OFERTA_STATES,
  canTransition,
  validateDuracionMinutos,
} from '../../shared/workflow.js';
