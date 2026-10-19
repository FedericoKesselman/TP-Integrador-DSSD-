import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import app from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import pool from '../src/db.js';

// Tests de integración de E3-21 (POST /validaciones). Necesitan el Postgres
// del SN (`docker compose up -d postgres` + `npm run migrate:up`). Si no
// responde, se saltean. Cada corrida usa refs únicos y los borra al final.

let dbAvailable = true;
try {
  await pool.query('SELECT 1');
} catch {
  dbAvailable = false;
}

const suffix = Math.random().toString(36).slice(2, 8);
const refA = `test-val-a-${suffix}`; // nivel 4, 5 paramédicos
const refB = `test-val-b-${suffix}`; // nivel 2, 3 paramédicos
const refInexistente = `test-val-x-${suffix}`;

async function crearOng(ref, nivelOperativo, stock) {
  const { rows } = await pool.query(
    `INSERT INTO ongs (ref, nombre, nivel_operativo) VALUES ($1, $1, $2) RETURNING id`,
    [ref, nivelOperativo],
  );
  await pool.query(
    `INSERT INTO ong_recursos (ong_id, recurso_codigo, cantidad_total)
     SELECT $1, codigo, total FROM unnest($2::text[], $3::int[]) AS s (codigo, total)`,
    [rows[0].id, Object.keys(stock), Object.values(stock)],
  );
}

