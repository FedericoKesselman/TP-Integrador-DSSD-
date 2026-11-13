// Sin base de datos: node tests/tiempos-etapas.js
// 1) Función pura calcularTiemposEtapas. 2) Ruta GET /api/dashboard/tiempos-etapas con un
// Bonita simulado, con la sesión de Bonita del propio usuario (200, 400, 401, 403, 502).
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

const { calcularTiemposEtapas, parsePeriodo } = await import('../src/dashboard/tiempos-etapas.js');

// ---------------------------------------------------------------------------
// Función pura
// ---------------------------------------------------------------------------
const t = (caseId, name, date) => ({ caseId, name, date });
const ETAPAS = [
  'registro_publicacion',
  'ventana_ofertas',
  'validacion_adjudicacion',
  'ejecucion',
  'total',
];

// Sin datos: siempre las 5 etapas, en orden, con null.
const vacio = calcularTiemposEtapas([], []);
assert.deepEqual(
  vacio.etapas.map((e) => e.etapa),
  ETAPAS,
);
assert.equal(vacio.casosAnalizados, 0);
assert.deepEqual(vacio.periodo, { desde: null, hasta: null });
assert.deepEqual(vacio.etapas[0], {
  etapa: 'registro_publicacion',
  casos: 0,
  promedioMinutos: null,
  minMinutos: null,
  maxMinutos: null,
});

// Dos casos, redondeo a 1 decimal (2,1 min y 5 min → promedio 3,55 → 3,6) y min/max.
const casos = [
  { id: 1, start: '2026-11-02 10:00:00.000', end: '2026-11-02 12:00:00.000' },
  { id: 2, start: '2026-11-05 09:00:00.000', end: null },
];
const tareas = [
  t(1, 'Registrar Emergencia', '2026-11-02 10:00:00.000'),
  t(1, 'Publicar Convocatoria', '2026-11-02 10:02:06.000'), // 2,1 min
  t(2, 'Registrar Emergencia', '2026-11-05 09:00:00.000'),
  t(2, 'Publicar Convocatoria', '2026-11-05 09:05:00.000'), // 5 min
];
const r = calcularTiemposEtapas(casos, tareas);
assert.equal(r.casosAnalizados, 2);
assert.deepEqual(r.etapas[0], {
  etapa: 'registro_publicacion',
  casos: 2,
  promedioMinutos: 3.6,
  minMinutos: 2.1,
  maxMinutos: 5,
});
// Caso sin una punta (sin "Notificar Cierre…") no cuenta; etapa vacía → null.
assert.equal(r.etapas[1].casos, 0);
assert.equal(r.etapas[1].promedioMinutos, null);
// "total" solo cuenta casos terminados: el caso 2 está abierto.
assert.equal(r.etapas[4].casos, 1);
assert.equal(r.etapas[4].promedioMinutos, 120);

// Reabrir: "Publicar Convocatoria" y "Notificar Cierre…" se repiten → primera aparición del
// inicio y última del fin.
const reabrir = calcularTiemposEtapas(
  [{ id: 7, start: '2026-11-10 08:00:00', end: null }],
  [
    t(7, 'Publicar Convocatoria', '2026-11-10 08:10:00.000'),
    t(7, 'Notificar Cierre de Convocatoria a ONGS', '2026-11-10 08:20:00.000'),
    t(7, 'Publicar Convocatoria', '2026-11-10 08:30:00.000'),
    t(7, 'Notificar Cierre de Convocatoria a ONGS', '2026-11-10 08:40:00.000'),
  ],
);
assert.equal(reabrir.etapas[1].casos, 1);
assert.equal(reabrir.etapas[1].promedioMinutos, 30); // 08:10 → 08:40

// Tareas de otros casos (fuera del período) se ignoran.
const filtrado = calcularTiemposEtapas(casos, tareas, { desde: '2026-11-05', hasta: '2026-11-05' });
assert.equal(filtrado.casosAnalizados, 1);
assert.deepEqual(filtrado.periodo, { desde: '2026-11-05', hasta: '2026-11-05' });
assert.equal(filtrado.etapas[0].promedioMinutos, 5);
// Límites inclusivos: el día 2 entra con hasta = 2 y no entra con desde = 3.
assert.equal(calcularTiemposEtapas(casos, tareas, { hasta: '2026-11-02' }).casosAnalizados, 1);
assert.equal(calcularTiemposEtapas(casos, tareas, { desde: '2026-11-03' }).casosAnalizados, 1);
assert.equal(calcularTiemposEtapas(casos, tareas, { desde: '2026-12-01' }).casosAnalizados, 0);

