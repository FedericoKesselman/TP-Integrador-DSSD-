// Error de dominio: lleva el código HTTP con el que la ruta debe responder.
export function createDomainError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// Respuesta estándar de las rutas: usa el `status` del error de dominio o
// cae en un 500 con el mensaje genérico.
export function sendError(res, error, fallbackMessage) {
  if (error.status) {
    const body = { message: error.message };
    if (error.detalle !== undefined) body.detalle = error.detalle;
    return res.status(error.status).json(body);
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}
