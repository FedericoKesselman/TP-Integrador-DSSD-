// Run against a development PostgreSQL database: node tests/dashboard.integration.js.
// Schema descartable con todas las migraciones; prueba GET /api/dashboard/indicadores,
// /tiempos-etapas y /export (con un Bonita simulado y la sesión de Bonita del propio auditor).
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import http from 'node:http';
import express from 'express';
import pg from 'pg';

const schema = `dash_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.searchParams.set('options', `-c search_path=${schema},public`);
process.env.DATABASE_URL = dbUrl.toString();

const { default: pool } = await import('../src/db.js');
// Bonita simulado. Sesiones: 'admin' lee todo; 'usuario' recibe 403 (sin perfil Administrador);
// cualquier otra (ej. 'vencida') recibe 401. Casos: 1 (archivado), 2 y 3 (abiertos).
const bonita = { hits: [], logins: 0, caido: false };
const bonitaServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname.endsWith('/loginservice')) bonita.logins += 1; // no debería usarse
  assert.equal(req.method, 'GET'); // solo GET contra Bonita
  if (bonita.caido) return req.socket.destroy();
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
      f.includes('processDefinitionId=11')
        ? [
            { id: '2', start: '2026-11-05 09:00:00.000' },
            { id: '3', start: '2026-11-06 09:00:00.000' },
          ]
        : [],
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
    if (role) {
      req.session = { username: role, role };
      const sid = req.get('x-test-sid');
      if (sid) req.session.bonita = { jsessionId: sid, apiToken: 'tok' };
    }
    next();
  });
  app.use('/api/dashboard', dashboardRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => {
    server.once('listening', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}/api/dashboard`;
  const url = `${base}/indicadores`;
  const get = (role, qs = '') => fetch(url + qs, { headers: role ? { 'x-test-role': role } : {} });
  const call = (path, { role = 'auditor', sid = 'admin' } = {}) => {
    const headers = {};
    if (role) headers['x-test-role'] = role;
    if (sid) headers['x-test-sid'] = sid;
    return fetch(base + path, { headers });
  };

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
    if (['adjudicada', 'finalizada'].includes(status))
      await q(
        "INSERT INTO adjudicaciones (emergency_id, oferta_id, created_at) VALUES ($1, $2, '2026-09-15T12:00:00Z')",
        [eid, id],
      );
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

  // Tocar una oferta ya adjudicada (ej. finalizarla meses después) no mueve el mes del suministro.
  await q("UPDATE ofertas SET updated_at = '2026-11-10T09:00:00Z' WHERE status = 'finalizada'");

  const data = await (await get('auditor')).json();
  const mes = '2026-09';
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

  assert.deepEqual(data.periodo, { desde: null, hasta: null });

  // Período: se elige por fecha de alta de la emergencia (día de Argentina, UTC-3, inclusivo).
  // E1 el 10/9; E2 el 1/10 02:30 UTC = 30/9 23:30 en Argentina; E3 el 20/12.
  await q("UPDATE emergencies SET created_at = '2026-09-10T12:00:00Z' WHERE id = $1", [e1]);
  await q("UPDATE emergencies SET created_at = '2026-10-01T02:30:00Z' WHERE id = $1", [e2]);
  await q("UPDATE emergencies SET created_at = '2026-12-20T15:00:00Z' WHERE id = $1", [e3]);
  const indicadores = async (qs) => {
    const r = await get('auditor', qs);
    assert.equal(r.status, 200);
    return r.json();
  };
  const resumen = (d) => ({
    periodo: d.periodo,
    suministros: d.suministrosMovilizados.map((s) => s.cantidad),
    estados: Object.fromEntries(d.estadoProyectos.map((s) => [s.estado, s.cantidad])),
    finalizadas: d.resolucionConsorcios.emergenciasFinalizadas,
    conConsorcio: d.resolucionConsorcios.conConsorcio,
    lotes: d.coberturaLotes.lotes,
    cobertura: d.coberturaLotes.promedioPorcentaje,
  });

  // Septiembre (E2 entra por su día en Argentina): sin E3.
  assert.deepEqual(resumen(await indicadores('?desde=2026-09-01&hasta=2026-09-30')), {
    periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
    suministros: [180],
    estados: { finalizada: 2 },
    finalizadas: 2,
    conConsorcio: 1,
    lotes: 2,
    cobertura: 75,
  });
  // Un solo día: E1 (límites inclusivos desde = hasta).
  assert.deepEqual(resumen(await indicadores('?desde=2026-09-10&hasta=2026-09-10')), {
    periodo: { desde: '2026-09-10', hasta: '2026-09-10' },
    suministros: [130],
    estados: { finalizada: 1 },
    finalizadas: 1,
    conConsorcio: 1,
    lotes: 1,
    cobertura: 100,
  });
  // E2 queda el 30/9 en Argentina aunque en UTC ya sea 1/10.
  assert.deepEqual(
    resumen(await indicadores('?desde=2026-09-30&hasta=2026-09-30')).suministros,
    [50],
  );
  assert.deepEqual(resumen(await indicadores('?hasta=2026-09-29')).estados, { finalizada: 1 });
  // Solo desde: E3 (registrada, sin cobertura).
  assert.deepEqual(resumen(await indicadores('?desde=2026-10-01')), {
    periodo: { desde: '2026-10-01', hasta: null },
    suministros: [],
    estados: { registrada: 1 },
    finalizadas: 0,
    conConsorcio: 0,
    lotes: 1,
    cobertura: 0,
  });
  // Período sin emergencias: todo vacío.
  const sinDatos = await indicadores('?desde=2027-01-01&hasta=2027-01-31');
  assert.deepEqual(sinDatos.estadoProyectos, []);
  assert.equal(sinDatos.coberturaLotes.promedioPorcentaje, 0);
  // 400: formato inválido, día inexistente, desde > hasta.
  assert.equal((await get('auditor', '?desde=ayer')).status, 400);
  assert.equal((await get('auditor', '?hasta=2026-02-30')).status, 400);
  assert.equal((await get('auditor', '?desde=2026-10-01&hasta=2026-09-01')).status, 400);

  // --- tiempos-etapas (Bonita simulado) -----------------------------------------------
  // E1 ↔ caso 1 (incendio, archivado), E2 ↔ caso 2 (inundacion, abierto); caso 3 sin emergencia.
  await q("UPDATE emergencies SET bonita_case_id = '1' WHERE id = $1", [e1]);
  await q("UPDATE emergencies SET bonita_case_id = '2', type = 'inundacion' WHERE id = $1", [e2]);

  // Permisos por rol: no se llega a Bonita.
  assert.equal((await call('/tiempos-etapas', { role: null })).status, 401);
  assert.equal((await call('/tiempos-etapas', { role: 'representante_ong' })).status, 403);
  assert.equal((await call('/export?formato=json', { role: 'coordinador_regional' })).status, 403);
  assert.equal(bonita.hits.length, 0);

  const ok = await call('/tiempos-etapas');
  assert.equal(ok.status, 200);
  const tiempos = await ok.json();
  assert.equal(tiempos.casosAnalizados, 3);
  assert.equal(tiempos.etapas[0].casos, 3);
  assert.equal(tiempos.etapas[0].promedioMinutos, 4);
  assert.equal(tiempos.etapas[4].casos, 1); // total: solo el terminado
  assert.equal(tiempos.etapas[4].promedioMinutos, 120);
  // porTipo: el caso 3 no tiene emergencia → fuera de porTipo; orden inundacion, incendio.
  assert.deepEqual(
    tiempos.porTipo.map((x) => [x.tipo, x.casosAnalizados]),
    [
      ['inundacion', 1],
      ['incendio', 1],
    ],
  );
  assert.equal(tiempos.porTipo[0].etapas.length, 5);
  assert.equal(tiempos.porTipo[0].etapas[0].promedioMinutos, 4);
  assert.equal(tiempos.porTipo[0].etapas[4].casos, 0);
  assert.equal(tiempos.porTipo[1].etapas[4].promedioMinutos, 120);

  // Filtro por fecha de inicio del caso: solo los casos 2 y 3; no se piden tareas del caso 1.
  bonita.hits.length = 0;
  const filtrado = await (await call('/tiempos-etapas?desde=2026-11-04&hasta=2026-11-30')).json();
  assert.equal(filtrado.casosAnalizados, 2);
  assert.deepEqual(filtrado.periodo, { desde: '2026-11-04', hasta: '2026-11-30' });
  assert.deepEqual(
    filtrado.porTipo.map((x) => x.tipo),
    ['inundacion'],
  );
  assert.ok(!bonita.hits.some((h) => h.includes('caseId=1')));
  // Sin casos en el período: porTipo vacío.
  assert.deepEqual((await (await call('/tiempos-etapas?desde=2027-01-01')).json()).porTipo, []);

  // 400 sin tocar Bonita; 401 / 502 de Bonita.
  bonita.hits.length = 0;
  assert.equal((await call('/tiempos-etapas?desde=2026-11-31')).status, 400);
  assert.equal((await call('/tiempos-etapas?desde=2026-11-10&hasta=2026-11-01')).status, 400);
  assert.equal(bonita.hits.length, 0);
  const vencida = await call('/tiempos-etapas', { sid: 'vencida' });
  assert.equal(vencida.status, 401);
  assert.deepEqual(await vencida.json(), {
    message: 'Tu sesión de Bonita venció. Volvé a iniciar sesión.',
  });
  assert.equal((await call('/tiempos-etapas', { sid: null })).status, 401);
  const sinPerfil = await call('/tiempos-etapas', { sid: 'usuario' });
  assert.equal(sinPerfil.status, 502);
  assert.deepEqual(await sinPerfil.json(), {
    message:
      'Bonita rechazó la consulta: el usuario auditor necesita perfil Administrador en Bonita.',
  });

  // --- export -------------------------------------------------------------------------
  const hoy = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const adjunto = (parte, ext) =>
    `attachment; filename="rescuesync-dashboard-${parte}-${hoy}.${ext}"`;

  // 400 sin tocar Bonita.
  bonita.hits.length = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const qs of [
    '',
    '?formato=xml',
    '?formato=csv',
    '?formato=csv&dataset=otro',
    '?formato=json&desde=hoy',
    '?formato=csv&dataset=suministros&desde=2026-10-01&hasta=2026-09-01',
  ]) {
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await call(`/export${qs}`)).status, 400, qs);
  }
  assert.equal(bonita.hits.length, 0);

  // JSON completo (adjunto): mismas formas que los otros dos endpoints.
  const json = await call('/export?formato=json&desde=2026-09-01&hasta=2026-12-31');
  assert.equal(json.status, 200);
  assert.equal(json.headers.get('content-disposition'), adjunto('completo', 'json'));
  const exp = await json.json();
  assert.ok(!Number.isNaN(Date.parse(exp.generadoAt)));
  assert.deepEqual(exp.periodo, { desde: '2026-09-01', hasta: '2026-12-31' });
  assert.deepEqual(exp.indicadores, await indicadores('?desde=2026-09-01&hasta=2026-12-31'));
  assert.deepEqual(
    exp.tiemposEtapas,
    await (await call('/tiempos-etapas?desde=2026-09-01&hasta=2026-12-31')).json(),
  );
  assert.deepEqual(exp.avisos, []);

  // JSON con Bonita fallando: 200, tiemposEtapas null y aviso con el mensaje del error.
  const jsonVencida = await call('/export?formato=json', { sid: 'vencida' });
  assert.equal(jsonVencida.status, 200);
  const expVencida = await jsonVencida.json();
  assert.equal(expVencida.tiemposEtapas, null);
  assert.deepEqual(expVencida.avisos, ['Tu sesión de Bonita venció. Volvé a iniciar sesión.']);
  assert.equal(expVencida.indicadores.estadoProyectos.length, 2);
  assert.equal((await (await call('/export?formato=json', { sid: null })).json()).avisos.length, 1);

  // CSV propios (sin Bonita: andan aun con la sesión de Bonita vencida).
  const csv = async (dataset, opts, qs = '') => {
    const r = await call(`/export?formato=csv&dataset=${dataset}${qs}`, opts);
    return { r, text: await r.text() };
  };
  let res = await csv('suministros', { sid: 'vencida' });
  assert.equal(res.r.status, 200);
  assert.match(res.r.headers.get('content-type'), /^text\/csv; charset=utf-8/);
  assert.equal(res.r.headers.get('content-disposition'), adjunto('suministros', 'csv'));
  assert.equal(res.text, 'mes,recursoCodigo,cantidad\n2026-09,raciones,180\n');
  res = await csv('suministros', {}, '&desde=2027-01-01');
  assert.equal(res.text, 'mes,recursoCodigo,cantidad\n'); // sin filas: solo encabezado

  // Escaping: coma, comillas y salto de línea van entre comillas dobles.
  await q('UPDATE emergencies SET municipality = E\'Pila, "Norte"\\nSur\' WHERE id = $1', [e3]);
  res = await csv('estado-proyectos', {}, '&desde=2026-10-01');
  assert.equal(
    res.text,
    'estado,id,type,severity,province,municipality,createdAt\n' +
      `registrada,${e3},incendio,alta,Buenos Aires,"Pila, ""Norte""\nSur",2026-12-20T15:00:00.000Z\n`,
  );

  // CSV de tiempos (Bonita); null → campo vacío.
  res = await csv('tiempos-etapas', {});
  assert.equal(res.r.status, 200);
  assert.equal(res.r.headers.get('content-disposition'), adjunto('tiempos-etapas', 'csv'));
  const lineas = res.text.trimEnd().split('\n');
  assert.equal(lineas[0], 'etapa,casos,promedioMinutos,minMinutos,maxMinutos');
  assert.equal(lineas[1], 'registro_publicacion,3,4,4,4');
  assert.equal(lineas[2], 'ventana_ofertas,0,,,');
  assert.equal(lineas[5], 'total,1,120,120,120');
  assert.equal(lineas.length, 6);
  res = await csv('tiempos-por-tipo', {});
  assert.equal(res.r.headers.get('content-disposition'), adjunto('tiempos-por-tipo', 'csv'));
  const porTipo = res.text.trimEnd().split('\n');
  assert.equal(porTipo[0], 'tipo,etapa,casos,promedioMinutos,minMinutos,maxMinutos');
  assert.equal(porTipo[1], 'inundacion,registro_publicacion,1,4,4,4');
  assert.equal(porTipo.length, 11); // encabezado + 2 tipos × 5 etapas
  assert.equal(porTipo[6], 'incendio,registro_publicacion,1,4,4,4');
  // Con Bonita fallando: el mismo error que tiempos-etapas.
  // eslint-disable-next-line no-restricted-syntax
  for (const dataset of ['tiempos-etapas', 'tiempos-por-tipo']) {
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await csv(dataset, { sid: 'vencida' })).r.status, 401);
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await csv(dataset, { sid: 'usuario' })).r.status, 502);
  }

  // El servidor nunca hace login propio: solo usa la sesión del usuario.
  assert.equal(bonita.logins, 0);

  // Bonita no responde → 502 (tiempos-etapas y csv) y aviso (export json).
  bonita.caido = true;
  assert.equal((await call('/tiempos-etapas')).status, 502);
  assert.equal((await csv('tiempos-etapas', {})).r.status, 502);
  const jsonCaido = await (await call('/export?formato=json')).json();
  assert.equal(jsonCaido.tiemposEtapas, null);
  assert.deepEqual(jsonCaido.avisos, ['No se pudo conectar con Bonita.']);

  console.log(
    'PASS: /api/dashboard — indicadores (permisos, vacío, período), tiempos-etapas (porTipo) y export.',
  );
} finally {
  bonitaServer.closeAllConnections();
  bonitaServer.close();
  if (server)
    await new Promise((resolve) => {
      server.close(resolve);
    });
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
