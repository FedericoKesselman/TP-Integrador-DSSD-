// Run against a development PostgreSQL database: node tests/notifications.integration.js.
// Fixtures live in a disposable schema; existing application data is untouched.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import pg from 'pg';

const schema = `notifications_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const originalUrl = process.env.DATABASE_URL;
const url = new URL(originalUrl);
url.searchParams.set('options', `-c search_path=${schema},public`);
process.env.DATABASE_URL = url.toString();
process.env.BONITA_NOTIFICATION_TOKEN = randomUUID();
const { default: pool } = await import('../src/db.js');
const { default: router } = await import('../src/routes/notification-routes.js');
let server;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await pool.query('CREATE TABLE emergencies (id UUID PRIMARY KEY, status TEXT NOT NULL)');
  await pool.query('CREATE TABLE ongs (id UUID PRIMARY KEY, bonita_org_ref TEXT)');
  const migration = await readFile(
    new URL('../migrations/1791000000000_create-notifications.sql', import.meta.url),
    'utf8',
  );
  await pool.query(migration.split('-- Down Migration')[0]);
  const first = randomUUID();
  const second = randomUUID();
  const draft = randomUUID();
  await pool.query(
    "INSERT INTO emergencies VALUES ($1,'convocatoria_abierta'), ($2,'convocatoria_abierta'), ($3,'registrada')",
    [first, second, draft],
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
  app.use('/api/notifications', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => {
    server.once('listening', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}/api/notifications`;
  const post = (emergenciaId, authorized = true) =>
    fetch(`${base}/convocatoria`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorized
          ? `Bearer ${process.env.BONITA_NOTIFICATION_TOKEN}`
          : 'Bearer invalid',
      },
      body: JSON.stringify({ emergenciaId }),
    });
  assert.equal((await post(first, false)).status, 401);
  assert.equal((await post('invalid')).status, 400);
  assert.equal((await post(randomUUID())).status, 404);
  assert.equal((await post(draft)).status, 409);
  assert.equal((await post(first)).status, 200);
  const repeated = await Promise.all([post(first), post(first)]);
  const repeatedBodies = await Promise.all(repeated.map((response) => response.json()));
  repeatedBodies.forEach((body) => assert.equal(body.created, 0));
  assert.equal((await post(second)).status, 200);
  const { rows } = await pool.query(
    'SELECT emergency_id, count(*)::int AS total FROM notifications GROUP BY emergency_id',
  );
  assert.equal(rows.length, 2);
  rows.forEach((row) => assert.equal(row.total, 2));
  const inbox = await (await fetch(base)).json();
  assert.equal(inbox.length, 2);
  assert.deepEqual(new Set(inbox.map((item) => item.emergencyId)), new Set([first, second]));
  const { connect } = pool;
  pool.connect = async () => {
    throw new Error('Simulated database outage');
  };
  assert.equal((await post(first)).status, 500);
  pool.connect = connect;
  assert.equal((await post(first)).status, 200);
  const savedToken = process.env.BONITA_NOTIFICATION_TOKEN;
  delete process.env.BONITA_NOTIFICATION_TOKEN;
  assert.equal((await post(first)).status, 503);
  process.env.BONITA_NOTIFICATION_TOKEN = savedToken;
  console.log(
    'PASS: authentication, UUID, absent/draft emergencies, concurrent retries, separate emergencies, ONG-scoped inbox, database failure and recovery, missing configuration.',
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
