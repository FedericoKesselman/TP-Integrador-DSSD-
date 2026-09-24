// Re-exporta la validación compartida para que el resto del server la
// importe desde acá ('./validate-emergency.js') en vez de repetir la ruta
// relativa a web-app/shared/ en cada archivo. Fuente real:
// web-app/shared/emergency-validation.js (compartida con el cliente).
export {
  EMERGENCY_STATUS_VALUES,
  EMERGENCY_TYPE_VALUES,
  OFERTA_STATUS_VALUES,
  SEVERITY_VALUES,
  validateEmergencyPayload,
} from '../../shared/emergency-validation.js';
