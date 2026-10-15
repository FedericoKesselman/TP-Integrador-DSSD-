import { verifyAccessToken } from '../auth/jwt.js';
import { forbidden, unauthorized } from '../errors.js';

// Exige `Authorization: Bearer <JWT>` válido y deja los datos del token en
// `req.auth` ({ username, role, ongRef }).
export function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Falta el header Authorization: Bearer <token>.'));
  }
  try {
    const claims = verifyAccessToken(token);
    req.auth = { username: claims.sub, role: claims.role, ongRef: claims.ongRef ?? null };
    return next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError' ? 'El token venció; volvé a hacer login.' : undefined;
    return next(unauthorized(message));
  }
}

// Usar después de requireAuth. Acepta uno o varios roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth?.role)) {
      return next(forbidden());
    }
    return next();
  };
}

// Para rutas `/ongs/:ref/...` que puede usar la integración o la propia ONG
// (ej. GET /ongs/:ref/recursos): una ONG solo ve lo suyo.
export function requireIntegracionOrOwnOng(req, res, next) {
  const { role, ongRef } = req.auth || {};
  if (role === 'integracion' || (role === 'ong' && ongRef === req.params.ref)) {
    return next();
  }
  return next(forbidden());
}
