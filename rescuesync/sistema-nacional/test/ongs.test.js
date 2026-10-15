import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import app from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import pool from '../src/db.js';
import { validateOngAlta, validateStockItems } from '../src/ongs/ong-validation.js';

// Tests de integración de E3-20: necesitan el Postgres del SN levantado
// (`docker compose up` en sistema-nacional/). Si no responde, se saltean.
// Cada corrida usa refs únicos y los borra al final.

const suffix = Math.random().toString(36).slice(2, 8);
const refA = `test-a-${suffix}`;
const refB = `test-b-${suffix}`;

let dbAvailable = true;
try {
  await pool.query('SELECT 1');
} catch {
  dbAvailable = false;
}

describe('validaciones de /ongs', () => {
  it('acepta un alta válida', () => {
    const errors = validateOngAlta({
      ref: 'cruz-roja',
      nombre: 'Cruz Roja',
      nivelOperativo: 4,
      username: 'cruz-roja',
      password: '12345678',
      recursos: [{ recursoCodigo: 'paramedicos', cantidadTotal: 0 }],
    });
    assert.deepEqual(errors, {});
  });

  it('marca cada campo inválido', () => {
    const errors = validateOngAlta({ ref: 'Con Espacios', nivelOperativo: 5, password: '1' });
    assert.deepEqual(Object.keys(errors).sort(), [
      'nivelOperativo',
      'nombre',
      'password',
      'ref',
      'username',
    ]);
  });

  it('rechaza recursos repetidos o con cantidades negativas', () => {
    const errors = validateStockItems([
      { recursoCodigo: 'botes', cantidadTotal: -1 },
      { recursoCodigo: 'botes', cantidadTotal: 1 },
    ]);
    assert.ok(errors['recursos[0].cantidadTotal']);
    assert.ok(errors['recursos[1].recursoCodigo']);
  });
});

describe(
  'endpoints de ONGs y recursos',
  { skip: !dbAvailable && 'Postgres del SN no disponible' },
  () => {
    let server;
    let baseUrl;
    const integracion = signAccessToken({ username: 'test-integracion', role: 'integracion' });
    const ongA = signAccessToken({ username: refA, role: 'ong', ongRef: refA });

    const call = async (method, path, token, body) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };

    const alta = (ref, extra = {}) => ({
      ref,
      nombre: `ONG ${ref}`,
      nivelOperativo: 2,
      username: ref,
      password: 'clave-de-prueba',
      ...extra,
    });

    before(async () => {
      server = app.listen(0);
      baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
      await pool.query('DELETE FROM ongs WHERE ref = ANY($1)', [[refA, refB]]);
      server.close();
      await pool.end();
    });

    it('401 sin token', async () => {
      assert.equal((await call('GET', '/ongs')).status, 401);
    });

    it('crea la ONG con su cuenta y stock inicial', async () => {
      const res = await call(
        'POST',
        '/ongs',
        integracion,
        alta(refA, { recursos: [{ recursoCodigo: 'paramedicos', cantidadTotal: 5 }] }),
      );
      assert.equal(res.status, 201);
      assert.equal(res.body.habilitada, true);
      assert.equal(res.body.recursos[0].cantidadDisponible, 5);

      const login = await call('POST', '/auth/login', null, {
        username: refA,
        password: 'clave-de-prueba',
      });
      assert.equal(login.status, 200);
    });

    it('409 con ref repetido y no deja nada a medio crear con username repetido', async () => {
      assert.equal((await call('POST', '/ongs', integracion, alta(refA))).status, 409);
      const res = await call('POST', '/ongs', integracion, alta(refB, { username: refA }));
      assert.equal(res.status, 409);
      const { rowCount } = await pool.query('SELECT 1 FROM ongs WHERE ref = $1', [refB]);
      assert.equal(rowCount, 0);
    });

    it('400 con un recurso que no está en el catálogo', async () => {
      const res = await call(
        'POST',
        '/ongs',
        integracion,
        alta(refB, { recursos: [{ recursoCodigo: 'unicornios', cantidadTotal: 1 }] }),
      );
      assert.equal(res.status, 400);
      assert.deepEqual(res.body.detalle.recursosDesconocidos, ['unicornios']);
    });

    it('solo la integración da de alta ONGs y cambia stock', async () => {
      assert.equal((await call('POST', '/ongs', ongA, alta(refB))).status, 403);
      assert.equal((await call('PUT', `/ongs/${refA}/recursos`, ongA, [])).status, 403);
    });

    it('una ONG ve su stock pero no el de otra', async () => {
      await call('POST', '/ongs', integracion, alta(refB));
      assert.equal((await call('GET', `/ongs/${refA}/recursos`, ongA)).status, 200);
      assert.equal((await call('GET', `/ongs/${refB}/recursos`, ongA)).status, 403);
    });

    it('PUT actualiza el stock y no lo deja por debajo de lo comprometido', async () => {
      const ok = await call('PUT', `/ongs/${refA}/recursos`, integracion, [
        { recursoCodigo: 'paramedicos', cantidadTotal: 8 },
        { recursoCodigo: 'raciones', cantidadTotal: 100 },
      ]);
      assert.equal(ok.status, 200);
      assert.equal(ok.body.length, 2);

      await pool.query(
        `UPDATE ong_recursos SET cantidad_comprometida = 6
        WHERE recurso_codigo = 'paramedicos'
          AND ong_id = (SELECT id FROM ongs WHERE ref = $1)`,
        [refA],
      );
      const conflict = await call('PUT', `/ongs/${refA}/recursos`, integracion, [
        { recursoCodigo: 'paramedicos', cantidadTotal: 5 },
      ]);
      assert.equal(conflict.status, 409);
      assert.equal(conflict.body.detalle.insuficientes[0].cantidadComprometida, 6);
    });

    it('404 al cargar stock de una ONG que no existe', async () => {
      const res = await call('PUT', `/ongs/no-existe-${suffix}/recursos`, integracion, []);
      assert.equal(res.status, 404);
    });

    it('GET /ongs y la disponibilidad global incluyen las ONGs nuevas', async () => {
      const ongs = await call('GET', '/ongs', ongA);
      assert.ok(ongs.body.some((ong) => ong.ref === refA));

      const disponibilidad = await call('GET', '/recursos/disponibilidad', ongA);
      assert.equal(disponibilidad.status, 200);
      const paramedicos = disponibilidad.body.find((r) => r.recursoCodigo === 'paramedicos');
      assert.ok(paramedicos.cantidadComprometida >= 6);
      assert.equal(
        paramedicos.cantidadDisponible,
        paramedicos.cantidadTotal - paramedicos.cantidadComprometida,
      );
    });
  },
);
