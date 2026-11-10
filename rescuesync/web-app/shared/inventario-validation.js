// Validación compartida del stock de una ONG (PUT /api/inventario).

export function validateInventarioPayload(payload) {
  if (!payload || !Array.isArray(payload.recursos) || payload.recursos.length === 0) {
    return { recursos: 'Indicá al menos un recurso.' };
  }

  const itemsErrors = [];
  let hasErrors = false;

  payload.recursos.forEach((item, index) => {
    const errors = {};
    if (!item || typeof item.recursoCodigo !== 'string' || !item.recursoCodigo.trim()) {
      errors.recursoCodigo = 'El recurso es obligatorio.';
    }
    if (!Number.isInteger(item?.cantidadTotal) || item.cantidadTotal < 0) {
      errors.cantidadTotal = 'El total debe ser un número entero mayor o igual a 0.';
    }
    if (Object.keys(errors).length > 0) {
      hasErrors = true;
      itemsErrors[index] = errors;
    }
  });

  return hasErrors ? { items: itemsErrors } : {};
}
