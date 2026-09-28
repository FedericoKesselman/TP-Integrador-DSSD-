// Validaciones compartidas para lotes de emergencias (cliente y servidor).

export function validateLoteItem(lote) {
  const errors = {};

  if (!lote || typeof lote !== 'object') {
    return { general: 'El lote no tiene un formato válido.' };
  }

  if (!lote.resourceType || typeof lote.resourceType !== 'string' || !lote.resourceType.trim()) {
    errors.resourceType = 'El tipo de recurso es obligatorio.';
  }

  const quantity = Number(lote.quantityRequested);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    errors.quantityRequested = 'La cantidad debe ser un número entero mayor a 0.';
  }

  return errors;
}

export function validateLotesPayload(payload) {
  if (!payload || !Array.isArray(payload.lotes) || payload.lotes.length === 0) {
    return { lotes: 'Debe ingresar al menos un lote de recursos.' };
  }

  const itemsErrors = [];
  let hasErrors = false;

  payload.lotes.forEach((lote, index) => {
    const err = validateLoteItem(lote);
    if (Object.keys(err).length > 0) {
      hasErrors = true;
      itemsErrors[index] = err;
    }
  });

  if (hasErrors) {
    return { items: itemsErrors };
  }

  return {};
}
