// Run against a development PostgreSQL database: node tests/dashboard.integration.js.
// Schema descartable con todas las migraciones; prueba GET /api/dashboard/indicadores.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import express from 'express';
import pg from 'pg';

const schema = `dash_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.searchParams.set('options', `-c search_path=${schema},public`);
process.env.DATABASE_URL = dbUrl.toString();

const { default: pool } = await import('../src/db.js');
const { default: dashboardRouter } = await import('../src/routes/dashboard-routes.js');

let server;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  const files = (await readdir(new URL('../migrations/', import.meta.url))).sort();
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    // eslint-disable-next-line no-await-in-loop
    await pool.query(sql.split('-- Down Migration')[0]);
  }

  const app = express();
  app.use((req, res, next) => {
    const role = req.get('x-test-role');
    if (role) req.session = { username: role, role };
    next();
  });
  app.use('/api/dashboard', dashboardRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => {
    server.once('listening', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/api/dashboard/indicadores`;
  const get = (role) => fetch(url, { headers: role ? { 'x-test-role': role } : {} });

  // Permisos
  assert.equal((await get()).status, 401);
  assert.equal((await get('representante_ong')).status, 403);

  // Vacío
  const vacio = await (await get('auditor')).json();
  assert.deepEqual(vacio.suministrosMovilizados, []);
  assert.equal(vacio.resolucionConsorcios.porcentaje, 0);
  assert.equal(vacio.coberturaLotes.promedioPorcentaje, 0);

  // Datos: E1 finalizada con consorcio (2 ONGs), E2 finalizada sin consorcio, E3 registrada.
  const q = async (sql, params) => (await pool.query(sql, params)).rows;
  const emergency = async (status) =>
    (
      await q(
        `INSERT INTO emergencies (type, severity, province_id, province, municipality, affected_zone,
           occurred_at, description, contact_name, contact_phone, status)
         VALUES ('incendio','alta','06','Buenos Aires','La Plata','Z', now(), 'd', 'n', 't', $1)
         RETURNING id`,
        [status],
      )
    )[0].id;
  const lote = async (eid, code, qty) =>
    (
      await q(
        `INSERT INTO lotes (emergency_id, resource_type, resource_code, quantity_requested)
         VALUES ($1, $2, $2, $3) RETURNING id`,
        [eid, code, qty],
      )
    )[0].id;
  const ong = async (name) =>
    (await q('INSERT INTO ongs (name) VALUES ($1) RETURNING id', [name]))[0].id;
  const oferta = async (eid, status, ongs, items) => {
    const { id } = (
      await q('INSERT INTO ofertas (emergency_id, status) VALUES ($1, $2) RETURNING id', [
        eid,
        status,
      ])
    )[0];
    // eslint-disable-next-line no-restricted-syntax
    for (const o of ongs)
      // eslint-disable-next-line no-await-in-loop
      await q('INSERT INTO oferta_ongs (oferta_id, ong_id) VALUES ($1, $2)', [id, o]);
    // eslint-disable-next-line no-restricted-syntax
    for (const [l, n] of items)
      // eslint-disable-next-line no-await-in-loop
      await q(
        'INSERT INTO oferta_lotes (oferta_id, lote_id, quantity_offered) VALUES ($1, $2, $3)',
        [id, l, n],
      );
  };

  const [a, b, c] = [await ong('A'), await ong('B'), await ong('C')];
  const e1 = await emergency('finalizada');
  const e2 = await emergency('finalizada');
  const e3 = await emergency('registrada');
  const l1 = await lote(e1, 'raciones', 100);
  const l2 = await lote(e2, 'raciones', 100);
  const l3 = await lote(e3, 'mantas', 50);
  await oferta(e1, 'finalizada', [a, b], [[l1, 60]]);
  await oferta(e1, 'adjudicada', [c], [[l1, 70]]); // cubierta 130 → tope 100
  await oferta(e1, 'no_seleccionada', [a], [[l1, 999]]); // no cuenta
  await oferta(e2, 'finalizada', [a], [[l2, 50]]);
  await oferta(e3, 'registrada', [a, b], [[l3, 10]]); // no cuenta

  const data = await (await get('auditor')).json();
  const mes = new Date().toISOString().slice(0, 7);
  assert.deepEqual(data.suministrosMovilizados, [
    { mes, recursoCodigo: 'raciones', cantidad: 180 },
  ]);
  assert.deepEqual(data.resolucionConsorcios, {
    emergenciasFinalizadas: 2,
    conConsorcio: 1,
    porcentaje: 50,
  });
  const estados = Object.fromEntries(data.estadoProyectos.map((s) => [s.estado, s.cantidad]));
  assert.deepEqual(estados, { finalizada: 2, registrada: 1 });
  assert.equal(data.estadoProyectos.find((s) => s.estado === 'registrada').emergencias[0].id, e3);
  // coberturas: 100%, 50%, 0% → 50
  assert.deepEqual(data.coberturaLotes, { lotes: 3, promedioPorcentaje: 50 });

  console.log(
    'PASS: /api/dashboard/indicadores — permisos, vacío, suministros, consorcios, estados y cobertura.',
  );
} finally {
  if (server)
    await new Promise((resolve) => {
      server.close(resolve);
    });
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
