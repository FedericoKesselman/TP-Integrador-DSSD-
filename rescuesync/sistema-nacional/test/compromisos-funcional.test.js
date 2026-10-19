import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import app from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import pool from '../src/db.js';

// Pruebas funcionales de POST /compromisos (E3-25), contra Postgres. Cada
// test crea sus propias ONGs (con stock propio) para no depender de los demás.
// La prueba de concurrencia básica (E3-24) está en compromisos.test.js.

const suffix = Date.now();
const integracion = signAccessToken({ username: 'test-compromisos', role: 'integracion' });
const refsCreados = [];
let server;

const url = (path) => `http://127.0.0.1:${server.address().port}${path}`;

function post(path, body, token = integracion) {
  return fetch(url(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// Crea una ONG habilitada con su stock: stock = { paramedicos: 3, botes: 2 }.
async function crearOng(nombre, stock) {
  const ref = `test-comp-${nombre}-${suffix}`;
  const { rows } = await pool.query(
    "INSERT INTO ongs (ref, nombre, nivel_operativo) VALUES ($1, 'ONG de prueba', 3) RETURNING id",
    [ref],
  );
  refsCreados.push(ref);
  await Promise.all(
    Object.entries(stock).map(([recurso, total]) =>
      pool.query(
        'INSERT INTO ong_recursos (ong_id, recurso_codigo, cantidad_total) VALUES ($1, $2, $3)',
        [rows[0].id, recurso, total],
      ),
    ),
  );
  return ref;
}

async function comprometido(ref, recurso) {
  const { rows } = await pool.query(
    `SELECT r.cantidad_comprometida FROM ong_recursos r JOIN ongs o ON o.id = r.ong_id
      WHERE o.ref = $1 AND r.recurso_codigo = $2`,
    [ref, recurso],
  );
  return rows[0].cantidad_comprometida;
}

async function cantidadDeCompromisos(emergenciaId) {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS total FROM compromisos WHERE emergencia_id = $1',
    [emergenciaId],
  );
  return rows[0].total;
}

const oferta = (ongs, items, ofertaId = randomUUID()) => ({ ofertaId, ongs, items });
const pedido = (ofertas, emergenciaId = randomUUID()) => ({ emergenciaId, ofertas });
const principal = (ref) => ({ ref, rol: 'principal' });
const apoyo = (ref) => ({ ref, rol: 'apoyo' });
const item = (recursoCodigo, cantidad) => ({ recursoCodigo, cantidad });

describe('POST /compromisos', () => {
  before(async () => {
    server = app.listen(0);
  });

  after(async () => {
    // Primero los compromisos (apuntan al stock), después las ONGs.
    await pool.query(
      `DELETE FROM compromisos WHERE id IN (
         SELECT i.compromiso_id FROM compromiso_items i
           JOIN ong_recursos r ON r.id = i.ong_recurso_id
           JOIN ongs o ON o.id = r.ong_id
          WHERE o.ref = ANY($1::text[]))`,
      [refsCreados],
    );
    await pool.query('DELETE FROM ongs WHERE ref = ANY($1::text[])', [refsCreados]);
    server.close();
    await pool.end();
  });

  it('401 sin token y 403 con el token de una ONG', async () => {
    const body = pedido([oferta([principal('x')], [item('paramedicos', 1)])]);
    assert.equal((await post('/compromisos', body, null)).status, 401);

    const tokenOng = signAccessToken({ username: 'una-ong', role: 'ong', ongRef: 'una-ong' });
    assert.equal((await post('/compromisos', body, tokenOng)).status, 403);
  });

  it('400 con el detalle por campo si el body no respeta el formato', async () => {
    const incompleto = await post('/compromisos', pedido([{ ofertaId: randomUUID() }]));
    assert.equal(incompleto.status, 400);
    const { detalle } = await incompleto.json();
    assert.ok(detalle['ofertas[0].ongs']);
    assert.ok(detalle['ofertas[0].items']);

    const cabecera = await post('/compromisos', { emergenciaId: 'no-es-uuid', ofertas: [] });
    assert.equal(cabecera.status, 400);
    const { detalle: detalleCabecera } = await cabecera.json();
    assert.ok(detalleCabecera.emergenciaId);
    assert.ok(detalleCabecera.ofertas);
  });

  it('consorcio: reparte entre las ONGs, la principal primero', async () => {
    const a = await crearOng('consorcio-a', { paramedicos: 3 });
    const b = await crearOng('consorcio-b', { paramedicos: 4 });
    const body = pedido([oferta([principal(b), apoyo(a)], [item('paramedicos', 5)])]);

    const respuesta = await post('/compromisos', body);
    assert.equal(respuesta.status, 200);
    const json = await respuesta.json();
    assert.equal(json.emergenciaId, body.emergenciaId);
    assert.equal(json.compromisos.length, 1);
    const [compromiso] = json.compromisos;
    assert.equal(compromiso.ofertaId, body.ofertas[0].ofertaId);
    assert.equal(compromiso.estado, 'activo');
    assert.equal(compromiso.yaExistia, false);
    assert.deepEqual(compromiso.reparto, [
      { ongRef: a, recursoCodigo: 'paramedicos', cantidad: 1 },
      { ongRef: b, recursoCodigo: 'paramedicos', cantidad: 4 },
    ]);
    assert.equal(await comprometido(a, 'paramedicos'), 1);
    assert.equal(await comprometido(b, 'paramedicos'), 4);
  });

  it('idempotente: repetir el pedido devuelve el mismo compromiso y no reserva de nuevo', async () => {
    const a = await crearOng('idem-a', { raciones: 10 });
    const body = pedido([oferta([principal(a)], [item('raciones', 4)])]);

    const primera = await (await post('/compromisos', body)).json();
    const segunda = await post('/compromisos', body);
    assert.equal(segunda.status, 200);
    const repetida = (await segunda.json()).compromisos[0];

    assert.equal(primera.compromisos[0].yaExistia, false);
    assert.equal(repetida.yaExistia, true);
    assert.equal(repetida.compromisoId, primera.compromisos[0].compromisoId);
    assert.deepEqual(repetida.reparto, primera.compromisos[0].reparto);
    assert.equal(await comprometido(a, 'raciones'), 4);
  });

  it('reintentos en paralelo de la misma oferta: todos 200, una sola reserva', async () => {
    const a = await crearOng('paralelo-a', { raciones: 10 });
    const body = pedido([oferta([principal(a)], [item('raciones', 4)])]);

    const respuestas = await Promise.all(
      Array.from({ length: 10 }, () => post('/compromisos', body)),
    );
    assert.deepEqual(
      respuestas.map((r) => r.status),
      Array(10).fill(200),
    );
    const compromisos = await Promise.all(
      respuestas.map(async (r) => (await r.json()).compromisos[0]),
    );
    assert.equal(compromisos.filter((c) => !c.yaExistia).length, 1);
    assert.equal(new Set(compromisos.map((c) => c.compromisoId)).size, 1);
    assert.equal(await comprometido(a, 'raciones'), 4);
    assert.equal(await cantidadDeCompromisos(body.emergenciaId), 1);
  });

  it('409 con el detalle de qué falta y de qué ONG; no reserva nada', async () => {
    const a = await crearOng('corta-a', { botes: 2 });
    const b = await crearOng('corta-b', { botes: 1 });
    const body = pedido([
      oferta([principal(a), apoyo(b), apoyo('no-existe-xyz')], [item('botes', 5)]),
    ]);

    const respuesta = await post('/compromisos', body);
    assert.equal(respuesta.status, 409);
    const { message, detalle } = await respuesta.json();
    assert.ok(message);
    assert.deepEqual(detalle, {
      ofertaId: body.ofertas[0].ofertaId,
      recursoCodigo: 'botes',
      solicitado: 5,
      disponible: 3,
      faltante: 2,
      ongs: [
        { ongRef: a, disponible: 2 },
        { ongRef: b, disponible: 1 },
        { ongRef: 'no-existe-xyz', disponible: 0 },
      ],
    });
    assert.equal(await comprometido(a, 'botes'), 0);
    assert.equal(await comprometido(b, 'botes'), 0);
    assert.equal(await cantidadDeCompromisos(body.emergenciaId), 0);
  });

  it('todo o nada: si la segunda oferta no alcanza, la primera tampoco se reserva', async () => {
    const a = await crearOng('todo-o-nada-a', { botes: 4 });
    const primera = oferta([principal(a)], [item('botes', 3)]);
    const segunda = oferta([principal(a)], [item('botes', 3)]); // el stock se comparte: queda 1
    const body = pedido([primera, segunda]);

    const respuesta = await post('/compromisos', body);
    assert.equal(respuesta.status, 409);
    const { detalle } = await respuesta.json();
    assert.equal(detalle.ofertaId, segunda.ofertaId);
    assert.equal(detalle.disponible, 1);
    assert.equal(detalle.faltante, 2);
    assert.equal(await comprometido(a, 'botes'), 0);
    assert.equal(await cantidadDeCompromisos(body.emergenciaId), 0);
  });

  it('varias ofertas que entran juntas se reservan y responden en el orden del pedido', async () => {
    const a = await crearOng('varias-a', { botes: 5 });
    const primera = oferta([principal(a)], [item('botes', 2)]);
    const segunda = oferta([principal(a)], [item('botes', 3)]);

    const respuesta = await post('/compromisos', pedido([primera, segunda]));
    assert.equal(respuesta.status, 200);
    const { compromisos } = await respuesta.json();
    assert.deepEqual(
      compromisos.map((c) => c.ofertaId),
      [primera.ofertaId, segunda.ofertaId],
    );
    assert.equal(await comprometido(a, 'botes'), 5);
  });

  it('después del cierre, repetir el pedido informa "liberado" y no reserva de nuevo', async () => {
    const a = await crearOng('cierre-a', { paramedicos: 5 });
    const body = pedido([oferta([principal(a)], [item('paramedicos', 3)])]);

    assert.equal((await post('/compromisos', body)).status, 200);
    assert.equal(await comprometido(a, 'paramedicos'), 3);

    const cierre = await post(`/emergencias/${body.emergenciaId}/cierre`, {});
    assert.equal(cierre.status, 200);
    assert.equal((await cierre.json()).compromisosLiberados, 1);
    assert.equal(await comprometido(a, 'paramedicos'), 0);

    const repetido = await post('/compromisos', body);
    assert.equal(repetido.status, 200);
    const [compromiso] = (await repetido.json()).compromisos;
    assert.equal(compromiso.yaExistia, true);
    assert.equal(compromiso.estado, 'liberado');
    assert.equal(await comprometido(a, 'paramedicos'), 0);
  });

  it('pedidos cruzados (ONGs en distinto orden) no se traban y no reservan de más', async () => {
    const a = await crearOng('cruzado-a', { raciones: 10 });
    const b = await crearOng('cruzado-b', { raciones: 10 });

    // 12 pedidos de 3 raciones sobre 20 disponibles: entran exactamente 6.
    const respuestas = await Promise.all(
      Array.from({ length: 12 }, (_, indice) => {
        const ongs = indice % 2 === 0 ? [principal(a), apoyo(b)] : [principal(b), apoyo(a)];
        return post('/compromisos', pedido([oferta(ongs, [item('raciones', 3)])]));
      }),
    );
    const estados = respuestas.map((r) => r.status);
    assert.deepEqual(
      estados.filter((estado) => estado !== 200 && estado !== 409),
      [],
    );
    assert.equal(estados.filter((estado) => estado === 200).length, 6);
    assert.equal((await comprometido(a, 'raciones')) + (await comprometido(b, 'raciones')), 18);
  });
});
