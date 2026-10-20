// Validación de forma del body de POST /compromisos (ver
// docs/api-contracts-sistema-nacional.md). Devuelve un objeto { campo: mensaje };
// vacío = válido. Que las ONGs existan o tengan stock NO se valida acá: eso es
// un 409 con el detalle de qué falta.

import {
  esEnteroPositivo,
  esObjeto,
  esTexto,
  esUuid,
  validarOngsDeOferta,
} from '../validation-utils.js';

function validarItems(items, prefix) {
  const errors = {};
  if (!Array.isArray(items) || items.length === 0) {
    errors[`${prefix}.items`] = 'Tiene que ser una lista con al menos un ítem.';
    return errors;
  }
  items.forEach((item, index) => {
    const campo = `${prefix}.items[${index}]`;
    if (!esObjeto(item)) {
      errors[campo] = 'Tiene que ser un objeto { recursoCodigo, cantidad }.';
      return;
    }
    if (!esTexto(item.recursoCodigo)) {
      errors[`${campo}.recursoCodigo`] = 'Falta el código de recurso.';
    }
    if (!esEnteroPositivo(item.cantidad)) {
      errors[`${campo}.cantidad`] = 'Tiene que ser un entero mayor a 0.';
    }
  });
  return errors;
}

function validarOferta(oferta, index, ofertaIdsVistos) {
  const prefix = `ofertas[${index}]`;
  if (!esObjeto(oferta)) {
    return { [prefix]: 'Tiene que ser un objeto { ofertaId, ongs, items }.' };
  }
  const errors = {};
  const ofertaId = typeof oferta.ofertaId === 'string' ? oferta.ofertaId.toLowerCase() : null;
  if (!esUuid(oferta.ofertaId)) {
    errors[`${prefix}.ofertaId`] = 'Tiene que ser un UUID.';
  } else if (ofertaIdsVistos.has(ofertaId)) {
    errors[`${prefix}.ofertaId`] = 'Está repetido.';
  } else {
    ofertaIdsVistos.add(ofertaId);
  }
  return {
    ...errors,
    ...validarOngsDeOferta(oferta.ongs, prefix),
    ...validarItems(oferta.items, prefix),
  };
}

export function validateCompromisoRequest(body) {
  if (!esObjeto(body)) {
    return { body: 'Se esperaba un objeto JSON.' };
  }
  const errors = {};
  if (!esUuid(body.emergenciaId)) {
    errors.emergenciaId = 'Tiene que ser un UUID.';
  }
  if (!Array.isArray(body.ofertas) || body.ofertas.length === 0) {
    errors.ofertas = 'Tiene que ser una lista con al menos una oferta.';
  } else {
    const ofertaIdsVistos = new Set();
    body.ofertas.forEach((oferta, index) => {
      Object.assign(errors, validarOferta(oferta, index, ofertaIdsVistos));
    });
  }
  return errors;
}