async function setComprometida(ref, codigo, cantidad) {
  await pool.query(
    `UPDATE ong_recursos SET cantidad_comprometida = $3
      WHERE recurso_codigo = $2 AND ong_id = (SELECT id FROM ongs WHERE ref = $1)`,
    [ref, codigo, cantidad],
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

const esperar = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const loteId = randomUUID();
const pedido = (ofertas, cantidadSolicitada = 5) => ({
  emergenciaId: randomUUID(),
  severidad: 'alta',
  lotes: [{ id: loteId, recursoCodigo: 'paramedicos', cantidadSolicitada }],
  ofertas,
});
const oferta = (ongs, cantidadOfrecida) => ({
  ofertaId: randomUUID(),
  ongs,
  items: [{ loteId, recursoCodigo: 'paramedicos', cantidadOfrecida }],
});
const principal = (ref) => ({ ref, rol: 'principal' });
const apoyo = (ref) => ({ ref, rol: 'apoyo' });

describe('POST /validaciones', { skip: !dbAvailable && 'Postgres del SN no disponible' }, () => {
  let server;
  let baseUrl;
  const integracion = signAccessToken({ username: 'test-integracion', role: 'integracion' });
  const ong = signAccessToken({ username: refA, role: 'ong', ongRef: refA });

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
  const validar = (body, token = integracion) => call('POST', '/validaciones', token, body);

  before(async () => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    await crearOng(refA, 4, { paramedicos: 5, botes: 2 });
    await crearOng(refB, 2, { paramedicos: 3 });
  });

  after(async () => {
    await pool.query('DELETE FROM ongs WHERE ref = ANY($1)', [[refA, refB]]);
    server.close();
    await pool.end();
  });

  it('401 sin token y 403 con el token de una ONG', async () => {
    const body = pedido([oferta([principal(refA)], 3)]);
    assert.equal((await validar(body, null)).status, 401);
    assert.equal((await validar(body, ong)).status, 403);
  });

  it('400 con el detalle por campo si el body es inválido', async () => {
    const res = await validar({});
    assert.equal(res.status, 400);
    assert.ok(res.body.detalle.emergenciaId);
    assert.ok(res.body.detalle.severidad);
    assert.ok(res.body.detalle.lotes);
  });

  it('PLENO: devuelve el perfil y el resumen de cobertura', async () => {
    const body = pedido([oferta([principal(refA)], 3)]);
    const res = await validar(body);
    assert.equal(res.status, 200);
    assert.equal(res.body.emergenciaId, body.emergenciaId);
    const [perfil] = res.body.resultados;
    assert.equal(perfil.ofertaId, body.ofertas[0].ofertaId);
    assert.equal(perfil.nivelHabilitacion, 'PLENO');
    assert.equal(perfil.rolSugerido, 'principal');
    assert.equal(perfil.nivelRiesgoPermitido, 'critica');
    assert.deepEqual(perfil.capacidadesHabilitadas, [
      { loteId, recursoCodigo: 'paramedicos', cantidadHabilitada: 3, cantidadOfrecida: 3 },
    ]);
    assert.deepEqual(res.body.resumen, {
      todosLosLotesCubiertos: false,
      cobertura: [{ loteId, solicitada: 5, cubierta: 3 }],
    });
  });

  it('consorcio: suma el stock de las ONGs y cubre el lote', async () => {
    const res = await validar(pedido([oferta([principal(refA), apoyo(refB)], 8)], 8));
    assert.equal(res.status, 200);
    const [perfil] = res.body.resultados;
    assert.equal(perfil.capacidadesHabilitadas[0].cantidadHabilitada, 8); // 5 + 3
    assert.equal(perfil.nivelHabilitacion, 'PLENO');
    assert.equal(perfil.nivelRiesgoPermitido, 'media'); // el menor nivel operativo es el de refB
    assert.equal(res.body.resumen.todosLosLotesCubiertos, true);
  });

  it('descuenta lo ya comprometido y no reserva nada', async () => {
    await setComprometida(refA, 'paramedicos', 4); // quedan 1 libre
    try {
      const res = await validar(pedido([oferta([principal(refA)], 3)]));
      const [perfil] = res.body.resultados;
      assert.equal(perfil.capacidadesHabilitadas[0].cantidadHabilitada, 1);
      assert.equal(perfil.nivelHabilitacion, 'APOYO'); // 1 de 3
      assert.equal(await comprometida(refA, 'paramedicos'), 4); // la validación no reserva
    } finally {
      await setComprometida(refA, 'paramedicos', 0);
    }
  });

  it('sin ofertas responde 200 con resultados vacíos', async () => {
    const res = await validar(pedido([]));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.resultados, []);
    assert.equal(res.body.resumen.todosLosLotesCubiertos, false);
  });

  it('una ONG que no existe no rechaza el pedido: la oferta queda SIN_CAPACIDAD', async () => {
    const res = await validar(pedido([oferta([principal(refInexistente)], 3)]));
    assert.equal(res.status, 200);
    const [perfil] = res.body.resultados;
    assert.equal(perfil.nivelHabilitacion, 'SIN_CAPACIDAD');
    assert.ok(perfil.observaciones.some((texto) => texto.includes(refInexistente)));
  });

  it('validaciones en paralelo no se traban ni cambian el stock', async () => {
    const body = pedido([oferta([principal(refA), apoyo(refB)], 4)]);
    const respuestas = await Promise.all(Array.from({ length: 15 }, () => validar(body)));
    assert.ok(respuestas.every((res) => res.status === 200));
    assert.ok(
      respuestas.every((res) => JSON.stringify(res.body) === JSON.stringify(respuestas[0].body)),
    );
    assert.equal(await comprometida(refA, 'paramedicos'), 0);
    assert.equal(await comprometida(refB, 'paramedicos'), 0);
  });

  it('espera el bloqueo de una reserva en curso y ve el stock ya actualizado (locking)', async () => {
    const client = await pool.connect();
    try {
      // Simula un /compromisos a mitad de camino: tiene bloqueada la fila de stock.
      await client.query('BEGIN');
      await client.query(
        `SELECT r.id FROM ong_recursos r JOIN ongs o ON o.id = r.ong_id
          WHERE o.ref = $1 AND r.recurso_codigo = 'paramedicos'
            FOR UPDATE OF r`,
        [refA],
      );

      let terminada = false;
      const validacion = validar(pedido([oferta([principal(refA)], 3)])).then((res) => {
        terminada = true;
        return res;
      });
      await esperar(300);
      assert.equal(terminada, false, 'la validación tendría que esperar al bloqueo');

      // La reserva se confirma: la validación recién entonces lee, y ve 4 comprometidos.
      await client.query(
        `UPDATE ong_recursos SET cantidad_comprometida = 4
          WHERE recurso_codigo = 'paramedicos' AND ong_id = (SELECT id FROM ongs WHERE ref = $1)`,
        [refA],
      );
      await client.query('COMMIT');

      const res = await validacion;
      assert.equal(res.status, 200);
      assert.equal(res.body.resultados[0].capacidadesHabilitadas[0].cantidadHabilitada, 1);
    } finally {
      await client.query('ROLLBACK'); // si el COMMIT ya se hizo, no pasa nada
      client.release();
      await setComprometida(refA, 'paramedicos', 0);
    }
  });
});
