import { isUuid } from '../errors.js';

const NIVELES = ['PLENO', 'PARCIAL', 'APOYO', 'SIN_CAPACIDAD'];
const ROLES = ['principal', 'apoyo'];
const RIESGOS = ['baja', 'media', 'alta', 'critica'];

// Valida el body de `POST /api/internal/emergencies/:id/validaciones`, que es la
// respuesta de `POST /validaciones` del SN. Devuelve un objeto de errores por campo.
export function validateValidacionesPayload(body) {
  const errors = {};

  if (!body || !Array.isArray(body.resultados)) {
    return { resultados: 'resultados debe ser un array (puede ser vacío).' };
  }

  body.resultados.forEach((resultado, index) => {
    const prefix = `resultados[${index}]`;
    if (!resultado || typeof resultado !== 'object') {
      errors[prefix] = 'Formato inválido.';
      return;
    }
    if (!isUuid(resultado.ofertaId)) errors[`${prefix}.ofertaId`] = 'Debe ser un UUID.';
    if (!NIVELES.includes(resultado.nivelHabilitacion)) {
      errors[`${prefix}.nivelHabilitacion`] = `Debe ser uno de: ${NIVELES.join(', ')}.`;
    }
    if (!ROLES.includes(resultado.rolSugerido)) {
      errors[`${prefix}.rolSugerido`] = `Debe ser uno de: ${ROLES.join(', ')}.`;
    }
    if (!RIESGOS.includes(resultado.nivelRiesgoPermitido)) {
      errors[`${prefix}.nivelRiesgoPermitido`] = `Debe ser uno de: ${RIESGOS.join(', ')}.`;
    }
    if (
      resultado.capacidadesHabilitadas !== undefined &&
      !Array.isArray(resultado.capacidadesHabilitadas)
    ) {
      errors[`${prefix}.capacidadesHabilitadas`] = 'Debe ser un array.';
    }
    if (resultado.observaciones !== undefined && !Array.isArray(resultado.observaciones)) {
      errors[`${prefix}.observaciones`] = 'Debe ser un array.';
    }
  });

  const { resumen } = body;
  if (!resumen || typeof resumen !== 'object') {
    errors.resumen = 'Falta el resumen de la validación.';
  } else {
    if (typeof resumen.todosLosLotesCubiertos !== 'boolean') {
      errors['resumen.todosLosLotesCubiertos'] = 'Debe ser un booleano.';
    }
    if (!Array.isArray(resumen.cobertura)) {
      errors['resumen.cobertura'] = 'Debe ser un array.';
    }
  }

  return errors;
}
