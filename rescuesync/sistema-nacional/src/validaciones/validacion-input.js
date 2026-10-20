// Validación de forma del body de POST /validaciones (ver
// docs/api-contracts-sistema-nacional.md). Devuelve un objeto { campo: mensaje };
// vacío = válido. Mismo estilo que ongs/ong-validation.js. Que una ONG exista
// o tenga stock NO se valida acá: eso no rechaza el pedido, se refleja en el
// perfil de la oferta (nunca hay un rechazo binario).

import {
  esEnteroPositivo,
  esObjeto,
  esTexto,
  esUuid,
  validarOngsDeOferta,
} from '../validation-utils.js';

export { ROLES_EN_OFERTA } from '../validation-utils.js';

export const SEVERIDADES = ['baja', 'media', 'alta', 'critica'];

// Devuelve los lotes por id (para cruzar con los ítems de las ofertas) y los errores.
function validarLotes(lotes) {
  const errors = {};
  const lotesPorId = new Map();
  if (!Array.isArray(lotes) || lotes.length === 0) {
    errors.lotes = 'Tiene que ser una lista con al menos un lote.';
    return { errors, lotesPorId };
  }
  lotes.forEach((lote, index) => {
    const prefix = `lotes[${index}]`;
    if (!esObjeto(lote)) {
      errors[prefix] = 'Tiene que ser un objeto { id, recursoCodigo, cantidadSolicitada }.';
      return;
    }
    if (!esUuid(lote.id)) {
      errors[`${prefix}.id`] = 'Tiene que ser un UUID.';
    } else if (lotesPorId.has(lote.id)) {
      errors[`${prefix}.id`] = 'Está repetido.';
    } else {
      lotesPorId.set(lote.id, lote);
    }
    if (!esTexto(lote.recursoCodigo)) {
      errors[`${prefix}.recursoCodigo`] = 'Falta el código de recurso.';
    }
    if (!esEnteroPositivo(lote.cantidadSolicitada)) {
      errors[`${prefix}.cantidadSolicitada`] = 'Tiene que ser un entero mayor a 0.';
    }
  });
  return { errors, lotesPorId };
}

function validarItemsDeOferta(items, prefix, lotesPorId) {
  const errors = {};
  if (!Array.isArray(items) || items.length === 0) {
    errors[`${prefix}.items`] = 'Tiene que ser una lista con al menos un ítem.';
    return errors;
  }
  const lotesVistos = new Set();
  items.forEach((item, index) => {
    const campo = `${prefix}.items[${index}]`;
    if (!esObjeto(item)) {
      errors[campo] = 'Tiene que ser un objeto { loteId, recursoCodigo, cantidadOfrecida }.';
      return;
    }
    const lote = lotesPorId.get(item.loteId);
    if (!lote) {
      errors[`${campo}.loteId`] = 'No coincide con ningún lote del pedido.';
    } else if (lotesVistos.has(item.loteId)) {
      errors[`${campo}.loteId`] = 'La oferta ya tiene un ítem para este lote.';
    } else {
      lotesVistos.add(item.loteId);
      if (item.recursoCodigo !== lote.recursoCodigo) {
        errors[`${campo}.recursoCodigo`] =
          `No coincide con el recurso del lote ("${lote.recursoCodigo}").`;
      }
    }
    if (!esEnteroPositivo(item.cantidadOfrecida)) {
      errors[`${campo}.cantidadOfrecida`] = 'Tiene que ser un entero mayor a 0.';
    }
  });
  return errors;
}

function validarOferta(oferta, index, lotesPorId, ofertaIdsVistos) {
  const prefix = `ofertas[${index}]`;
  if (!esObjeto(oferta)) {
    return { [prefix]: 'Tiene que ser un objeto { ofertaId, ongs, items }.' };
  }
  const errors = {};
  if (!esUuid(oferta.ofertaId)) {
    errors[`${prefix}.ofertaId`] = 'Tiene que ser un UUID.';
  } else if (ofertaIdsVistos.has(oferta.ofertaId)) {
    errors[`${prefix}.ofertaId`] = 'Está repetido.';
  } else {
    ofertaIdsVistos.add(oferta.ofertaId);
  }
  return {
    ...errors,
    ...validarOngsDeOferta(oferta.ongs, prefix),
    ...validarItemsDeOferta(oferta.items, prefix, lotesPorId),
  };
}

export function validateValidacionRequest(body) {
  if (!esObjeto(body)) {
    return { body: 'Se esperaba un objeto JSON.' };
  }
  const errors = {};
  if (!esUuid(body.emergenciaId)) {
    errors.emergenciaId = 'Tiene que ser un UUID.';
  }
  if (!SEVERIDADES.includes(body.severidad)) {
    errors.severidad = `Tiene que ser una de: ${SEVERIDADES.join(', ')}.`;
  }

  const { errors: erroresLotes, lotesPorId } = validarLotes(body.lotes);
  Object.assign(errors, erroresLotes);

  if (!Array.isArray(body.ofertas)) {
    errors.ofertas = 'Tiene que ser una lista (puede estar vacía).';
  } else {
    const ofertaIdsVistos = new Set();
    body.ofertas.forEach((oferta, index) => {
      Object.assign(errors, validarOferta(oferta, index, lotesPorId, ofertaIdsVistos));
    });
  }
  return errors;
}
