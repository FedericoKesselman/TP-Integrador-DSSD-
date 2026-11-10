// Run against a development PostgreSQL database: node tests/notifications.integration.js.
// Fixtures live in a disposable schema; existing application data is untouched.
// Cubre los avisos del ciclo: POST /api/internal/emergencies/:id/notificaciones
// (X-Integration-Key) y la bandeja de la ONG (GET y PATCH …/leida).
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import pg from 'pg';

const schema = `notifications_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('options', `-c search_path=${schema},public`);
process.env.DATABASE_URL = url.toString();
process.env.BONITA_INTEGRATION_KEY = randomUUID();
const { default: pool } = await import('../src/db.js');
const { default: internalRouter } = await import('../src/routes/internal-routes.js');
const { default: notificationRouter } = await import('../src/routes/notification-routes.js');
let server;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await pool.query(
    `CREATE TABLE emergencies (
       id UUID PRIMARY KEY, status TEXT NOT NULL, convocatoria_ronda INTEGER NOT NULL DEFAULT 1,
       description TEXT, type TEXT, severity TEXT, province TEXT, municipality TEXT
     )`,
  );
  await pool.query('CREATE TABLE ongs (id UUID PRIMARY KEY, bonita_org_ref TEXT)');

  // Tabla `notifications` tal como queda después de las migraciones: la original
  // más la sección 7 de la migración de la Entrega 5 (tipo, ronda, leida_at).
  const original = await readFile(
    new URL('../migrations/1791000000000_create-notifications.sql', import.meta.url),
    'utf8',
  );
  await pool.query(original.split('-- Down Migration')[0]);
  const e5 = await readFile(
    new URL('../migrations/1793000000000_e5-ciclo-completo.sql', import.meta.url),
    'utf8',
  );
  await pool.query(
    e5.split('-- 7. Avisos')[1].split('-- 8. lotes')[0].split('\n').slice(1).join('\n'),
  );

  const open = randomUUID();
  const other = randomUUID();
  const draft = randomUUID();
  await pool.query(
    "INSERT INTO emergencies (id, status) VALUES ($1,'convocatoria_abierta'), ($2,'convocatoria_abierta'), ($3,'registrada')",
    [open, other, draft],
  );
  await pool.query("INSERT INTO ongs VALUES ($1,'ong-a'), ($2,'ong-b')", [
    randomUUID(),
    randomUUID(),
  ]);

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { username: 'test', role: 'representante_ong', ongRef: 'ong-a' };
    next();
  });
  app.use('/api/internal', internalRouter);
  app.use('/api/notifications', notificationRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => {
    server.once('listening', resolve);
  });
  const root = `http://127.0.0.1:${server.address().port}/api`;

  const notify = (emergencyId, tipo = 'CONVOCATORIA', key = process.env.BONITA_INTEGRATION_KEY) =>
    fetch(`${root}/internal/emergencies/${emergencyId}/notificaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Integration-Key': key },
      body: JSON.stringify({ tipo }),
    });

  assert.equal((await notify(open, 'CONVOCATORIA', 'clave-incorrecta')).status, 401);
  assert.equal((await notify('invalid')).status, 400);
  assert.equal((await notify(open, 'OFERTA_RETIRADA')).status, 400); // solo la emite la web-app
  assert.equal((await notify(randomUUID())).status, 404);
  assert.equal((await notify(draft)).status, 409); // convocatoria sin publicar
  assert.equal((await notify(open, 'CIERRE_CONVOCATORIA')).status, 409); // todavía abierta
  assert.equal((await notify(open)).status, 200);

  // Reintentos en paralelo: no duplican avisos.
  const repeated = await Promise.all([notify(open), notify(open)]);
  const bodies = await Promise.all(repeated.map((response) => response.json()));
  bodies.forEach((body) => assert.equal(body.created, 0));
  assert.equal((await notify(other)).status, 200);

  const { rows } = await pool.query(
    'SELECT emergency_id, count(*)::int AS total FROM notifications GROUP BY emergency_id',
  );
  assert.equal(rows.length, 2);
  rows.forEach((row) => assert.equal(row.total, 2)); // un aviso por ONG

  // Cerrar la convocatoria permite el aviso de cierre (mismo ronda, otro tipo).
  await pool.query("UPDATE emergencies SET status = 'convocatoria_cerrada' WHERE id = $1", [open]);
  assert.equal((await notify(open, 'CIERRE_CONVOCATORIA')).status, 200);

  // Reabrir (ronda nueva): las ONGs vuelven a recibir el aviso de convocatoria.
  await pool.query(
    "UPDATE emergencies SET status = 'convocatoria_abierta', convocatoria_ronda = 2 WHERE id = $1",
    [open],
  );
  const reopened = await (await notify(open)).json();
  assert.equal(reopened.created, 2);

  // Bandeja de la ONG de la sesión: todos los tipos, solo los suyos.
  const inbox = await (await fetch(`${root}/notifications`)).json();
  assert.equal(inbox.length, 4); // open: 2 convocatorias + 1 cierre; other: 1 convocatoria
  assert.deepEqual(
    new Set(inbox.map((item) => item.tipo)),
    new Set(['CONVOCATORIA', 'CIERRE_CONVOCATORIA']),
  );
  inbox.forEach((item) => assert.equal(item.leida, false));

  const read = await fetch(`${root}/notifications/${inbox[0].id}/leida`, { method: 'PATCH' });
  assert.equal(read.status, 200);
  assert.equal((await read.json()).leida, true);
  assert.equal(
    (await fetch(`${root}/notifications/${randomUUID()}/leida`, { method: 'PATCH' })).status,
    404,
  );
  assert.equal(
    (await fetch(`${root}/notifications/no-es-uuid/leida`, { method: 'PATCH' })).status,
    400,
  );
  const afterRead = await (await fetch(`${root}/notifications`)).json();
  assert.equal(afterRead.filter((item) => item.leida).length, 1);

  // Caída de la base y recuperación.
  const { connect } = pool;
  pool.connect = async () => {
    throw new Error('Simulated database outage');
  };
  assert.equal((await notify(open)).status, 500);
  pool.connect = connect;
  assert.equal((await notify(open)).status, 200);

  // Sin clave configurada en el server.
  const savedKey = process.env.BONITA_INTEGRATION_KEY;
  delete process.env.BONITA_INTEGRATION_KEY;
  assert.equal((await notify(open, 'CONVOCATORIA', savedKey)).status, 503);
  process.env.BONITA_INTEGRATION_KEY = savedKey;

  console.log(
    'PASS: integration key, UUID/tipo validation, absent/draft/wrong-state emergencies, concurrent retries, rounds on reopen, ONG-scoped inbox, mark as read, database failure and recovery, missing configuration.',
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
