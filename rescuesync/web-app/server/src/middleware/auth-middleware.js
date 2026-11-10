import { timingSafeEqual } from 'node:crypto';

export function requireSession(req, res, next) {
  if (!req.session?.username) {
    return res.status(401).json({ message: 'Debés iniciar sesión.' });
  }

  return next();
}

export function requireRole(expectedRole) {
  return (req, res, next) => {
    if (req.session.role !== expectedRole) {
      return res.status(403).json({ message: 'No tenés permisos para realizar esta acción.' });
    }

    return next();
  };
}

// Autenticación de Bonita contra /api/internal/*: una sola clave compartida en
// el header `X-Integration-Key` (en Bonita es un parámetro del proceso).
export function requireIntegrationKey(req, res, next) {
  const key = process.env.BONITA_INTEGRATION_KEY;
  if (!key)
    return res.status(503).json({ message: 'La clave de integración no está configurada.' });

  const expected = Buffer.from(key);
  const received = Buffer.from(req.get('X-Integration-Key') || '');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return res.status(401).json({ message: 'Clave de integración inválida.' });
  }

  return next();
}
