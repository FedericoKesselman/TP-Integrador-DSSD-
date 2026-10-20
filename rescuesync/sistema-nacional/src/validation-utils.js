// Piezas de validación de forma que comparten /validaciones y /compromisos
// (las dos reciben ofertas con el mismo bloque `ongs`). Cada validador
// devuelve un objeto { campo: mensaje }; vacío = válido.

import { REF_PATTERN } from './ongs/ong-validation.js';

export const ROLES_EN_OFERTA = ['principal', 'apoyo'];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esObjeto = (valor) =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor);
export const esUuid = (valor) => typeof valor === 'string' && UUID_PATTERN.test(valor);
export const esTexto = (valor) => typeof valor === 'string' && valor.trim().length > 0;
export const esEnteroPositivo = (valor) => Number.isInteger(valor) && valor > 0;

// `ongs` de una oferta: lista no vacía de { ref, rol } sin refs repetidos.
export function validarOngsDeOferta(ongs, prefix) {
  const errors = {};
  if (!Array.isArray(ongs) || ongs.length === 0) {
    errors[`${prefix}.ongs`] = 'Tiene que ser una lista con al menos una ONG.';
    return errors;
  }
  const refsVistos = new Set();
  ongs.forEach((ong, index) => {
    const campo = `${prefix}.ongs[${index}]`;
    if (!esObjeto(ong)) {
      errors[campo] = 'Tiene que ser un objeto { ref, rol }.';
      return;
    }
    if (typeof ong.ref !== 'string' || !REF_PATTERN.test(ong.ref)) {
      errors[`${campo}.ref`] = 'Slug en minúsculas con guiones, ej. "rescatistas-unidos".';
    } else if (refsVistos.has(ong.ref)) {
      errors[`${campo}.ref`] = 'Está repetido en la oferta.';
    } else {
      refsVistos.add(ong.ref);
    }
    if (!ROLES_EN_OFERTA.includes(ong.rol)) {
      errors[`${campo}.rol`] = `Tiene que ser uno de: ${ROLES_EN_OFERTA.join(', ')}.`;
    }
  });
  return errors;
}
