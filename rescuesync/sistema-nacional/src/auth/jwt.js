import jwt from 'jsonwebtoken';

import config from '../config.js';

const ALGORITHM = 'HS256';

// Claims del contrato: iss, sub (username), aud, exp, role y, para las
// cuentas de ONG, ongRef.
export function signAccessToken({ username, role, ongRef }) {
  const payload = { role };
  if (ongRef) payload.ongRef = ongRef;
  return jwt.sign(payload, config.jwt.secret, {
    algorithm: ALGORITHM,
    subject: username,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: config.jwt.expiresIn,
  });
}

// Lanza si la firma, el emisor, la audiencia o el vencimiento no cierran.
// `algorithms` fijo evita que un token firmado con otro algoritmo se acepte.
export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    algorithms: [ALGORITHM],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}
