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

const originalConsoleError = console.error;

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

const SN_URL = (process.env.SN_TEST_URL || 'http://localhost:5000').replace(/\/$/, '');
const snAlive = await fetch(`${SN_URL}/health`, { signal: AbortSignal.timeout(90_000) })
  .then((response) => response.ok)
  .catch(() => false);
if (!snAlive) {
  console.log(
    `SKIP: el Sistema Nacional no responde en ${SN_URL} (levantalo o definí SN_TEST_URL).`,
  );
  bonitaServer.close();
  process.exit(0);
}
process.env.SISTEMA_NACIONAL_API_URL = SN_URL;
process.env.BONITA_API_URL = `http://127.0.0.1:${bonitaServer.address().port}`;

const schema = `sn_test_${randomUUID().replaceAll('-', '')}`;
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
const closedInSn = [];
let snToken;
const snCall = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${SN_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(snToken ? { Authorization: `Bearer ${snToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

try {
  const login = await snCall('/auth/login', {
    method: 'POST',
    body: {
      username: process.env.SN_INTEGRATION_USERNAME,
      password: process.env.SN_INTEGRATION_PASSWORD,
    },
  });
  assert.equal(login.status, 200, 'login de integración en el SN (revisá SN_INTEGRATION_*)');
  snToken = login.body.accessToken;

  // ONGs de la demo en el SN, con stock limitado a propósito.
  const stockWanted = {
    'rescatistas-unidos': [
      { recursoCodigo: 'paramedicos', cantidadTotal: 3 },
      { recursoCodigo: 'raciones', cantidadTotal: 500 },
    ],
    'manos-solidarias': [
      { recursoCodigo: 'paramedicos', cantidadTotal: 2 },
      { recursoCodigo: 'raciones', cantidadTotal: 400 },
    ],
  };
  const niveles = { 'rescatistas-unidos': 3, 'manos-solidarias': 2 };
  // eslint-disable-next-line no-restricted-syntax
  for (const [ref, recursos] of Object.entries(stockWanted)) {
    // eslint-disable-next-line no-await-in-loop
    const created = await snCall('/ongs', {
      method: 'POST',
      body: {
        ref,
        nombre: ref,
        nivelOperativo: niveles[ref],
        username: `${ref}-cuenta`,
        password: 'clave-de-prueba-123',
        recursos,
      },
    });
    if (created.status === 409) {
      // eslint-disable-next-line no-await-in-loop
      const updated = await snCall(`/ongs/${ref}/recursos`, { method: 'PUT', body: recursos });
      assert.equal(updated.status, 200, `ajustar stock de ${ref}: ${JSON.stringify(updated.body)}`);
    } else {
      assert.equal(created.status, 201, `crear ${ref}: ${JSON.stringify(created.body)}`);
    }
  }

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

  const OP = { role: 'operador_municipal', user: 'operador' };
  const COORD = { role: 'coordinador_regional', user: 'coord' };
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
    assert.equal(
      response.status,
      status,
      `${options.method ?? 'GET'} ${path} → ${response.status} ${text}`,
    );
    return text ? JSON.parse(text) : null;
  };
  const internal = (status, path, options = {}) =>
    api(status, `/internal${path}`, { key: KEY, ...options });
  const byCode = (items) => Object.fromEntries(items.map((item) => [item.recursoCodigo, item]));

  const nuevaEmergenciaConOfertas = async () => {
    const created = await api(201, '/emergencies', {
      method: 'POST',
      as: OP,
      body: {
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
      },
    });
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
          { resourceType: 'Paramédicos', resourceCode: 'paramedicos', quantityRequested: 5 },
          { resourceType: 'Raciones', resourceCode: 'raciones', quantityRequested: 1000 },
        ],
      },
    });
    await api(200, `/emergencies/${id}/convocatoria`, {
      method: 'POST',
      as: COORD,
      body: { duracionMinutos: 2 },
    });
    const [l1, l2] = lotes;
    const A = await api(201, `/emergencies/${id}/ofertas`, {
      method: 'POST',
      as: ongA,
      body: {
        items: [
          { loteId: l1.id, quantityOffered: 3 },
          { loteId: l2.id, quantityOffered: 600 },
        ],
      },
    });
    const B = await api(201, `/emergencies/${id}/ofertas`, {
      method: 'POST',
      as: ongB,
      body: {
        items: [
          { loteId: l1.id, quantityOffered: 2 },
          { loteId: l2.id, quantityOffered: 400 },
        ],
      },
    });
    return { id, caseId, A, B };
  };

  // Hace de Bonita: cierra la convocatoria, pide el consolidado, se lo manda al SN y le
  // devuelve a la web-app la respuesta real.
  const cerrarYValidarContraSN = async (e) => {
    await internal(200, `/emergencies/${e.id}/estado`, {
      method: 'PATCH',
      body: { estado: 'convocatoria_cerrada' },
    });
    const consolidado = await internal(200, `/emergencies/${e.id}/consolidado`);
    const validacion = await snCall('/validaciones', { method: 'POST', body: consolidado });
    assert.equal(validacion.status, 200, `SN /validaciones: ${JSON.stringify(validacion.body)}`);
    await internal(200, `/emergencies/${e.id}/validaciones`, {
      method: 'POST',
      body: validacion.body,
    });
    return validacion.body;
  };

  // Hace de Bonita en "Registrar Compromiso de Recursos de ONGS".
  const comprometerEnSN = async (e) => {
    const body = await internal(200, `/emergencies/${e.id}/adjudicacion`);
    closedInSn.push(e.id);
    return snCall('/compromisos', { method: 'POST', body });
  };

  // =========================================================================
  // 1. Validación real: la web-app y el SN se entienden (E5-13, E5-15, E5-16)
  // =========================================================================
  const e1 = await nuevaEmergenciaConOfertas();
  const e2 = await nuevaEmergenciaConOfertas(); // misma demanda: va a competir por el stock
  const validacion1 = await cerrarYValidarContraSN(e1);
  await cerrarYValidarContraSN(e2);

  const perfil = (resultados, oferta) => resultados.find((r) => r.ofertaId === oferta.id);
  assert.equal(
    perfil(validacion1.resultados, e1.A).nivelHabilitacion,
    'PARCIAL',
    'A tiene 500 de 600 raciones',
  );
  assert.equal(perfil(validacion1.resultados, e1.B).nivelHabilitacion, 'PLENO');
  assert.equal(validacion1.resumen.todosLosLotesCubiertos, false);
  const vista = await api(200, `/emergencies/${e1.id}/ofertas`, { as: COORD });
  assert.equal(vista.status, 'validada');
  assert.equal(vista.todosLosLotesCubiertos, false);
  assert.equal(vista.lotes.find((l) => l.resourceCode === 'raciones').cubierta, 900);
  const perfilA = vista.ofertas.find((o) => o.id === e1.A.id).validacion;
  assert.equal(perfilA.nivelHabilitacion, 'PARCIAL');
  assert.ok(perfilA.capacidadesHabilitadas.length === 2);

  // =========================================================================
  // 2. Adjudicación y compromiso real (E5-19)
  // =========================================================================
  const decidirContinuar = async (e) => {
    bonita.setPending(e.caseId, ['Decidir como Continuar']);
    await api(200, `/emergencies/${e.id}/decision`, {
      method: 'POST',
      as: COORD,
      body: { camino: 'continuar' },
    });
  };
  const elegir = async (e) => {
    bonita.setPending(e.caseId, ['Adjudicar Ofertas']);
    await api(200, `/emergencies/${e.id}/adjudicacion`, {
      method: 'POST',
      as: OP,
      body: { ofertaIds: [e.A.id, e.B.id] },
    });
  };
  await decidirContinuar(e1);
  await decidirContinuar(e2);
  await elegir(e1);
  await elegir(e2);

  const cuerpoE1 = await internal(200, `/emergencies/${e1.id}/adjudicacion`);
  assert.deepEqual(
    byCode(cuerpoE1.ofertas.find((o) => o.ofertaId === e1.A.id).items).raciones.cantidad,
    500,
    'se compromete lo habilitado por el SN, no lo ofrecido',
  );
  const compromiso = await comprometerEnSN(e1);
  assert.equal(compromiso.status, 200, JSON.stringify(compromiso.body));
  assert.equal(compromiso.body.compromisos.length, 2);
  // El SN reserva: la ONG lo ve en su inventario (vía la web-app).
  const stockA = byCode(await api(200, '/inventario', { as: ongA }));
  assert.equal(stockA.paramedicos.cantidadComprometida, 3);
  assert.equal(stockA.paramedicos.cantidadDisponible, 0);
  assert.equal(stockA.raciones.cantidadComprometida, 500);

  // Reintento del mismo compromiso (Bonita no vio la respuesta): idempotente, no reserva de nuevo.
  const reintento = await snCall('/compromisos', { method: 'POST', body: cuerpoE1 });
  assert.equal(reintento.status, 200);
  assert.ok(reintento.body.compromisos.every((c) => c.yaExistia === true));
  assert.equal(
    byCode(await api(200, '/inventario', { as: ongA })).raciones.cantidadComprometida,
    500,
  );

  await internal(200, `/emergencies/${e1.id}/compromiso-confirmado`, {
    method: 'POST',
    body: { compromisos: compromiso.body.compromisos },
  });
  await internal(200, `/emergencies/${e1.id}/compromiso-confirmado`, {
    method: 'POST',
    body: { compromisos: compromiso.body.compromisos },
  }); // reintento de Bonita
  const e1Ofertas = await api(200, `/emergencies/${e1.id}/ofertas`, { as: COORD });
  assert.deepEqual(
    e1Ofertas.ofertas.map((o) => o.status),
    ['adjudicada', 'adjudicada'],
  );
  const repartoGuardado = await pool.query(
    'SELECT reparto FROM adjudicaciones WHERE emergency_id = $1 AND oferta_id = $2',
    [e1.id, e1.A.id],
  );
  assert.ok(repartoGuardado.rows[0].reparto.length > 0, 'se guarda el reparto que devolvió el SN');

  // =========================================================================
  // 3. El 409 real por stock compartido entre emergencias (E5-72)
  // =========================================================================
  const stockAntes = await api(200, '/inventario', { as: ongB });
  const rechazo = await comprometerEnSN(e2);
  assert.equal(rechazo.status, 409, JSON.stringify(rechazo.body));
  assert.ok(rechazo.body.detalle.faltante > 0);
  assert.ok(rechazo.body.detalle.recursoCodigo);
  assert.deepEqual(
    await api(200, '/inventario', { as: ongB }),
    stockAntes,
    'el 409 es todo o nada: no reserva nada',
  );
  await internal(200, `/emergencies/${e2.id}/compromiso-fallido`, {
    method: 'POST',
    body: { detalle: rechazo.body.detalle },
  });
  const conflicto = (await api(200, `/emergencies/${e2.id}`, { as: OP })).ultimoConflictoCompromiso;
  assert.equal(conflicto.detalle.ofertaId, rechazo.body.detalle.ofertaId);
  assert.equal(conflicto.detalle.recursoCodigo, rechazo.body.detalle.recursoCodigo);
  assert.deepEqual(
    (await api(200, `/emergencies/${e2.id}/ofertas`, { as: COORD })).ofertas.map((o) => o.status),
    ['validada', 'validada'],
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM notifications WHERE emergency_id = $1 AND tipo IN ('ADJUDICADA','NO_SELECCIONADA')",
        [e2.id],
      )
    ).rows[0].n,
    0,
    'sin aviso de adjudicación si el SN rechazó',
  );

  // =========================================================================
  // 4. Inventario contra el SN real (E5-23)
  // =========================================================================
  const bajar = await api(409, '/inventario', {
    method: 'PUT',
    as: ongA,
    body: { recursos: [{ recursoCodigo: 'paramedicos', cantidadTotal: 1 }] },
  });
  assert.match(bajar.message, /comprometido/);
  assert.ok(bajar.detalle.insuficientes.length > 0);
  await api(400, '/inventario', {
    method: 'PUT',
    as: ongA,
    body: { recursos: [{ recursoCodigo: 'no-existe', cantidadTotal: 1 }] },
  });
  const subido = byCode(
    await api(200, '/inventario', {
      method: 'PUT',
      as: ongA,
      body: { recursos: [{ recursoCodigo: 'paramedicos', cantidadTotal: 4 }] },
    }),
  );
  assert.equal(subido.paramedicos.cantidadTotal, 4);
  assert.equal(subido.paramedicos.cantidadDisponible, 1);
  await api(200, '/inventario', {
    method: 'PUT',
    as: ongA,
    body: { recursos: [{ recursoCodigo: 'paramedicos', cantidadTotal: 3 }] },
  });
  assert.match((await api(409, '/inventario', { as: ongC })).message, /no está dada de alta/);

  // =========================================================================
  // 5. Ejecución, finalización y cierre reales (E5-21, E5-22)
  // =========================================================================
  await internal(200, `/emergencies/${e1.id}/notificaciones`, {
    method: 'POST',
    body: { tipo: 'COMPROMISO' },
  });
  await internal(200, `/emergencies/${e1.id}/estado`, {
    method: 'PATCH',
    body: { estado: 'en_ejecucion' },
  });
  await api(200, `/ofertas/${e1.A.id}/finalizar`, { method: 'POST', as: ongA });
  bonita.setPending(e1.caseId, ['Confirmar cierre de ejecución']);
  await api(409, `/emergencies/${e1.id}/cierre-ejecucion`, { method: 'POST', as: COORD }); // falta B
  await api(200, `/ofertas/${e1.B.id}/finalizar`, { method: 'POST', as: ongB });
  await api(200, `/emergencies/${e1.id}/cierre-ejecucion`, { method: 'POST', as: COORD });

  const { ongRefs } = await internal(200, `/emergencies/${e1.id}/finalizacion`);
  assert.deepEqual([...ongRefs].sort(), ['manos-solidarias', 'rescatistas-unidos']);
  const finalizacion = await snCall(`/emergencias/${e1.id}/finalizacion`, {
    method: 'POST',
    body: { ongRefs },
  });
  assert.equal(finalizacion.status, 200, JSON.stringify(finalizacion.body));
  assert.deepEqual(finalizacion.body.ongsSinFinalizar, []);
  const cierre = await snCall(`/emergencias/${e1.id}/cierre`, { method: 'POST' });
  assert.equal(cierre.status, 200);
  assert.equal(cierre.body.compromisosLiberados, 2);
  await internal(200, `/emergencies/${e1.id}/estado`, {
    method: 'PATCH',
    body: { estado: 'finalizada' },
  });
  const liberado = byCode(await api(200, '/inventario', { as: ongA }));
  assert.equal(liberado.paramedicos.cantidadComprometida, 0, 'el cierre devuelve el stock');
  assert.equal(liberado.raciones.cantidadComprometida, 0);
  assert.equal(
    (await snCall(`/emergencias/${e1.id}/cierre`, { method: 'POST' })).body.compromisosLiberados,
    0,
  );

  // Con el stock liberado, la emergencia que había fallado ahora sí se puede comprometer.
  await elegir(e2);
  const segundo = await comprometerEnSN(e2);
  assert.equal(segundo.status, 200, JSON.stringify(segundo.body));
  await internal(200, `/emergencies/${e2.id}/compromiso-confirmado`, {
    method: 'POST',
    body: { compromisos: segundo.body.compromisos },
  });
  assert.equal(
    (await api(200, `/emergencies/${e2.id}`, { as: OP })).ultimoConflictoCompromiso,
    null,
  );

  console.error = originalConsoleError;
  console.log(
    'PASS: web-app ↔ Sistema Nacional real — consolidado aceptado por /validaciones, respuesta real aceptada y mostrada, compromiso con lo habilitado, idempotencia, 409 todo-o-nada por stock compartido con su detalle, inventario (409 al bajar, 400, 404), finalización y cierre con liberación del stock, y reintento exitoso con el stock liberado.',
  );
} finally {
  console.error = originalConsoleError;
  // Deja el SN sin stock comprometido por este test.
  // eslint-disable-next-line no-restricted-syntax
  for (const id of closedInSn) {
    // eslint-disable-next-line no-await-in-loop
    await snCall(`/emergencias/${id}/cierre`, { method: 'POST' }).catch(() => {});
  }
  if (appServer)
    await new Promise((resolve) => {
      appServer.close(resolve);
    });
  bonitaServer.close();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
