// Validaciones compartidas para ofertas de ONGs (cliente y servidor).
// Valida la forma del payload que viaja por la API; las reglas que dependen
// de la base (estado de la emergencia, pertenencia del lote, permisos) se
// resuelven en el backend.

export const OFFER_OBSERVATIONS_MAX_LENGTH = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateOfertaItem(item) {
  const errors = {};

  if (!item || typeof item !== 'object') {
    return { general: 'El recurso ofertado no tiene un formato válido.' };
  }

  if (!item.loteId || typeof item.loteId !== 'string' || !item.loteId.trim()) {
    errors.loteId = 'El lote es obligatorio.';
  } else if (!UUID_PATTERN.test(item.loteId.trim())) {
    errors.loteId = 'El lote debe tener un id válido.';
  }

  const quantity = Number(item.quantityOffered);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    errors.quantityOffered = 'La cantidad ofrecida debe ser un número entero mayor a 0.';
  }

  if (item.notes !== null && item.notes !== undefined && typeof item.notes !== 'string') {
    errors.notes = 'La nota debe ser un texto.';
  }

  return errors;
}

export function validateOfertaPayload(payload) {
  const errors = {};

  if (!payload || typeof payload !== 'object') {
    return { general: 'La oferta no tiene un formato válido.' };
  }

  if (payload.observations !== null && payload.observations !== undefined) {
    if (typeof payload.observations !== 'string') {
      errors.observations = 'Las observaciones deben ser un texto.';
    } else if (payload.observations.trim().length > OFFER_OBSERVATIONS_MAX_LENGTH) {
      errors.observations = `Las observaciones pueden tener como máximo ${OFFER_OBSERVATIONS_MAX_LENGTH} caracteres.`;
    }
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.items = 'Debe ofertar al menos un recurso.';
    return errors;
  }

  const itemsErrors = [];
  let hasItemErrors = false;
  const loteIds = new Set();

  payload.items.forEach((item, index) => {
    const itemErrors = validateOfertaItem(item);

    const loteId = typeof item?.loteId === 'string' ? item.loteId.trim() : null;
    if (loteId && loteIds.has(loteId)) {
      itemErrors.loteId = 'El mismo lote no puede aparecer más de una vez.';
    }
    if (loteId) loteIds.add(loteId);

    if (Object.keys(itemErrors).length > 0) {
      hasItemErrors = true;
      itemsErrors[index] = itemErrors;
    }
  });

  if (hasItemErrors) {
    errors.items = itemsErrors;
  }

  return errors;
}
