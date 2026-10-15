import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import jwt from 'jsonwebtoken';

import { signAccessToken, verifyAccessToken } from '../src/auth/jwt.js';
import config from '../src/config.js';
import {
  requireAuth,
  requireIntegracionOrOwnOng,
  requireRole,
} from '../src/middleware/auth-middleware.js';

// Corre un middleware con un req armado a mano y devuelve el error que le
// pasó a next() (undefined si dejó seguir).
function run(middleware, req) {
  let received;
  middleware(req, {}, (error) => {
    received = error;
  });
  return received;
}

const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });

describe('JWT', () => {
  it('firma con los claims del contrato', () => {
    const claims = verifyAccessToken(signAccessToken({ username: 'bonita', role: 'integracion' }));
    assert.equal(claims.sub, 'bonita');
    assert.equal(claims.role, 'integracion');
    assert.equal(claims.iss, config.jwt.issuer);
    assert.equal(claims.aud, config.jwt.audience);
    assert.equal(claims.exp - claims.iat, config.jwt.expiresIn);
    assert.equal(claims.ongRef, undefined);
  });

  it('incluye ongRef en las cuentas de ONG', () => {
    const token = signAccessToken({ username: 'ru', role: 'ong', ongRef: 'rescatistas-unidos' });
    assert.equal(verifyAccessToken(token).ongRef, 'rescatistas-unidos');
  });

  it('rechaza un token firmado con otro secreto', () => {
    const forged = jwt.sign({ role: 'integracion' }, 'otro-secreto-de-mas-de-32-caracteres!!', {
      subject: 'x',
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
    assert.throws(() => verifyAccessToken(forged));
  });
});

describe('requireAuth', () => {
  it('401 sin header Authorization', () => {
    assert.equal(run(requireAuth, { headers: {} }).status, 401);
  });

  it('401 con un token inválido', () => {
    assert.equal(run(requireAuth, bearer('no-es-un-jwt')).status, 401);
  });

  it('401 con un token vencido, avisando que venció', () => {
    const expired = jwt.sign({ role: 'integracion' }, config.jwt.secret, {
      subject: 'bonita',
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: -10,
    });
    const error = run(requireAuth, bearer(expired));
    assert.equal(error.status, 401);
    assert.match(error.message, /venció/);
  });

  it('deja seguir y carga req.auth con un token válido', () => {
    const req = bearer(signAccessToken({ username: 'ru', role: 'ong', ongRef: 'ru-ref' }));
    assert.equal(run(requireAuth, req), undefined);
    assert.deepEqual(req.auth, { username: 'ru', role: 'ong', ongRef: 'ru-ref' });
  });
});

describe('requireRole / requireIntegracionOrOwnOng', () => {
  const integracion = { auth: { role: 'integracion' }, params: { ref: 'a' } };
  const ongA = { auth: { role: 'ong', ongRef: 'a' }, params: { ref: 'a' } };
  const ongB = { auth: { role: 'ong', ongRef: 'b' }, params: { ref: 'a' } };

  it('403 si el rol no está permitido', () => {
    assert.equal(run(requireRole('integracion'), ongA).status, 403);
    assert.equal(run(requireRole('integracion'), integracion), undefined);
  });

  it('una ONG solo accede a su propio ref', () => {
    assert.equal(run(requireIntegracionOrOwnOng, integracion), undefined);
    assert.equal(run(requireIntegracionOrOwnOng, ongA), undefined);
    assert.equal(run(requireIntegracionOrOwnOng, ongB).status, 403);
  });
});