// Fechas inválidas.
assert.throws(() => parsePeriodo({ desde: '2026-13-01' }), { status: 400 });
assert.throws(() => parsePeriodo({ desde: '2026-02-30' }), { status: 400 });
assert.throws(() => parsePeriodo({ hasta: 'ayer' }), { status: 400 });
assert.throws(() => parsePeriodo({ desde: ['2026-11-01', '2026-11-02'] }), { status: 400 });
assert.throws(() => parsePeriodo({ desde: '2026-11-10', hasta: '2026-11-01' }), { status: 400 });
assert.deepEqual(parsePeriodo({ desde: '2026-11-01', hasta: '2026-11-01' }), {
  desde: '2026-11-01',
  hasta: '2026-11-01',
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Ruta con Bonita simulado (sesión de Bonita del usuario logueado)
// ---------------------------------------------------------------------------
// Sesiones: 'admin' lee todo; 'usuario' recibe 403 (sin perfil Administrador); cualquier
// otra (ej. 'vencida') recibe 401.
const bonita = { hits: [], logins: 0 };
const bonitaServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname.endsWith('/loginservice')) bonita.logins += 1; // no debería usarse
  assert.equal(req.method, 'GET'); // solo GET contra Bonita
  const sid = /JSESSIONID=(\w+)/.exec(req.headers.cookie ?? '')?.[1];
  assert.equal(req.headers['x-bonita-api-token'], 'tok');
  if (sid === 'usuario') return json(403, {});
  if (sid !== 'admin') return json(401, {});
  const api = url.pathname.replace('/bonita/API/', '');
  const f = url.searchParams.getAll('f');
  bonita.hits.push(`${api}?${f.join('&')}`);
  if (api === 'bpm/process') return json(200, [{ id: '11' }, { id: '12' }]);
  if (api === 'bpm/case') {
    return json(
      200,
      f.includes('processDefinitionId=11') ? [{ id: '2', start: '2026-11-05 09:00:00.000' }] : [],
    );
  }
  if (api === 'bpm/archivedCase') {
    return json(
      200,
      f.includes('processDefinitionId=12')
        ? [
            {
              sourceObjectId: '1',
              state: 'completed',
              start: '2026-11-02 10:00:00.000',
              end_date: '2026-11-02 12:00:00.000',
            },
          ]
        : [],
    );
  }
  if (api === 'bpm/archivedActivity') {
    assert.ok(f.includes('state=completed'));
    const date = (m) => `2026-11-0${f.includes('caseId=1') ? 2 : 5} 10:0${m}:00.000`;
    return json(200, [
      { name: 'Registrar Emergencia', reached_state_date: date(0) },
      { name: 'Publicar Convocatoria', reached_state_date: date(4) },
    ]);
  }
  return json(404, {});
});
await new Promise((resolve) => {
  bonitaServer.listen(0, '127.0.0.1', resolve);
});
process.env.BONITA_API_URL = `http://127.0.0.1:${bonitaServer.address().port}/bonita`;

const { default: dashboardRouter } = await import('../src/routes/dashboard-routes.js');
const app = express();
app.use((req, res, next) => {
  const role = req.get('x-test-role');
  if (role) {
    req.session = { username: role, role };
    const sid = req.get('x-test-sid');
    if (sid) req.session.bonita = { jsessionId: sid, apiToken: 'tok' };
  }
  next();
});
app.use('/api/dashboard', dashboardRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => {
  server.once('listening', resolve);
});
const base = `http://127.0.0.1:${server.address().port}/api/dashboard/tiempos-etapas`;
const get = (qs = '', { role = 'auditor', sid = 'admin' } = {}) => {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (sid) headers['x-test-sid'] = sid;
  return fetch(base + qs, { headers });
};

try {
  // Permisos por rol: no se llega a Bonita.
  assert.equal((await get('', { role: null })).status, 401);
  assert.equal((await get('', { role: 'representante_ong' })).status, 403);
  assert.equal((await get('', { role: 'coordinador_regional' })).status, 403);
  assert.equal(bonita.hits.length, 0);

  // 200: caso 1 (archivado, 4 min) y caso 2 (abierto, 4 min); proceso con 2 versiones.
  const ok = await get();
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.casosAnalizados, 2);
  assert.equal(body.etapas[0].casos, 2);
  assert.equal(body.etapas[0].promedioMinutos, 4);
  assert.equal(body.etapas[4].casos, 1); // total: solo el terminado
  assert.equal(body.etapas[4].promedioMinutos, 120);

  // Filtro por fecha: solo el caso 2; no se piden las tareas del caso 1.
  bonita.hits.length = 0;
  const filtrado2 = await (await get('?desde=2026-11-04&hasta=2026-11-30')).json();
  assert.equal(filtrado2.casosAnalizados, 1);
  assert.deepEqual(filtrado2.periodo, { desde: '2026-11-04', hasta: '2026-11-30' });
  assert.ok(!bonita.hits.some((h) => h.includes('caseId=1')));

  // 400: fechas inválidas, sin tocar Bonita.
  bonita.hits.length = 0;
  assert.equal((await get('?desde=2026-11-31')).status, 400);
  assert.equal((await get('?desde=2026-13-01')).status, 400);
  assert.equal((await get('?desde=2026-11-10&hasta=2026-11-01')).status, 400);
  assert.equal(bonita.hits.length, 0);

  // 401: Bonita rechaza la sesión del usuario (venció), o la sesión no trae sesión de Bonita.
  const vencida = await get('', { sid: 'vencida' });
  assert.equal(vencida.status, 401);
  assert.deepEqual(await vencida.json(), {
    message: 'Tu sesión de Bonita venció. Volvé a iniciar sesión.',
  });
  assert.equal((await get('', { sid: null })).status, 401);

  // 403 de Bonita (usuario sin perfil Administrador) → 502 con el mensaje del contrato.
  const sinPerfil = await get('', { sid: 'usuario' });
  assert.equal(sinPerfil.status, 502);
  assert.deepEqual(await sinPerfil.json(), {
    message:
      'Bonita rechazó la consulta: el usuario auditor necesita perfil Administrador en Bonita.',
  });

  // El servidor nunca hace login propio: solo usa la sesión del usuario.
  assert.equal(bonita.logins, 0);

  // Bonita no responde → 502.
  await new Promise((resolve) => {
    bonitaServer.close(resolve);
  });
  const caido = await get();
  assert.equal(caido.status, 502);
  assert.ok((await caido.json()).message);

  console.log('tiempos-etapas: OK');
} finally {
  server.close();
  bonitaServer.close();
  process.exit(process.exitCode ?? 0);
}
