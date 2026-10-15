// Validaciones de forma de los bodies de /ongs (ver
// docs/api-contracts-sistema-nacional.md). Devuelven un objeto
// { campo: mensaje }; vacío = válido. Que un recursoCodigo exista en el
// catálogo se verifica después contra la base.

export const REF_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_TEXT_LENGTH = 120;

const isNonEmptyString = (value, max = MAX_TEXT_LENGTH) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

// [{ recursoCodigo, cantidadTotal }] sin códigos repetidos.
export function validateStockItems(items, field = 'recursos') {
  if (!Array.isArray(items)) {
    return { [field]: 'Tiene que ser una lista de { recursoCodigo, cantidadTotal }.' };
  }
  const errors = {};
  const seen = new Set();
  items.forEach((item, index) => {
    const prefix = `${field}[${index}]`;
    if (!item || typeof item !== 'object') {
      errors[prefix] = 'Tiene que ser un objeto { recursoCodigo, cantidadTotal }.';
      return;
    }
    if (!isNonEmptyString(item.recursoCodigo)) {
      errors[`${prefix}.recursoCodigo`] = 'Falta el código de recurso.';
    } else if (seen.has(item.recursoCodigo)) {
      errors[`${prefix}.recursoCodigo`] = `"${item.recursoCodigo}" está repetido.`;
    } else {
      seen.add(item.recursoCodigo);
    }
    if (!Number.isInteger(item.cantidadTotal) || item.cantidadTotal < 0) {
      errors[`${prefix}.cantidadTotal`] = 'Tiene que ser un entero mayor o igual a 0.';
    }
  });
  return errors;
}

export function validateOngAlta(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { body: 'Se esperaba un objeto JSON.' };
  }
  const errors = {};
  if (typeof body.ref !== 'string' || !REF_PATTERN.test(body.ref) || body.ref.length > 60) {
    errors.ref = 'Slug en minúsculas con guiones, ej. "rescatistas-unidos".';
  }
  if (!isNonEmptyString(body.nombre)) {
    errors.nombre = 'Falta el nombre de la ONG.';
  }
  if (
    !Number.isInteger(body.nivelOperativo) ||
    body.nivelOperativo < 1 ||
    body.nivelOperativo > 4
  ) {
    errors.nivelOperativo = 'Tiene que ser un entero de 1 a 4.';
  }
  if (!isNonEmptyString(body.username, 60)) {
    errors.username = 'Falta el username de la cuenta de la ONG.';
  }
  if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (body.recursos !== undefined) {
    Object.assign(errors, validateStockItems(body.recursos));
  }
  return errors;
}
