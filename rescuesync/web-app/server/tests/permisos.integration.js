// Run against a development PostgreSQL database: node tests/permisos.integration.js.
// E5-74: matriz de permisos. Para cada endpoint de la API y cada perfil (sin sesión y los 4
// roles) comprueba que el backend responde 401 sin sesión, 403 con un rol que no corresponde
// y que el rol correcto pasa la guarda. Router interno: 401 sin clave o con clave inválida,
// aunque haya sesión de usuario. Schema descartable con todas las migraciones; Bonita y el
// Sistema Nacional apuntan a un puerto cerrado (el test solo mira las guardas).
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import express from 'express';
import pg from 'pg';

const schema = `perm_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.searchParams.set('options', `-c search_path=${schema},public`);
process.env.DATABASE_URL = dbUrl.toString();
process.env.BONITA_API_URL = 'http://127.0.0.1:1/bonita';
process.env.SISTEMA_NACIONAL_API_URL = 'http://127.0.0.1:1';
process.env.BONITA_INTEGRATION_KEY = 'clave-de-prueba-e5-74';

const { default: pool } = await import('../src/db.js');
const routers = {
  auth: (await import('../src/routes/auth-routes.js')).default,
  emergencies: (await import('../src/routes/emergency-routes.js')).default,
  ofertas: (await import('../src/routes/oferta-routes.js')).default,
  notifications: (await import('../src/routes/notification-routes.js')).default,
  inventario: (await import('../src/routes/inventario-routes.js')).default,
  dashboard: (await import('../src/routes/dashboard-routes.js')).default,
  internal: (await import('../src/routes/internal-routes.js')).default,
};

const MUNICIPIO = 'operador_municipal';
const COORDINADOR = 'coordinador_regional';
const ONG = 'representante_ong';
const AUDITOR = 'auditor';
const ROLES = [MUNICIPIO, COORDINADOR, ONG, AUDITOR];
const ANY = 'cualquier rol con sesión';
const SIN_PERMISO = 'No tenés permisos para realizar esta acción.';
const SIN_SESION = 'Debés iniciar sesión.';
// Los endpoints loguean los 404/502 esperables de los ids inventados; acá no aportan.
console.error = () => {};

const id = randomUUID();
// [método, ruta, rol permitido]. Es la lista completa de endpoints con sesión de usuario.
const ENDPOINTS = [
  ['POST', '/api/emergencies', MUNICIPIO],
  ['GET', '/api/emergencies', ANY],
  ['GET', `/api/emergencies/${id}`, ANY],
  ['POST', `/api/emergencies/${id}/lotes`, COORDINADOR],
  ['GET', `/api/emergencies/${id}/lotes`, ANY],
  ['POST', `/api/emergencies/${id}/convocatoria`, COORDINADOR],
  ['GET', `/api/emergencies/${id}/ofertas`, COORDINADOR],
  ['GET', `/api/emergencies/${id}/ofertas/validadas`, MUNICIPIO],
  ['POST', `/api/emergencies/${id}/decision`, COORDINADOR],
  ['POST', `/api/emergencies/${id}/adjudicacion`, MUNICIPIO],
  ['POST', `/api/emergencies/${id}/cierre-ejecucion`, COORDINADOR],
  ['POST', `/api/emergencies/${id}/ofertas`, ONG],
  ['GET', `/api/emergencies/${id}/ofertas/mine`, ONG],
  ['GET', '/api/ofertas/ongs', ONG],
  ['PUT', `/api/ofertas/${id}`, ONG],
  ['POST', `/api/ofertas/${id}/finalizar`, ONG],
  ['GET', `/api/ofertas/${id}/historial`, ONG],
  ['GET', '/api/notifications', ONG],
  ['PATCH', `/api/notifications/${id}/leida`, ONG],
  ['GET', '/api/inventario', ONG],
  ['PUT', '/api/inventario', ONG],
  ['GET', '/api/dashboard/indicadores', AUDITOR],
  ['GET', '/api/dashboard/tiempos-etapas', AUDITOR],
  ['GET', '/api/dashboard/export?formato=json', AUDITOR],
];
const INTERNAL = [
  ['GET', `/api/internal/emergencies/${id}/consolidado`],
  ['PATCH', `/api/internal/emergencies/${id}/estado`],
  ['POST', `/api/internal/emergencies/${id}/validaciones`],
  ['GET', `/api/internal/emergencies/${id}/adjudicacion`],
  ['POST', `/api/internal/emergencies/${id}/compromiso-confirmado`],
  ['POST', `/api/internal/emergencies/${id}/compromiso-fallido`],
  ['GET', `/api/internal/emergencies/${id}/finalizacion`],
  ['POST', `/api/internal/emergencies/${id}/notificaciones`],
];

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

  // Mismo montaje que src/index.js; la sesión se simula con el header x-test-role.
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.get('x-test-role');
    if (role) {
      req.session = {
        username: `test-${role}`,
        role,
        ongRef: 'ong-de-prueba',
        bonita: { jsessionId: 'test', apiToken: 'test' },
      };
    } else {
      req.session = {}; // express-session siempre crea la sesión, aunque esté vacía
    }
    next();
  });
  Object.entries(routers).forEach(([name, router]) => app.use(`/api/${name}`, router));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => {
    server.once('listening', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method === 'GET' ? undefined : '{}',
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, message: body.message };
  };

  const filas = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const [method, path, permitido] of ENDPOINTS) {
    const fila = { endpoint: `${method} ${path.replace(id, ':id').split('?')[0]}` };
    // eslint-disable-next-line no-await-in-loop
    const sinSesion = await call(method, path);
    assert.equal(sinSesion.status, 401, `${fila.endpoint} sin sesión`);
    assert.equal(sinSesion.message, SIN_SESION);
    fila['sin sesión'] = sinSesion.status;
    // eslint-disable-next-line no-restricted-syntax
    for (const role of ROLES) {
      // eslint-disable-next-line no-await-in-loop
      const r = await call(method, path, { 'x-test-role': role });
      const debePasar = permitido === ANY || permitido === role;
      if (debePasar) {
        // Pasa la guarda: lo que responda después (400, 404, 502…) ya es lógica del endpoint.
        assert.ok(!(r.status === 401 && r.message === SIN_SESION), `${fila.endpoint} con ${role}`);
        assert.ok(!(r.status === 403 && r.message === SIN_PERMISO), `${fila.endpoint} con ${role}`);
        fila[role] = `pasa (${r.status})`;
      } else {
        assert.equal(r.status, 403, `${fila.endpoint} con ${role}`);
        assert.equal(r.message, SIN_PERMISO);
        fila[role] = 403;
      }
    }
    filas.push(fila);
  }

  // GET /api/auth/me sin sesión.
  assert.equal((await call('GET', '/api/auth/me')).status, 401);

  // Router interno: la sesión de usuario no sirve; hace falta la clave de integración.
  // eslint-disable-next-line no-restricted-syntax
  for (const [method, path] of INTERNAL) {
    const endpoint = `${method} ${path.replace(id, ':id')}`;
    /* eslint-disable no-await-in-loop */
    assert.equal((await call(method, path)).status, 401, `${endpoint} sin clave`);
    const malaClave = await call(method, path, {
      'X-Integration-Key': 'otra-clave-del-mismo-largo',
    });
    assert.equal(malaClave.status, 401, `${endpoint} con clave inválida`);
    const conSesion = await call(method, path, { 'x-test-role': COORDINADOR });
    assert.equal(conSesion.status, 401, `${endpoint} con sesión y sin clave`);
    const ok = await call(method, path, {
      'X-Integration-Key': process.env.BONITA_INTEGRATION_KEY,
    });
    assert.ok(![401, 403, 503].includes(ok.status), `${endpoint} con la clave correcta`);
    /* eslint-enable no-await-in-loop */
    filas.push({
      endpoint,
      'sin sesión': 401,
      'sin clave / clave inválida': 401,
      'con clave': `pasa (${ok.status})`,
    });
  }

  if (process.argv.includes('--tabla')) console.table(filas);
  console.log(
    `PASS: permisos — ${ENDPOINTS.length} endpoints × (sin sesión + 4 roles) y ${INTERNAL.length} endpoints internos con X-Integration-Key.`,
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
