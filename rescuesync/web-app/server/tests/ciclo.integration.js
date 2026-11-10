// Run against a development PostgreSQL database: node tests/ciclo.integration.js.
// Corre TODAS las migraciones en un schema descartable (los datos de la app no se tocan) y
// ejercita el backend completo del ciclo de una emergencia con Bonita y el Sistema Nacional
// SIMULADOS (dos servidores HTTP falsos), así que no necesita ninguno de los dos levantado.
//
// Cubre: lotes con resourceCode, publicación con duración, estados y whitelist, consolidado,
// validaciones, decisión (continuar / reabrir / reformular, con compensación si Bonita falla),
// adjudicación, compromiso confirmado y fallido, avisos, finalización, cierre de ejecución,
// inventario (cliente del SN) y permisos por rol de cada endpoint nuevo.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import http from 'node:http';
import express from 'express';
import pg from 'pg';

// ---------------------------------------------------------------------------
// Servidores falsos
// ---------------------------------------------------------------------------
function listen(handler) {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    const url = new URL(req.url, 'http://localhost');
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    try {
      await handler({ req, url, body: raw ? JSON.parse(raw) : undefined, reply });
    } catch (error) {
      reply(500, { message: String(error) });
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Bonita falso: cada caso tiene la lista de tareas pendientes (la fija el test) y se
// registran las ejecuciones con su body. `failTask` hace fallar esa tarea con un 500.
const bonita = {
  pending: new Map(),
  executions: [],
  failTask: null,
  nextCase: 100,
  tasks: new Map(),
  setPending(caseId, names) {
    this.pending.set(String(caseId), [...names]);
  },
  executionsOf(caseId, name) {
    return this.executions.filter((e) => e.caseId === String(caseId) && e.name === name);
  },
};
const bonitaServer = await listen(({ req, url, body, reply }) => {
  const path = url.pathname;
  if (path === '/API/bpm/process' && req.method === 'GET') {
    return reply(200, [{ id: 'p1', deploymentDate: '2026-01-01 00:00:00.000' }]);
  }
  if (path === '/API/bpm/process/p1/instantiation') {
    bonita.nextCase += 1;
    bonita.setPending(bonita.nextCase, ['Registrar Emergencia']);
    return reply(200, { caseId: bonita.nextCase });
  }
  if (path === '/API/bpm/humanTask') {
    const filters = url.searchParams.getAll('f');
    const caseId = filters.find((f) => f.startsWith('caseId='))?.slice('caseId='.length);
    const names = bonita.pending.get(caseId) ?? [];
    return reply(
      200,
      names.map((name) => {
        const id = `task-${bonita.tasks.size + 1}`;
        bonita.tasks.set(id, { caseId, name });
        return { id, name, displayName: name };
      }),
    );
  }
  if (path.startsWith('/API/system/session/')) return reply(200, { user_id: '7' });
  const execution = path.match(/^\/API\/bpm\/userTask\/([^/]+)\/execution$/);
  if (execution) {
    const task = bonita.tasks.get(execution[1]);
    if (bonita.failTask === task.name) return reply(500, { message: 'Bonita caído' });
    bonita.executions.push({ ...task, body });
    bonita.pending.set(
      task.caseId,
      bonita.pending.get(task.caseId).filter((name) => name !== task.name),
    );
    return reply(204);
  }
  if (path.match(/^\/API\/bpm\/userTask\/[^/]+$/)) return reply(200, {});
  return reply(404, { message: `Ruta falsa no soportada: ${req.method} ${path}` });
});

// Sistema Nacional falso (solo lo que usa el inventario).
const sn = {
  loginCount: 0,
  rejectNextToken: false,
  stock: new Map(),
  seen: [],
  conflictOnPut: false,
};
const snServer = await listen(({ req, url, body, reply }) => {
  if (url.pathname === '/auth/login') {
    sn.loginCount += 1;
    assert.equal(body.username, 'integracion-test');
    return reply(200, {
      accessToken: `token-${sn.loginCount}`,
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
  }
  const match = url.pathname.match(/^\/ongs\/([^/]+)\/recursos$/);
  if (!match) return reply(404, { message: 'no existe' });
  const auth = req.headers.authorization;
  if (sn.rejectNextToken) {
    sn.rejectNextToken = false;
    return reply(401, { message: 'Token vencido' });
  }
  sn.seen.push({ method: req.method, ref: match[1], auth });
  if (!sn.stock.has(match[1])) return reply(404, { message: 'ONG inexistente' });
  if (req.method === 'PUT') {
    if (sn.conflictOnPut) {
      return reply(409, {
        message: 'Stock insuficiente',
        detalle: { insuficientes: [{ recursoCodigo: 'raciones', comprometido: 50 }] },
      });
    }
    const current = sn.stock.get(match[1]);
    body.forEach((item) => {
      const found = current.find((row) => row.recursoCodigo === item.recursoCodigo);
      if (found) found.cantidadTotal = item.cantidadTotal;
      else current.push({ recursoCodigo: item.recursoCodigo, cantidadTotal: item.cantidadTotal });
    });
  }
  return reply(200, sn.stock.get(match[1]));
});

const bonitaPort = bonitaServer.address().port;
const snPort = snServer.address().port;
process.env.BONITA_API_URL = `http://127.0.0.1:${bonitaPort}`;
process.env.SISTEMA_NACIONAL_API_URL = `http://127.0.0.1:${snPort}`;
process.env.SN_INTEGRATION_USERNAME = 'integracion-test';
process.env.SN_INTEGRATION_PASSWORD = 'clave-de-prueba';

// ---------------------------------------------------------------------------
// Base de datos: schema descartable con todas las migraciones
// ---------------------------------------------------------------------------
const schema = `ciclo_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.searchParams.set('options', `-c search_path=${schema},public`);
process.env.DATABASE_URL = dbUrl.toString();
const KEY = randomUUID();
process.env.BONITA_INTEGRATION_KEY = KEY;

const { default: pool } = await import('../src/db.js');
const { default: emergencyRouter } = await import('../src/routes/emergency-routes.js');
const { default: ofertaRouter } = await import('../src/routes/oferta-routes.js');
const { default: notificationRouter } = await import('../src/routes/notification-routes.js');
const { default: inventarioRouter } = await import('../src/routes/inventario-routes.js');
const { default: internalRouter } = await import('../src/routes/internal-routes.js');

let appServer;
const originalConsoleError = console.error;
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
  await pool.query("INSERT INTO ongs (name, bonita_org_ref) VALUES ('Tercera ONG', 'tercera-ong')");

  // Los errores que el server loguea a propósito (Bonita caído, etc.) ensucian la salida.
  console.error = () => {};

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.get('x-test-role');
    if (role) {
      req.session = {
        username: req.get('x-test-user') || role,
        role,
        ongRef: req.get('x-test-ong') || undefined,
        bonita: { jsessionId: 'j', apiToken: 't' },
      };
    }
    next();
  });
  app.use('/api/emergencies', emergencyRouter);
  app.use('/api/ofertas', ofertaRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/inventario', inventarioRouter);
  app.use('/api/internal', internalRouter);
  appServer = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => {
    appServer.once('listening', resolve);
  });
  const root = `http://127.0.0.1:${appServer.address().port}/api`;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const OP = { role: 'operador_municipal', user: 'operador' };
  const COORD = { role: 'coordinador_regional', user: 'coord' };
  const AUDITOR = { role: 'auditor', user: 'auditor' };
  const ongA = { role: 'representante_ong', user: 'ong-a', ong: 'rescatistas-unidos' };
  const ongB = { role: 'representante_ong', user: 'ong-b', ong: 'manos-solidarias' };
  const ongC = { role: 'representante_ong', user: 'ong-c', ong: 'tercera-ong' };

  const call = (path, { method = 'GET', body, as, key } = {}) =>
    fetch(`${root}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(as
          ? { 'x-test-role': as.role, 'x-test-user': as.user, 'x-test-ong': as.ong ?? '' }
          : {}),
        ...(key ? { 'X-Integration-Key': key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const api = async (status, path, options = {}) => {
    const response = await call(path, options);
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;
    assert.equal(
      response.status,
      status,
      `${options.method ?? 'GET'} ${path} → ${response.status} ${text}`,
    );
    return parsed;
  };
  const internal = (status, path, options = {}) =>
    api(status, `/internal${path}`, { key: KEY, ...options });

  const history = async (id) =>
    (
      await pool.query(
        `SELECT from_status, to_status FROM emergency_status_history
         WHERE emergency_id = $1 ORDER BY changed_at, id`,
        [id],
      )
    ).rows.map((row) => `${row.from_status ?? '∅'}>${row.to_status}`);
  const statusOf = async (id) =>
    (await pool.query('SELECT status FROM emergencies WHERE id = $1', [id])).rows[0].status;
  const ofertaStatuses = async (id) =>
    (
      await pool.query('SELECT status FROM ofertas WHERE emergency_id = $1 ORDER BY created_at', [
        id,
      ])
    ).rows.map((row) => row.status);
  const count = async (sql, params) => Number((await pool.query(sql, params)).rows[0].n);

  const emergencyPayload = () => ({
    type: 'inundacion',
    severity: 'alta',
    provinceId: '06',
    province: 'Buenos Aires',
    municipality: 'La Plata',
    affectedZone: 'Barrio Norte',
    occurredAt: '2026-11-01T10:00:00Z',
    description: 'Inundación con familias evacuadas en el barrio.',
    contactName: 'Ana Pérez',
    contactPhone: '+54 11 5555-5555',
  });

  // Alta + lotes + convocatoria publicada (por las rutas reales).
  const nuevaEmergenciaPublicada = async (duracion = 2) => {
    const created = await api(201, '/emergencies', {
      method: 'POST',
      as: OP,
      body: emergencyPayload(),
    });
    assert.equal(created.status, 'registrada');
    assert.match(created.bonitaCaseId, /^\d+$/);
    assert.equal(created.bonitaWarning, undefined);
    const { id, bonitaCaseId: caseId } = created;
    bonita.setPending(caseId, [
      'Revisar Emergencia',
      'Generar Lotes de Necesidades',
      'Publicar Convocatoria',
    ]);
    const { lotes } = await api(201, `/emergencies/${id}/lotes`, {
      method: 'POST',
      as: COORD,
      body: {
        lotes: [
          {
            resourceType: 'Paramédicos',
            resourceCode: 'paramedicos',
            unit: 'personas',
            quantityRequested: 5,
          },
          { resourceType: 'Raciones', resourceCode: 'raciones', quantityRequested: 1000 },
        ],
      },
    });
    await api(200, `/emergencies/${id}/convocatoria`, {
      method: 'POST',
      as: COORD,
      body: { duracionMinutos: duracion },
    });
    return { id, caseId, l1: lotes[0], l2: lotes[1] };
  };

  // Dos ofertas: A (ONG A sola) y B (ONG B con la tercera ONG como asociada).
  const crearOfertas = async (e) => {
    const ongs = await api(200, '/ofertas/ongs', { as: ongA });
    const thirdId = ongs.find((ong) => ong.bonitaOrgRef === 'tercera-ong').id;
    const A = await api(201, `/emergencies/${e.id}/ofertas`, {
      method: 'POST',
      as: ongA,
      body: {
        items: [
          { loteId: e.l1.id, quantityOffered: 3 },
          { loteId: e.l2.id, quantityOffered: 600 },
        ],
      },
    });
    const B = await api(201, `/emergencies/${e.id}/ofertas`, {
      method: 'POST',
      as: ongB,
      body: {
        partnerOngIds: [thirdId],
        items: [
          { loteId: e.l1.id, quantityOffered: 2 },
          { loteId: e.l2.id, quantityOffered: 400 },
        ],
      },
    });
    return { A, B };
  };

  // Lo que respondería el SN a POST /validaciones.
  const respuestaSN = (e, { A, B }, capA2 = 600) => {
    const cap = (lote, code, habilitada, ofrecida) => ({
      loteId: lote.id,
      recursoCodigo: code,
      cantidadHabilitada: habilitada,
      cantidadOfrecida: ofrecida,
    });
    return {
      emergenciaId: e.id,
      resultados: [
        {
          ofertaId: A.id,
          nivelHabilitacion: capA2 === 600 ? 'PLENO' : 'PARCIAL',
          rolSugerido: 'principal',
          nivelRiesgoPermitido: 'critica',
          capacidadesHabilitadas: [
            cap(e.l1, 'paramedicos', 3, 3),
            cap(e.l2, 'raciones', capA2, 600),
          ],
          observaciones: [],
        },
        {
          ofertaId: B.id,
          nivelHabilitacion: 'PLENO',
          rolSugerido: 'apoyo',
          nivelRiesgoPermitido: 'alta',
          capacidadesHabilitadas: [cap(e.l1, 'paramedicos', 2, 2), cap(e.l2, 'raciones', 400, 400)],
          observaciones: ['Consorcio con una ONG de nivel 2.'],
        },
      ],
      resumen: {
        todosLosLotesCubiertos: capA2 + 400 >= 1000,
        cobertura: [
          { loteId: e.l1.id, solicitada: 5, cubierta: 5 },
          { loteId: e.l2.id, solicitada: 1000, cubierta: Math.min(1000, capA2 + 400) },
        ],
      },
    };
  };

  const cerrarYValidar = async (e, ofertas, capA2 = 600) => {
    await internal(200, `/emergencies/${e.id}/estado`, {
      method: 'PATCH',
      body: { estado: 'convocatoria_cerrada' },
    });
    await internal(200, `/emergencies/${e.id}/validaciones`, {
      method: 'POST',
      body: respuestaSN(e, ofertas, capA2),
    });
  };

  // =========================================================================
  // 1. Alta, permisos y lotes con resourceCode (E5-11)
  // =========================================================================
  await api(401, '/emergencies', { method: 'POST', body: emergencyPayload() });
  await api(403, '/emergencies', { method: 'POST', as: COORD, body: emergencyPayload() });
  await api(400, '/emergencies', {
    method: 'POST',
    as: OP,
    body: { ...emergencyPayload(), severity: 'enorme' },
  });

  const e1 = await nuevaEmergenciaPublicada(); // ya probó alta + lotes + publicar OK
  assert.equal(bonita.executionsOf(e1.caseId, 'Registrar Emergencia').length, 1);
  assert.deepEqual(
    bonita.executionsOf(e1.caseId, 'Publicar Convocatoria')[0].body,
    { duracionConvocatoria: 2 },
    'la duración viaja a Bonita como input de "Publicar Convocatoria"',
  );
  assert.equal(e1.l1.resourceCode, 'paramedicos');
  assert.equal(e1.l2.resourceCode, 'raciones');
  const listed = await api(200, `/emergencies/${e1.id}/lotes`, { as: COORD });
  assert.deepEqual(listed.map((lote) => lote.resourceCode).sort(), ['paramedicos', 'raciones']);
  assert.equal((await api(200, `/emergencies/${e1.id}`, { as: COORD })).duracionConvocatoriaMin, 2);
  assert.deepEqual(await history(e1.id), ['∅>registrada', 'registrada>convocatoria_abierta']);

  // Lotes: resourceCode obligatorio y con formato; solo el coordinador; congelados al publicar.
  const draft = await api(201, '/emergencies', {
    method: 'POST',
    as: OP,
    body: emergencyPayload(),
  });
  const lotesUrl = `/emergencies/${draft.id}/lotes`;
  await api(400, lotesUrl, {
    method: 'POST',
    as: COORD,
    body: { lotes: [{ resourceType: 'Raciones', quantityRequested: 10 }] },
  });
  await api(400, lotesUrl, {
    method: 'POST',
    as: COORD,
    body: {
      lotes: [{ resourceType: 'Raciones', resourceCode: 'Con Espacios', quantityRequested: 10 }],
    },
  });
  await api(403, lotesUrl, {
    method: 'POST',
    as: OP,
    body: {
      lotes: [{ resourceType: 'Raciones', resourceCode: 'raciones', quantityRequested: 10 }],
    },
  });
  await api(409, `/emergencies/${draft.id}/convocatoria`, { method: 'POST', as: COORD, body: {} }); // sin lotes
  await api(201, lotesUrl, {
    method: 'POST',
    as: COORD,
    body: {
      lotes: [{ resourceType: 'Raciones', resourceCode: 'raciones', quantityRequested: 10 }],
    },
  });
  const replaced = await api(201, lotesUrl, {
    method: 'POST',
    as: COORD,
    body: { lotes: [{ resourceType: 'Agua', resourceCode: 'agua', quantityRequested: 20 }] },
  });
  assert.equal(replaced.lotes.length, 1, 'guardar de nuevo reemplaza el desglose');
  await api(404, `/emergencies/${randomUUID()}/lotes`, {
    method: 'POST',
    as: COORD,
    body: { lotes: [{ resourceType: 'Agua', resourceCode: 'agua', quantityRequested: 20 }] },
  });

  // =========================================================================
  // 2. Publicar convocatoria con duración (E5-18)
  // =========================================================================
  const publishUrl = `/emergencies/${draft.id}/convocatoria`;
  await api(403, publishUrl, { method: 'POST', as: OP, body: {} });
  // eslint-disable-next-line no-restricted-syntax
  for (const bad of [0, 10081, 1.5, '5']) {
    // eslint-disable-next-line no-await-in-loop
    const body = await api(400, publishUrl, {
      method: 'POST',
      as: COORD,
      body: { duracionMinutos: bad },
    });
    assert.ok(body.errors.duracionMinutos);
  }
  // Bonita falla: se revierte todo (estado, ronda, duración, historial) y se puede reintentar.
  bonita.setPending(draft.bonitaCaseId, ['Publicar Convocatoria']);
  bonita.failTask = 'Publicar Convocatoria';
  await api(502, publishUrl, { method: 'POST', as: COORD, body: { duracionMinutos: 30 } });
  bonita.failTask = null;
  const afterFail = (
    await pool.query(
      'SELECT status, duracion_convocatoria_min, convocatoria_ronda FROM emergencies WHERE id = $1',
      [draft.id],
    )
  ).rows[0];
  assert.deepEqual(afterFail, {
    status: 'registrada',
    duracion_convocatoria_min: null,
    convocatoria_ronda: 0,
  });
  assert.deepEqual(await history(draft.id), ['∅>registrada']);
  // Sin duración usa el valor sugerido (120).
  bonita.setPending(draft.bonitaCaseId, ['Publicar Convocatoria']);
  await api(200, publishUrl, { method: 'POST', as: COORD });
  assert.deepEqual(bonita.executionsOf(draft.bonitaCaseId, 'Publicar Convocatoria').at(-1).body, {
    duracionConvocatoria: 120,
  });
  // Ya publicada: 409. La tarea no pendiente en Bonita también revierte.
  await api(409, publishUrl, { method: 'POST', as: COORD, body: { duracionMinutos: 5 } });
  // Lotes congelados después de publicar.
  await api(409, lotesUrl, {
    method: 'POST',
    as: COORD,
    body: { lotes: [{ resourceType: 'Agua', resourceCode: 'agua', quantityRequested: 20 }] },
  });

  // =========================================================================
  // 3. Avisos de convocatoria, ofertas y cierre (E5-12, E5-14, E5-13)
  // =========================================================================
  const notified = await internal(200, `/emergencies/${e1.id}/notificaciones`, {
    method: 'POST',
    body: { tipo: 'CONVOCATORIA' },
  });
  assert.equal(notified.created, 3, 'un aviso por ONG de la red');

  // Autenticación del router interno.
  await api(401, `/internal/emergencies/${e1.id}/consolidado`);
  await api(401, `/internal/emergencies/${e1.id}/consolidado`, { key: 'otra-clave' });

  // Ofertas con consorcio; edición mientras la convocatoria está abierta.
  await api(403, `/emergencies/${e1.id}/ofertas`, {
    method: 'POST',
    as: OP,
    body: { items: [{ loteId: e1.l1.id, quantityOffered: 1 }] },
  });
  await api(400, `/emergencies/${e1.id}/ofertas`, {
    method: 'POST',
    as: ongA,
    body: { items: [{ loteId: e1.l1.id, quantityOffered: 6 }] }, // supera lo solicitado (5)
  });
  const ofertas1 = await crearOfertas(e1);
  assert.deepEqual(
    ofertas1.B.ongs.map((ong) => ong.role),
    ['principal', 'asociada'],
  );
  const edited = await api(200, `/ofertas/${ofertas1.A.id}`, {
    method: 'PUT',
    as: ongA,
    body: {
      items: [
        { loteId: e1.l1.id, quantityOffered: 3 },
        { loteId: e1.l2.id, quantityOffered: 600 },
      ],
      observations: 'Con equipo propio',
    },
  });
  assert.equal(edited.observations, 'Con equipo propio');
  assert.equal(
    (await api(200, `/ofertas/${ofertas1.A.id}/historial`, { as: ongA })).length,
    1,
    'la versión anterior queda en el historial',
  );

  // Cierre desde Bonita: whitelist, idempotencia, concurrencia e historial.
  const patch = (body, id = e1.id, key = KEY) =>
    call(`/internal/emergencies/${id}/estado`, { method: 'PATCH', body, key });
  assert.equal((await patch({ estado: 'validada' })).status, 400); // no es un estado que pueda pedir Bonita
  assert.equal((await patch({})).status, 400);
  assert.equal((await patch({ estado: 'finalizada' })).status, 409); // abierta → finalizada no existe
  assert.equal((await patch({ estado: 'convocatoria_cerrada' }, randomUUID())).status, 404);
  assert.equal((await patch({ estado: 'convocatoria_cerrada' }, 'x')).status, 400);
  assert.equal((await patch({ estado: 'convocatoria_cerrada' }, e1.id, 'mal')).status, 401);
  const parallel = await Promise.all([
    patch({ estado: 'convocatoria_cerrada' }),
    patch({ estado: 'convocatoria_cerrada' }),
  ]);
  assert.deepEqual(
    parallel.map((response) => response.status),
    [200, 200],
    'reintentos de Bonita en paralelo no fallan',
  );
  assert.deepEqual(await history(e1.id), [
    '∅>registrada',
    'registrada>convocatoria_abierta',
    'convocatoria_abierta>convocatoria_cerrada',
  ]);

  // Con la convocatoria cerrada no se puede ofertar ni editar.
  await api(409, `/emergencies/${e1.id}/ofertas`, {
    method: 'POST',
    as: ongC,
    body: { items: [{ loteId: e1.l1.id, quantityOffered: 1 }] },
  });
  await api(409, `/ofertas/${ofertas1.A.id}`, {
    method: 'PUT',
    as: ongA,
    body: { items: [{ loteId: e1.l1.id, quantityOffered: 1 }] },
  });
  await internal(200, `/emergencies/${e1.id}/notificaciones`, {
    method: 'POST',
    body: { tipo: 'CIERRE_CONVOCATORIA' },
  });

  // Consolidado en formato SN.
  const consolidado = await internal(200, `/emergencies/${e1.id}/consolidado`);
  assert.equal(consolidado.emergenciaId, e1.id);
  assert.equal(consolidado.severidad, 'alta');
  assert.deepEqual(
    consolidado.lotes
      .map(({ recursoCodigo, cantidadSolicitada }) => [recursoCodigo, cantidadSolicitada])
      .sort(),
    [
      ['paramedicos', 5],
      ['raciones', 1000],
    ],
  );
  assert.equal(consolidado.ofertas.length, 2);
  const consolidadoA = consolidado.ofertas.find((o) => o.ofertaId === ofertas1.A.id);
  const consolidadoB = consolidado.ofertas.find((o) => o.ofertaId === ofertas1.B.id);
  assert.deepEqual(consolidadoA.ongs, [{ ref: 'rescatistas-unidos', rol: 'principal' }]);
  assert.deepEqual(consolidadoB.ongs, [
    { ref: 'manos-solidarias', rol: 'principal' },
    { ref: 'tercera-ong', rol: 'apoyo' },
  ]);
  assert.deepEqual(
    consolidadoA.items
      .map(({ recursoCodigo, cantidadOfrecida }) => [recursoCodigo, cantidadOfrecida])
      .sort(),
    [
      ['paramedicos', 3],
      ['raciones', 600],
    ],
  );
  await internal(404, `/emergencies/${randomUUID()}/consolidado`);

  // =========================================================================
  // 4. Validaciones del SN (E5-15, E5-16)
  // =========================================================================
  const validUrl = `/emergencies/${e1.id}/validaciones`;
  await internal(400, validUrl, { method: 'POST', body: { resumen: {} } }); // sin resultados
  await internal(400, validUrl, {
    method: 'POST',
    body: { ...respuestaSN(e1, ofertas1), resumen: { cobertura: [] } },
  });
  const sinUna = respuestaSN(e1, ofertas1);
  sinUna.resultados.pop();
  const missing = await internal(400, validUrl, { method: 'POST', body: sinUna });
  assert.deepEqual(missing.detalle.ofertasSinResultado, [ofertas1.B.id]);
  const conAjena = respuestaSN(e1, ofertas1);
  conAjena.resultados.push({ ...conAjena.resultados[0], ofertaId: randomUUID() });
  assert.equal(
    (await internal(400, validUrl, { method: 'POST', body: conAjena })).detalle.ofertasDesconocidas
      .length,
    1,
  );
  const malNivel = respuestaSN(e1, ofertas1);
  malNivel.resultados[0].nivelHabilitacion = 'TOTAL';
  await internal(400, validUrl, { method: 'POST', body: malNivel });
  assert.deepEqual(
    await ofertaStatuses(e1.id),
    ['registrada', 'registrada'],
    'una validación rechazada no cambia nada',
  );

  // Antes de cerrar la convocatoria no se valida.
  const e0 = await nuevaEmergenciaPublicada();
  await internal(409, `/emergencies/${e0.id}/validaciones`, {
    method: 'POST',
    body: { resultados: [], resumen: { todosLosLotesCubiertos: false, cobertura: [] } },
  });

  const validated = await internal(200, validUrl, {
    method: 'POST',
    body: respuestaSN(e1, ofertas1),
  });
  assert.equal(validated.status, 'validada');
  assert.equal(validated.todosLosLotesCubiertos, true);
  assert.deepEqual(await ofertaStatuses(e1.id), ['validada', 'validada']);
  assert.equal(await statusOf(e1.id), 'validada');
  // Reintento de Bonita (la respuesta se perdió): idempotente.
  const retried = await internal(200, validUrl, {
    method: 'POST',
    body: respuestaSN(e1, ofertas1),
  });
  assert.equal(retried.alreadyApplied, true);

  // Vista del coordinador y del municipio.
  const vistaCoord = await api(200, `/emergencies/${e1.id}/ofertas`, { as: COORD });
  assert.equal(vistaCoord.todosLosLotesCubiertos, true);
  assert.deepEqual(
    Object.fromEntries(vistaCoord.lotes.map((lote) => [lote.resourceCode, lote.cubierta])),
    { paramedicos: 5, raciones: 1000 },
  );
  assert.equal(vistaCoord.ofertas.length, 2);
  const perfilA = vistaCoord.ofertas.find((o) => o.id === ofertas1.A.id).validacion;
  assert.equal(perfilA.nivelHabilitacion, 'PLENO');
  assert.equal(perfilA.nivelRiesgoPermitido, 'critica');
  assert.equal(perfilA.capacidadesHabilitadas.length, 2);
  await api(403, `/emergencies/${e1.id}/ofertas`, { as: OP });
  await api(401, `/emergencies/${e1.id}/ofertas`);
  const vistaMunicipio = await api(200, `/emergencies/${e1.id}/ofertas/validadas`, { as: OP });
  assert.equal(vistaMunicipio.ofertas.length, 2);
  vistaMunicipio.ofertas.forEach((oferta) => assert.equal(oferta.status, 'validada'));
  await api(403, `/emergencies/${e1.id}/ofertas/validadas`, { as: COORD });
  await api(404, `/emergencies/${randomUUID()}/ofertas`, { as: COORD });
  // Antes de la validación el municipio no ve ofertas (e0 sigue con la convocatoria abierta).
  assert.equal(
    (await api(200, `/emergencies/${e0.id}/ofertas/validadas`, { as: OP })).ofertas.length,
    0,
  );

  // =========================================================================
  // 5. Adjudicación, compromiso fallido y confirmado (E5-19, E5-20)
  // =========================================================================
  const adjUrl = `/emergencies/${e1.id}/adjudicacion`;
  await api(403, adjUrl, { method: 'POST', as: COORD, body: { ofertaIds: [ofertas1.A.id] } });
  await api(400, adjUrl, { method: 'POST', as: OP, body: { ofertaIds: [] } });
  await api(400, adjUrl, { method: 'POST', as: OP, body: { ofertaIds: ['no-uuid'] } });
  await api(400, adjUrl, { method: 'POST', as: OP, body: { ofertaIds: [randomUUID()] } }); // no es de la emergencia
  await api(404, `/emergencies/${randomUUID()}/adjudicacion`, {
    method: 'POST',
    as: OP,
    body: { ofertaIds: [ofertas1.A.id] },
  });
  await api(409, `/emergencies/${e0.id}/adjudicacion`, {
    method: 'POST',
    as: OP,
    body: { ofertaIds: [ofertas1.A.id] },
  }); // e0 sigue con la convocatoria abierta
  await internal(409, `/emergencies/${e1.id}/adjudicacion`); // todavía no eligió

  // Bonita no tiene pendiente "Adjudicar Ofertas": la selección no se guarda.
  bonita.setPending(e1.caseId, []);
  await api(502, adjUrl, {
    method: 'POST',
    as: OP,
    body: { ofertaIds: [ofertas1.A.id, ofertas1.B.id] },
  });
  assert.equal(
    await count('SELECT count(*) AS n FROM adjudicaciones WHERE emergency_id = $1', [e1.id]),
    0,
  );

  // Primer intento: elige A y B → el SN rechaza el compromiso (409) y Bonita avisa.
  bonita.setPending(e1.caseId, ['Adjudicar Ofertas']);
  const chosen = await api(200, adjUrl, {
    method: 'POST',
    as: OP,
    body: { ofertaIds: [ofertas1.A.id, ofertas1.B.id, ofertas1.A.id] },
  });
  assert.equal(chosen.ofertaIds.length, 2, 'ids repetidos se descartan');
  assert.deepEqual(
    await ofertaStatuses(e1.id),
    ['validada', 'validada'],
    'elegir no adjudica todavía',
  );
  const bodySN = await internal(200, `/emergencies/${e1.id}/adjudicacion`);
  assert.equal(bodySN.emergenciaId, e1.id);
  assert.equal(bodySN.ofertas.length, 2);
  const bodyA = bodySN.ofertas.find((o) => o.ofertaId === ofertas1.A.id);
  assert.deepEqual(
    [...bodyA.items].sort((a, b) => a.recursoCodigo.localeCompare(b.recursoCodigo)),
    [
      { recursoCodigo: 'paramedicos', cantidad: 3 },
      { recursoCodigo: 'raciones', cantidad: 600 },
    ],
  );
  assert.deepEqual(bodyA.ongs, [{ ref: 'rescatistas-unidos', rol: 'principal' }]);

  // Si el SN no habilitó un lote de la oferta, ese lote no se compromete.
  await pool.query(
    'UPDATE oferta_validaciones SET capacidades = capacidades - 1 WHERE oferta_id = $1',
    [ofertas1.B.id],
  );
  const sinRaciones = await internal(200, `/emergencies/${e1.id}/adjudicacion`);
  assert.deepEqual(sinRaciones.ofertas.find((o) => o.ofertaId === ofertas1.B.id).items, [
    { recursoCodigo: 'paramedicos', cantidad: 2 },
  ]);

  const detalle409 = {
    ofertaId: ofertas1.A.id,
    recursoCodigo: 'raciones',
    solicitado: 600,
    disponible: 100,
    faltante: 500,
  };
  await internal(400, `/emergencies/${e1.id}/compromiso-fallido`, { method: 'POST', body: {} });
  await internal(200, `/emergencies/${e1.id}/compromiso-fallido`, {
    method: 'POST',
    body: { detalle: detalle409 },
  });
  assert.equal(await statusOf(e1.id), 'validada');
  assert.deepEqual(
    await ofertaStatuses(e1.id),
    ['validada', 'validada'],
    'el rechazo no cambia las ofertas',
  );
  assert.equal(
    await count('SELECT count(*) AS n FROM adjudicaciones WHERE emergency_id = $1', [e1.id]),
    0,
  );
  assert.equal(
    (await api(200, `/emergencies/${e1.id}`, { as: OP })).ultimoConflictoCompromiso.detalle
      .faltante,
    500,
    'el municipio ve qué oferta y qué recurso fallaron',
  );
  // Ninguna ONG fue avisada de una adjudicación que no ocurrió.
  assert.equal(
    await count(
      "SELECT count(*) AS n FROM notifications WHERE tipo IN ('ADJUDICADA','NO_SELECCIONADA')",
    ),
    0,
  );
  await internal(409, `/emergencies/${e1.id}/notificaciones`, {
    method: 'POST',
    body: { tipo: 'COMPROMISO' },
  });

  // Segundo intento: solo A.
  bonita.setPending(e1.caseId, ['Adjudicar Ofertas']);
  await api(200, adjUrl, { method: 'POST', as: OP, body: { ofertaIds: [ofertas1.A.id] } });
  const compromisos = (ofertaId, ongRef) => ({
    compromisos: [
      {
        ofertaId,
        compromisoId: randomUUID(),
        reparto: [{ ongRef, recursoCodigo: 'paramedicos', cantidad: 3 }],
      },
    ],
  });
  await internal(400, `/emergencies/${e1.id}/compromiso-confirmado`, { method: 'POST', body: {} });
  await internal(400, `/emergencies/${e1.id}/compromiso-confirmado`, {
    method: 'POST',
    body: { compromisos: [{ ofertaId: 'x', compromisoId: '' }] },
  });
  await internal(400, `/emergencies/${e1.id}/compromiso-confirmado`, {
    method: 'POST',
    body: compromisos(ofertas1.B.id, 'manos-solidarias'), // B no fue elegida
  });
  const confirmed = await internal(200, `/emergencies/${e1.id}/compromiso-confirmado`, {
    method: 'POST',
    body: compromisos(ofertas1.A.id, 'rescatistas-unidos'),
  });
  assert.equal(confirmed.status, 'adjudicada');
  assert.deepEqual(await ofertaStatuses(e1.id), ['adjudicada', 'no_seleccionada']);
  assert.equal(
    (await api(200, `/emergencies/${e1.id}`, { as: OP })).ultimoConflictoCompromiso,
    null,
  );
  const retriedConfirm = await internal(200, `/emergencies/${e1.id}/compromiso-confirmado`, {
    method: 'POST',
    body: compromisos(ofertas1.A.id, 'rescatistas-unidos'),
  });
  assert.equal(retriedConfirm.alreadyApplied, true, 'reintento de Bonita idempotente');

  // Aviso de compromiso: ADJUDICADA a la ONG de la oferta elegida, NO_SELECCIONADA al resto.
  const avisos = await internal(200, `/emergencies/${e1.id}/notificaciones`, {
    method: 'POST',
    body: { tipo: 'COMPROMISO' },
  });
  assert.equal(avisos.created, 3);
  assert.equal(
    (
      await internal(200, `/emergencies/${e1.id}/notificaciones`, {
        method: 'POST',
        body: { tipo: 'COMPROMISO' },
      })
    ).created,
    0,
  );
  const tiposDe = async (ong) =>
    (await api(200, '/notifications', { as: ong }))
      .filter((aviso) => aviso.emergencyId === e1.id)
      .map((aviso) => aviso.tipo)
      .sort();
  assert.deepEqual(
    await tiposDe(ongA),
    ['ADJUDICADA', 'CONVOCATORIA', 'CIERRE_CONVOCATORIA'].sort(),
  );
  assert.deepEqual(await tiposDe(ongB), ['CIERRE_CONVOCATORIA', 'CONVOCATORIA', 'NO_SELECCIONADA']);
  assert.deepEqual(await tiposDe(ongC), ['CIERRE_CONVOCATORIA', 'CONVOCATORIA', 'NO_SELECCIONADA']);

  // =========================================================================
  // 6. Ejecución, finalización y cierre (E5-21, E5-22)
  // =========================================================================
  const cierreUrl = `/emergencies/${e1.id}/cierre-ejecucion`;
  await api(403, cierreUrl, { method: 'POST', as: OP });
  await api(409, cierreUrl, { method: 'POST', as: COORD }); // todavía "adjudicada", no en ejecución
  await internal(200, `/emergencies/${e1.id}/estado`, {
    method: 'PATCH',
    body: { estado: 'en_ejecucion' },
  });
  assert.equal(await statusOf(e1.id), 'en_ejecucion');

  const pendientes = await api(409, cierreUrl, { method: 'POST', as: COORD });
  assert.deepEqual(
    pendientes.detalle.pendientes.map((p) => p.ofertaId),
    [ofertas1.A.id],
  );
  assert.deepEqual(await internal(200, `/emergencies/${e1.id}/finalizacion`), { ongRefs: [] });

  // Finalizar: solo la ONG dueña, solo una oferta adjudicada.
  await api(403, `/ofertas/${ofertas1.A.id}/finalizar`, { method: 'POST', as: ongB });
  await api(403, `/ofertas/${ofertas1.A.id}/finalizar`, { method: 'POST', as: COORD });
  await api(409, `/ofertas/${ofertas1.B.id}/finalizar`, { method: 'POST', as: ongB }); // no_seleccionada
  await api(404, `/ofertas/${randomUUID()}/finalizar`, { method: 'POST', as: ongA });
  assert.equal(
    (await api(200, `/ofertas/${ofertas1.A.id}/finalizar`, { method: 'POST', as: ongA })).status,
    'finalizada',
  );
  assert.equal(
    (await api(200, `/ofertas/${ofertas1.A.id}/finalizar`, { method: 'POST', as: ongA })).status,
    'finalizada',
  );
  assert.equal(await count('SELECT count(*) AS n FROM oferta_finalizaciones'), 1, 'idempotente');
  assert.deepEqual(await internal(200, `/emergencies/${e1.id}/finalizacion`), {
    ongRefs: ['rescatistas-unidos'],
  });

  // Confirmar el cierre completa la tarea humana en Bonita (con falla y reintento).
  bonita.setPending(e1.caseId, ['Confirmar cierre de ejecución']);
  bonita.failTask = 'Confirmar cierre de ejecución';
  await api(502, cierreUrl, { method: 'POST', as: COORD });
  bonita.failTask = null;
  bonita.setPending(e1.caseId, []);
  await api(502, cierreUrl, { method: 'POST', as: COORD }); // tarea no pendiente
  bonita.setPending(e1.caseId, ['Confirmar cierre de ejecución']);
  const cierre = await api(200, cierreUrl, { method: 'POST', as: COORD });
  assert.equal(cierre.finalizadas, 1);
  assert.equal(bonita.executionsOf(e1.caseId, 'Confirmar cierre de ejecución').length, 1);

  // Bonita libera en el SN y finaliza: el último paso y lo que no existe.
  await internal(200, `/emergencies/${e1.id}/estado`, {
    method: 'PATCH',
    body: { estado: 'finalizada' },
  });
  await internal(409, `/emergencies/${e1.id}/estado`, {
    method: 'PATCH',
    body: { estado: 'convocatoria_cerrada' },
  });
  assert.deepEqual(await history(e1.id), [
    '∅>registrada',
    'registrada>convocatoria_abierta',
    'convocatoria_abierta>convocatoria_cerrada',
    'convocatoria_cerrada>validada',
    'validada>adjudicada',
    'adjudicada>en_ejecucion',
    'en_ejecucion>finalizada',
  ]);

  // =========================================================================
  // 7. Decisión cuando no se cubrió todo (E5-17)
  // =========================================================================
  const e2 = await nuevaEmergenciaPublicada();
  const ofertas2 = await crearOfertas(e2);
  await cerrarYValidar(e2, ofertas2, 500); // la ONG A solo tiene 500 de 600 raciones
  const incompleta = await api(200, `/emergencies/${e2.id}/ofertas`, { as: COORD });
  assert.equal(incompleta.todosLosLotesCubiertos, false);
  assert.equal(incompleta.lotes.find((lote) => lote.resourceCode === 'raciones').cubierta, 900);
  const decisionUrl = `/emergencies/${e2.id}/decision`;
  const decidir = (body, as = COORD) => call(decisionUrl, { method: 'POST', as, body });

  await api(403, decisionUrl, { method: 'POST', as: OP, body: { camino: 'continuar' } });
  assert.equal((await decidir({ camino: 'borrar' })).status, 400);
  assert.equal((await decidir({})).status, 400);
  assert.equal((await decidir({ camino: 'reabrir', duracionMinutos: 0 })).status, 400);
  assert.equal(
    (await call(decisionUrl, { method: 'POST', body: { camino: 'continuar' } })).status,
    401,
  );
  await api(404, `/emergencies/${randomUUID()}/decision`, {
    method: 'POST',
    as: COORD,
    body: { camino: 'continuar' },
  });
  await api(409, `/emergencies/${e0.id}/decision`, {
    method: 'POST',
    as: COORD,
    body: { camino: 'continuar' },
  }); // abierta

  // CONTINUAR: no cambia nada en la base; solo avanza Bonita con camino = "continuar".
  bonita.setPending(e2.caseId, ['Decidir como Continuar']);
  bonita.failTask = 'Decidir como Continuar';
  assert.equal((await decidir({ camino: 'continuar' })).status, 502);
  bonita.failTask = null;
  bonita.setPending(e2.caseId, []);
  assert.equal((await decidir({ camino: 'continuar' })).status, 502, 'tarea no pendiente');
  bonita.setPending(e2.caseId, ['Decidir como Continuar']);
  assert.equal((await decidir({ camino: 'continuar' })).status, 200);
  assert.deepEqual(bonita.executionsOf(e2.caseId, 'Decidir como Continuar').at(-1).body, {
    camino: 'continuar',
  });
  assert.equal(await statusOf(e2.id), 'validada');
  assert.deepEqual(await ofertaStatuses(e2.id), ['validada', 'validada']);

  // REABRIR con Bonita caído: se compensa (estado, ofertas, ronda e historial vuelven).
  const antes = (
    await pool.query('SELECT convocatoria_ronda FROM emergencies WHERE id = $1', [e2.id])
  ).rows[0];
  bonita.setPending(e2.caseId, ['Decidir como Continuar', 'Publicar Convocatoria']);
  bonita.failTask = 'Publicar Convocatoria';
  assert.equal((await decidir({ camino: 'reabrir', duracionMinutos: 5 })).status, 502);
  bonita.failTask = null;
  assert.equal(await statusOf(e2.id), 'validada');
  assert.deepEqual(await ofertaStatuses(e2.id), ['validada', 'validada']);
  assert.equal(
    (await pool.query('SELECT convocatoria_ronda FROM emergencies WHERE id = $1', [e2.id])).rows[0]
      .convocatoria_ronda,
    antes.convocatoria_ronda,
  );
  assert.deepEqual((await history(e2.id)).slice(-1), ['convocatoria_cerrada>validada']);

  // REABRIR bien: las ofertas se mantienen (vuelven a registrada), ronda nueva, nueva duración.
  bonita.setPending(e2.caseId, ['Decidir como Continuar', 'Publicar Convocatoria']);
  const reabierta = await api(200, decisionUrl, {
    method: 'POST',
    as: COORD,
    body: { camino: 'reabrir', duracionMinutos: 5 },
  });
  assert.equal(reabierta.status, 'convocatoria_abierta');
  assert.deepEqual(bonita.executionsOf(e2.caseId, 'Decidir como Continuar').at(-1).body, {
    camino: 'reabrir',
  });
  assert.deepEqual(bonita.executionsOf(e2.caseId, 'Publicar Convocatoria').at(-1).body, {
    duracionConvocatoria: 5,
  });
  assert.equal(await statusOf(e2.id), 'convocatoria_abierta');
  assert.deepEqual(await ofertaStatuses(e2.id), ['registrada', 'registrada']);
  assert.equal(
    (
      await pool.query(
        'SELECT convocatoria_ronda, duracion_convocatoria_min FROM emergencies WHERE id = $1',
        [e2.id],
      )
    ).rows[0].duracion_convocatoria_min,
    5,
  );
  // Las ONGs vuelven a recibir el aviso de convocatoria (ronda nueva) y pueden editar.
  assert.equal(
    (
      await internal(200, `/emergencies/${e2.id}/notificaciones`, {
        method: 'POST',
        body: { tipo: 'CONVOCATORIA' },
      })
    ).created,
    3,
  );
  await api(200, `/ofertas/${ofertas2.A.id}`, {
    method: 'PUT',
    as: ongA,
    body: {
      items: [
        { loteId: e2.l1.id, quantityOffered: 3 },
        { loteId: e2.l2.id, quantityOffered: 600 },
      ],
    },
  });
  await cerrarYValidar(e2, ofertas2, 600);
  assert.equal(await statusOf(e2.id), 'validada');
  assert.equal(
    (await api(200, `/emergencies/${e2.id}/ofertas`, { as: COORD })).todosLosLotesCubiertos,
    true,
  );

  // REFORMULAR con Bonita caído: todo vuelve atrás (transacción sin confirmar).
  bonita.setPending(e2.caseId, ['Decidir como Continuar']);
  bonita.failTask = 'Decidir como Continuar';
  assert.equal((await decidir({ camino: 'reformular' })).status, 502);
  bonita.failTask = null;
  assert.equal(await statusOf(e2.id), 'validada');
  assert.deepEqual(await ofertaStatuses(e2.id), ['validada', 'validada']);
  assert.equal(
    await count(
      'SELECT count(*) AS n FROM oferta_lotes ol JOIN ofertas o ON o.id = ol.oferta_id WHERE o.emergency_id = $1',
      [e2.id],
    ),
    4,
  );
  assert.equal(
    await count(
      "SELECT count(*) AS n FROM notifications WHERE emergency_id = $1 AND tipo = 'OFERTA_RETIRADA'",
      [e2.id],
    ),
    0,
  );
  assert.equal(
    await count("SELECT count(*) AS n FROM oferta_historial WHERE changed_by LIKE 'reformular:%'"),
    0,
  );

  // REFORMULAR bien: ofertas retiradas con snapshot, aviso a cada ONG con oferta, lotes a rearmar.
  bonita.setPending(e2.caseId, ['Decidir como Continuar']);
  const reformulada = await api(200, decisionUrl, {
    method: 'POST',
    as: COORD,
    body: { camino: 'reformular' },
  });
  assert.equal(reformulada.status, 'registrada');
  assert.deepEqual(bonita.executionsOf(e2.caseId, 'Decidir como Continuar').at(-1).body, {
    camino: 'reformular',
  });
  assert.deepEqual(await ofertaStatuses(e2.id), ['retirada', 'retirada']);
  assert.equal(
    await count(
      'SELECT count(*) AS n FROM oferta_lotes ol JOIN ofertas o ON o.id = ol.oferta_id WHERE o.emergency_id = $1',
      [e2.id],
    ),
    0,
  );
  assert.equal(
    await count("SELECT count(*) AS n FROM oferta_historial WHERE changed_by = 'reformular:coord'"),
    2,
  );
  const retiradas = await pool.query(
    `SELECT o.bonita_org_ref FROM notifications n JOIN ongs o ON o.id = n.ong_id
     WHERE n.emergency_id = $1 AND n.tipo = 'OFERTA_RETIRADA' ORDER BY 1`,
    [e2.id],
  );
  assert.deepEqual(
    retiradas.rows.map((row) => row.bonita_org_ref),
    ['manos-solidarias', 'rescatistas-unidos', 'tercera-ong'],
    'avisan a las ONGs de ambas ofertas, incluida la asociada',
  );
  assert.equal(
    (await pool.query('SELECT validacion_resumen FROM emergencies WHERE id = $1', [e2.id])).rows[0]
      .validacion_resumen,
    null,
  );
  assert.deepEqual((await api(200, `/emergencies/${e2.id}/ofertas`, { as: COORD })).ofertas, []);
  assert.equal(
    (await decidir({ camino: 'continuar' })).status,
    409,
    'solo se decide con la emergencia validada',
  );

  // Rearmar lotes y volver a publicar: ronda nueva, las retiradas no entran al consolidado.
  bonita.setPending(e2.caseId, ['Generar Lotes de Necesidades', 'Publicar Convocatoria']);
  await api(201, `/emergencies/${e2.id}/lotes`, {
    method: 'POST',
    as: COORD,
    body: {
      lotes: [{ resourceType: 'Raciones', resourceCode: 'raciones', quantityRequested: 300 }],
    },
  });
  await api(200, `/emergencies/${e2.id}/convocatoria`, {
    method: 'POST',
    as: COORD,
    body: { duracionMinutos: 10 },
  });
  assert.equal(
    (await pool.query('SELECT convocatoria_ronda FROM emergencies WHERE id = $1', [e2.id])).rows[0]
      .convocatoria_ronda,
    3,
  );
  await internal(200, `/emergencies/${e2.id}/estado`, {
    method: 'PATCH',
    body: { estado: 'convocatoria_cerrada' },
  });
  assert.deepEqual((await internal(200, `/emergencies/${e2.id}/consolidado`)).ofertas, []);

  // =========================================================================
  // 8. Cero ofertas (caso borde)
  // =========================================================================
  await internal(200, `/emergencies/${e2.id}/validaciones`, {
    method: 'POST',
    body: { resultados: [], resumen: { todosLosLotesCubiertos: false, cobertura: [] } },
  });
  assert.equal(await statusOf(e2.id), 'validada', 'con 0 ofertas también se llega a validada');
  const vacia = await api(200, `/emergencies/${e2.id}/ofertas`, { as: COORD });
  assert.deepEqual(vacia.ofertas, []);
  assert.equal(vacia.todosLosLotesCubiertos, false);
  bonita.setPending(e2.caseId, ['Decidir como Continuar']);
  assert.equal((await decidir({ camino: 'reformular' })).status, 200, 'reformular sin ofertas');
  assert.equal(await statusOf(e2.id), 'registrada');

  // =========================================================================
  // 9. Inventario: único camino web-app → SN (E5-23)
  // =========================================================================
  sn.stock.set('rescatistas-unidos', [
    {
      recursoCodigo: 'raciones',
      nombre: 'Raciones',
      cantidadTotal: 100,
      cantidadComprometida: 0,
      cantidadDisponible: 100,
    },
  ]);
  sn.stock.set('manos-solidarias', []);
  await api(401, '/inventario');
  await api(403, '/inventario', { as: OP });
  await api(403, '/inventario', { as: COORD });
  await api(409, '/inventario', { as: { role: 'representante_ong', user: 'sin-ong' } }); // sesión sin ONG
  const stock = await api(200, '/inventario?ongRef=manos-solidarias', { as: ongA });
  assert.equal(stock[0].cantidadTotal, 100);
  assert.deepEqual(
    sn.seen.map((s) => [s.ref, s.auth]),
    [['rescatistas-unidos', 'Bearer token-1']],
    'la ONG sale siempre de la sesión y se usa el token de integración',
  );
  await api(400, '/inventario', { method: 'PUT', as: ongA, body: { recursos: [] } });
  await api(400, '/inventario', {
    method: 'PUT',
    as: ongA,
    body: { recursos: [{ recursoCodigo: 'raciones', cantidadTotal: -1 }] },
  });
  await api(400, '/inventario', {
    method: 'PUT',
    as: ongA,
    body: { recursos: [{ recursoCodigo: 'raciones', cantidadTotal: 1.5 }] },
  });
  const updated = await api(200, '/inventario', {
    method: 'PUT',
    as: ongB,
    body: { recursos: [{ recursoCodigo: ' paramedicos ', cantidadTotal: 8 }] },
  });
  assert.deepEqual(
    updated,
    [{ recursoCodigo: 'paramedicos', cantidadTotal: 8 }],
    'el código se recorta y la ONG es la de la sesión',
  );
  // El SN rechaza bajar el total por debajo de lo comprometido → 409 traducido con detalle.
  sn.conflictOnPut = true;
  const conflict = await api(409, '/inventario', {
    method: 'PUT',
    as: ongA,
    body: { recursos: [{ recursoCodigo: 'raciones', cantidadTotal: 10 }] },
  });
  assert.match(conflict.message, /comprometido/);
  assert.equal(conflict.detalle.insuficientes[0].recursoCodigo, 'raciones');
  sn.conflictOnPut = false;
  // ONG que todavía no existe en el SN.
  const noAlta = await api(409, '/inventario', { as: ongC });
  assert.match(noAlta.message, /no está dada de alta/);
  // Token vencido: renueva (login nuevo) y reintenta sin que la ONG lo note.
  const loginsAntes = sn.loginCount;
  sn.rejectNextToken = true;
  assert.equal((await api(200, '/inventario', { as: ongA }))[0].cantidadTotal, 100);
  assert.equal(sn.loginCount, loginsAntes + 1);
  // SN caído.
  process.env.SISTEMA_NACIONAL_API_URL = 'http://127.0.0.1:1';
  await api(502, '/inventario', { as: ongA });
  process.env.SISTEMA_NACIONAL_API_URL = `http://127.0.0.1:${snPort}`;

  // =========================================================================
  // 10. Permisos transversales y bandeja
  // =========================================================================
  await api(403, `/emergencies/${e1.id}/decision`, {
    method: 'POST',
    as: AUDITOR,
    body: { camino: 'continuar' },
  });
  await api(403, `/emergencies/${e1.id}/adjudicacion`, {
    method: 'POST',
    as: AUDITOR,
    body: { ofertaIds: [randomUUID()] },
  });
  await api(403, `/emergencies/${e1.id}/cierre-ejecucion`, { method: 'POST', as: AUDITOR });
  await api(403, `/ofertas/${ofertas1.A.id}/finalizar`, { method: 'POST', as: AUDITOR });
  await api(403, '/notifications', { as: COORD });
  await api(401, '/notifications');
  await api(401, `/ofertas/${ofertas1.A.id}/finalizar`, { method: 'POST' });
  const inbox = await api(200, '/notifications', { as: ongA });
  const sinLeer = inbox.filter((aviso) => !aviso.leida);
  assert.ok(sinLeer.length > 0);
  await api(200, `/notifications/${sinLeer[0].id}/leida`, { method: 'PATCH', as: ongA });
  await api(404, `/notifications/${sinLeer[1].id}/leida`, { method: 'PATCH', as: ongB }); // aviso de otra ONG
  assert.equal(
    (await api(200, '/notifications', { as: ongA })).filter((aviso) => !aviso.leida).length,
    sinLeer.length - 1,
  );

  console.error = originalConsoleError;
  console.log(
    'PASS: ciclo completo con Bonita y SN simulados — lotes con resourceCode, publicación con duración y compensación, whitelist e historial de estados, consolidado, validaciones (con reintento y 0 ofertas), decisión (continuar/reabrir/reformular con compensación), adjudicación, compromiso fallido y confirmado, avisos por tipo, finalización, cierre de ejecución, inventario contra el SN y permisos por rol.',
  );
} finally {
  console.error = originalConsoleError;
  if (appServer)
    await new Promise((resolve) => {
      appServer.close(resolve);
    });
  bonitaServer.close();
  snServer.close();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
