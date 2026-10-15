import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import app from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import pool from '../src/db.js';

// Tests de integración de E3-23 (finalización y cierre). Necesitan el
// Postgres del SN (`docker compose up`). Los compromisos los crea la Pista B
// con POST /compromisos (E3-22); acá se insertan a mano para probar la
// liberación sin depender de ese endpoint.

let dbAvailable = true;
try {
  await pool.query('SELECT 1');
} catch {
  dbAvailable = false;
}

const suffix = Math.random().toString(36).slice(2, 8);
const refA = `test-cierre-a-${suffix}`;
const refB = `test-cierre-b-${suffix}`;

async function crearOng(ref, stock) {
  const { rows } = await pool.query(
    `INSERT INTO ongs (ref, nombre, nivel_operativo) VALUES ($1, $1, 3) RETURNING id`,
    [ref],
  );
  const ongId = rows[0].id;
  await pool.query(
    `INSERT INTO ong_recursos (ong_id, recurso_codigo, cantidad_total)
     SELECT $1, codigo, total FROM unnest($2::text[], $3::int[]) AS s (codigo, total)`,
    [ongId, Object.keys(stock), Object.values(stock)],
  );
  return ongId;
}

// Simula E3-22: un compromiso activo con su reparto, sumando a comprometida.
async function comprometer(emergenciaId, reparto) {
  const { rows } = await pool.query(
    `INSERT INTO compromisos (emergencia_id, oferta_id) VALUES ($1, $2) RETURNING id`,
    [emergenciaId, randomUUID()],
  );
  await Promise.all(
    reparto.map(({ ref, codigo, cantidad }) =>
      pool.query(
        `WITH r AS (
           UPDATE ong_recursos SET cantidad_comprometida = cantidad_comprometida + $3
            WHERE recurso_codigo = $2 AND ong_id = (SELECT id FROM ongs WHERE ref = $1)
           RETURNING id)
         INSERT INTO compromiso_items (compromiso_id, ong_recurso_id, cantidad)
         SELECT $4, id, $3 FROM r`,
        [ref, codigo, cantidad, rows[0].id],
      ),
    ),
  );
}

async function comprometida(ref, codigo) {
  const { rows } = await pool.query(
    `SELECT cantidad_comprometida FROM ong_recursos
      WHERE recurso_codigo = $2 AND ong_id = (SELECT id FROM ongs WHERE ref = $1)`,
    [ref, codigo],
  );
  return rows[0].cantidad_comprometida;
}

