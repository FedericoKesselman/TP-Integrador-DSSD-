// Errores uniformes del SN: toda respuesta de error es `{ "message": "..." }`
// (más `detalle` opcional, ej. el 409 de stock insuficiente) con el código
// HTTP correcto. Las rutas lanzan HttpError y el handler de abajo responde.

export class HttpError extends Error {
  constructor(status, message, detalle) {
    super(message);
    this.status = status;
    this.detalle = detalle;
  }
}

export const badRequest = (message, detalle) => new HttpError(400, message, detalle);
export const unauthorized = (message = 'Token ausente o inválido.') => new HttpError(401, message);
export const forbidden = (message = 'No tenés permisos para esta operación.') =>
  new HttpError(403, message);
export const notFound = (message = 'Recurso no encontrado.') => new HttpError(404, message);
export const conflict = (message, detalle) => new HttpError(409, message, detalle);

// Envuelve un handler async para que los errores lleguen al error handler
// de Express 4 (que no captura promesas rechazadas por sí solo).
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `No existe ${req.method} ${req.path}.` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  if (error instanceof HttpError) {
    const body = { message: error.message };
    if (error.detalle !== undefined) body.detalle = error.detalle;
    return res.status(error.status).json(body);
  }
  // JSON mal formado o body demasiado grande (lo detecta express.json).
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El body no es un JSON válido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'El body supera el tamaño máximo permitido.' });
  }
  console.error(error);
  return res.status(500).json({ message: 'Error interno del Sistema Nacional.' });
}