describe('finalización y cierre', { skip: !dbAvailable && 'Postgres del SN no disponible' }, () => {
  let server;
  let baseUrl;
  const integracion = signAccessToken({ username: 'test-integracion', role: 'integracion' });
  const ong = signAccessToken({ username: refA, role: 'ong', ongRef: refA });

  const call = async (method, path, token, body) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    await crearOng(refA, { paramedicos: 10, botes: 4 });
    await crearOng(refB, { paramedicos: 5 });
  });

  after(async () => {
    const ongs = await pool.query('SELECT id FROM ongs WHERE ref = ANY($1)', [[refA, refB]]);
    const ids = ongs.rows.map((row) => row.id);
    await pool.query(
      `DELETE FROM compromisos WHERE id IN (
         SELECT i.compromiso_id FROM compromiso_items i
           JOIN ong_recursos r ON r.id = i.ong_recurso_id
          WHERE r.ong_id = ANY($1::uuid[]))`,
      [ids],
    );
    await pool.query('DELETE FROM ongs WHERE id = ANY($1::uuid[])', [ids]);
    server.close();
    await pool.end();
  });

  it('solo la integración puede finalizar o cerrar', async () => {
    const id = randomUUID();
    assert.equal((await call('POST', `/emergencias/${id}/cierre`, ong)).status, 403);
    assert.equal(
      (await call('POST', `/emergencias/${id}/finalizacion`, ong, { ongRefs: [refA] })).status,
      403,
    );
  });

  it('400 con un emergenciaId que no es UUID o sin ongRefs', async () => {
    assert.equal((await call('POST', '/emergencias/123/cierre', integracion)).status, 400);
    const id = randomUUID();
    assert.equal(
      (await call('POST', `/emergencias/${id}/finalizacion`, integracion, { ongRefs: [] })).status,
      400,
    );
  });

  it('400 si alguna ONG no existe en el SN', async () => {
    const res = await call('POST', `/emergencias/${randomUUID()}/finalizacion`, integracion, {
      ongRefs: [refA, 'no-existe'],
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.detalle.ongRefsDesconocidas, ['no-existe']);
  });

  it('finalización registra ONGs (idempotente) e informa las pendientes', async () => {
    const id = randomUUID();
    await comprometer(id, [
      { ref: refA, codigo: 'paramedicos', cantidad: 2 },
      { ref: refB, codigo: 'paramedicos', cantidad: 1 },
    ]);
    const primera = await call('POST', `/emergencias/${id}/finalizacion`, integracion, {
      ongRefs: [refA],
    });
    assert.equal(primera.status, 200);
    assert.deepEqual(
      primera.body.finalizadas.map((f) => f.ongRef),
      [refA],
    );
    assert.deepEqual(primera.body.ongsSinFinalizar, [refB]);

    const repetida = await call('POST', `/emergencias/${id}/finalizacion`, integracion, {
      ongRefs: [refA, refA],
    });
    assert.equal(repetida.body.finalizadas.length, 1);
    assert.equal(
      repetida.body.finalizadas[0].finalizadaAt,
      primera.body.finalizadas[0].finalizadaAt,
    );
  });

  it('el cierre libera lo comprometido de esa emergencia y nada más', async () => {
    const id = randomUUID();
    const otra = randomUUID();
    const antes = await comprometida(refA, 'paramedicos');
    await comprometer(id, [
      { ref: refA, codigo: 'paramedicos', cantidad: 3 },
      { ref: refA, codigo: 'botes', cantidad: 2 },
    ]);
    await comprometer(id, [{ ref: refA, codigo: 'paramedicos', cantidad: 1 }]);
    await comprometer(otra, [{ ref: refA, codigo: 'paramedicos', cantidad: 2 }]);
    assert.equal(await comprometida(refA, 'paramedicos'), antes + 6);

    const res = await call('POST', `/emergencias/${id}/cierre`, integracion);
    assert.equal(res.status, 200);
    assert.equal(res.body.compromisosLiberados, 2);
    assert.deepEqual(res.body.recursosLiberados, [
      { ongRef: refA, recursoCodigo: 'botes', cantidad: 2 },
      { ongRef: refA, recursoCodigo: 'paramedicos', cantidad: 4 },
    ]);
    // Lo de la otra emergencia sigue comprometido.
    assert.equal(await comprometida(refA, 'paramedicos'), antes + 2);
    assert.equal(await comprometida(refA, 'botes'), 0);
  });

  it('un segundo cierre no libera dos veces; sin compromisos responde 200', async () => {
    const id = randomUUID();
    await comprometer(id, [{ ref: refB, codigo: 'paramedicos', cantidad: 2 }]);
    const antes = await comprometida(refB, 'paramedicos');
    await call('POST', `/emergencias/${id}/cierre`, integracion);
    const segundo = await call('POST', `/emergencias/${id}/cierre`, integracion);
    assert.equal(segundo.status, 200);
    assert.equal(segundo.body.compromisosLiberados, 0);
    assert.equal(await comprometida(refB, 'paramedicos'), antes - 2);

    const vacia = await call('POST', `/emergencias/${randomUUID()}/cierre`, integracion);
    assert.equal(vacia.status, 200);
    assert.deepEqual(vacia.body.recursosLiberados, []);
  });

  it('cierres concurrentes de la misma emergencia liberan una sola vez (locking)', async () => {
    const id = randomUUID();
    await comprometer(id, [{ ref: refB, codigo: 'paramedicos', cantidad: 3 }]);
    const antes = await comprometida(refB, 'paramedicos');

    const respuestas = await Promise.all(
      Array.from({ length: 8 }, () => call('POST', `/emergencias/${id}/cierre`, integracion)),
    );
    assert.ok(respuestas.every((res) => res.status === 200));
    const liberaron = respuestas.filter((res) => res.body.compromisosLiberados > 0);
    assert.equal(liberaron.length, 1);
    assert.equal(await comprometida(refB, 'paramedicos'), antes - 3);
  });
});
