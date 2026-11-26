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
    const caso1 = f.includes('caseId=1');
    // "Cargar ofertas" la corta el temporizador: queda abortada (solo esa tarea se pide así).
    if (f.includes('state=aborted')) {
      return json(
        200,
        caso1
          ? [
              {
                name: 'Cargar ofertas (Parcial / Completa)',
                reached_state_date: '2026-11-02 10:34:00.000',
              },
              { name: 'Otra tarea abortada', reached_state_date: '2026-11-02 11:00:00.000' },
            ]
          : [],
      );
    }
    assert.ok(f.includes('state=completed'));
    const date = (m) => `2026-11-0${caso1 ? 2 : 5} 10:0${m}:00.000`;
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
  assert.deepEqual(vacio.suministrosPorRecurso, []);
  assert.equal(vacio.resolucionConsorcios.porcentaje, 0);
  assert.deepEqual(vacio.coberturaLotes, { emergencias: 0, lotes: 0, promedioPorcentaje: null });
  assert.deepEqual(vacio.caminosDecision, {
    todosCubiertos: 0,
    continuar: 0,
    reabrir: 0,
    reformular: 0,
  });

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
  // `reparto`: [[recursoCodigo, cantidad]] que comprometió el SN (puede ser menos que lo ofrecido).
  // `habilitado`: [[loteId, cantidad]] de la validación del SN; por defecto, lo ofrecido.
  const oferta = async (eid, status, ongs, items, reparto, habilitado = items) => {
    const { id } = (
      await q('INSERT INTO ofertas (emergency_id, status) VALUES ($1, $2) RETURNING id', [
        eid,
        status,
      ])
    )[0];
    if (['adjudicada', 'finalizada'].includes(status))
      await q(
        `INSERT INTO adjudicaciones (emergency_id, oferta_id, reparto, created_at)
         VALUES ($1, $2, $3::jsonb, '2026-09-15T12:00:00Z')`,
        [
          eid,
          id,
          reparto &&
            JSON.stringify(
              reparto.map(([recursoCodigo, cantidad]) => ({ recursoCodigo, cantidad })),
            ),
        ],
      );
    if (['adjudicada', 'finalizada'].includes(status))
      await q(
        `INSERT INTO oferta_validaciones (oferta_id, nivel_habilitacion, rol_sugerido,
           nivel_riesgo_permitido, capacidades)
         VALUES ($1, 'PLENO', 'principal', 'alta', $2::jsonb)`,
        [
          id,
          JSON.stringify(
            habilitado.map(([loteId, cantidadHabilitada]) => ({ loteId, cantidadHabilitada })),
          ),
        ],
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
  await oferta(e1, 'finalizada', [a, b], [[l1, 60]], [['raciones', 60]]);
  // Ofreció 70 pero el SN comprometió 55: lo movilizado es 115 (> 100 pedidos → tope 100).
  await oferta(e1, 'adjudicada', [c], [[l1, 70]], [['raciones', 55]]);
  await oferta(e1, 'no_seleccionada', [a], [[l1, 999]]); // no cuenta
  await oferta(e2, 'finalizada', [a], [[l2, 50]], [['raciones', 30]]); // ofreció 50, comprometió 30
  await oferta(e3, 'registrada', [a, b], [[l3, 10]]); // no cuenta

  // E2 se adjudicó el 30/9 a las 23:30 en Argentina (1/10 02:30 UTC): su mes es 2026-09.
  await q("UPDATE adjudicaciones SET created_at = '2026-10-01T02:30:00Z' WHERE emergency_id = $1", [
    e2,
  ]);

  // Tocar una oferta ya adjudicada (ej. finalizarla meses después) no mueve el mes del suministro.
  await q("UPDATE ofertas SET updated_at = '2026-11-10T09:00:00Z' WHERE status = 'finalizada'");

  const data = await (await get('auditor')).json();
  const mes = '2026-09';
  assert.deepEqual(data.suministrosMovilizados, [
    { mes, recursoCodigo: 'raciones', cantidad: 145 },
  ]);
  assert.deepEqual(data.resolucionConsorcios, {
    emergenciasFinalizadas: 2,
    conConsorcio: 1,
    porcentaje: 50,
  });
  const estados = Object.fromEntries(data.estadoProyectos.map((s) => [s.estado, s.cantidad]));
  assert.deepEqual(estados, { finalizada: 2, registrada: 1 });
  assert.equal(data.estadoProyectos.find((s) => s.estado === 'registrada').emergencias[0].id, e3);
  // Solo cuentan las emergencias adjudicadas: E1 100% y E2 50% (el lote de E3, registrada, no).
  assert.deepEqual(data.coberturaLotes, { emergencias: 2, lotes: 2, promedioPorcentaje: 75 });

  // E1: 100 pedidos, el SN comprometió 60+55: movilizado 115, cubierto con tope 100. E2: 100
  // pedidos, comprometió 30 (ofrecidas 50). E3 (registrada) y la no_seleccionada no cuentan.
  assert.deepEqual(data.suministrosPorRecurso, [
    { recursoCodigo: 'raciones', pedido: 200, movilizado: 145, porcentajeCubierto: 65 },
  ]);

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
    suministros: [145],
    estados: { finalizada: 2 },
    finalizadas: 2,
    conConsorcio: 1,
    lotes: 2,
    cobertura: 75,
  });
  // Un solo día: E1 (límites inclusivos desde = hasta).
  assert.deepEqual(resumen(await indicadores('?desde=2026-09-10&hasta=2026-09-10')), {
    periodo: { desde: '2026-09-10', hasta: '2026-09-10' },
    suministros: [115],
    estados: { finalizada: 1 },
    finalizadas: 1,
    conConsorcio: 1,
    lotes: 1,
    cobertura: 100,
  });
  // Período de E1 solo: movilizado supera lo pedido, porcentaje topado en 100.
  assert.deepEqual(
    (await indicadores('?desde=2026-09-10&hasta=2026-09-10')).suministrosPorRecurso,
    [{ recursoCodigo: 'raciones', pedido: 100, movilizado: 115, porcentajeCubierto: 100 }],
  );
  // E2 queda el 30/9 en Argentina aunque en UTC ya sea 1/10.
  assert.deepEqual(
    resumen(await indicadores('?desde=2026-09-30&hasta=2026-09-30')).suministros,
    [30],
  );
  assert.deepEqual(resumen(await indicadores('?hasta=2026-09-29')).estados, { finalizada: 1 });
  // Solo desde: E3 (registrada, todavía sin adjudicar → sin cobertura final).
  assert.deepEqual(resumen(await indicadores('?desde=2026-10-01')), {
    periodo: { desde: '2026-10-01', hasta: null },
    suministros: [],
    estados: { registrada: 1 },
    finalizadas: 0,
    conConsorcio: 0,
    lotes: 0,
    cobertura: null,
  });
  // Período sin emergencias: todo vacío.
  const sinDatos = await indicadores('?desde=2027-01-01&hasta=2027-01-31');
  assert.deepEqual(sinDatos.estadoProyectos, []);
  assert.equal(sinDatos.coberturaLotes.promedioPorcentaje, null);
  assert.deepEqual(sinDatos.suministrosPorRecurso, []);
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
  assert.equal(tiempos.etapas[1].casos, 1); // ventana: "Cargar ofertas" abortada del caso 1
  assert.equal(tiempos.etapas[1].promedioMinutos, 30);
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
  assert.equal(res.text, 'mes,recursoCodigo,cantidad\n2026-09,raciones,145\n');
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
  assert.equal(lineas[2], 'ventana_ofertas,1,30,30,30'); // caso 1: 10:04 → 10:34 (abortada)
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

  // --- caminos de decisión y cobertura final (período aparte: marzo 2027) ---------------
  const marzo = '?desde=2027-03-01&hasta=2027-03-31';
  const enMarzo = async (status, cubiertos) => {
    const id = await emergency(status);
    await q(
      "UPDATE emergencies SET created_at = '2027-03-10T12:00:00Z', validacion_resumen = $2 WHERE id = $1",
      [id, cubiertos === undefined ? null : JSON.stringify({ todosLosLotesCubiertos: cubiertos })],
    );
    return id;
  };
  const decision = (id, camino) =>
    q('INSERT INTO emergency_decisiones (emergency_id, camino, decided_by) VALUES ($1,$2,$3)', [
      id,
      camino,
      'coord',
    ]);
  const eA = await enMarzo('adjudicada', true);
  const eB = await enMarzo('convocatoria_abierta', false); // en curso: no cuenta
  const eC = await enMarzo('en_ejecucion', false);
  await enMarzo('finalizada'); // sin validacion_resumen: no cuenta en caminos
  await oferta(eA, 'adjudicada', [a], [[await lote(eA, 'raciones', 100), 40]], [['raciones', 40]]);
  await lote(eB, 'mantas', 100); // sin cubrir, pero la emergencia no está adjudicada
  await oferta(eC, 'adjudicada', [b], [[await lote(eC, 'mantas', 50), 50]], [['mantas', 50]]);
  await decision(eA, 'reabrir');
  await decision(eA, 'reabrir'); // dos reabrir en la misma emergencia: suman las dos
  await decision(eB, 'reabrir'); // cuenta aunque la emergencia siga en curso
  await decision(eC, 'reformular');
  await decision(eC, 'continuar');
  await decision(e1, 'reabrir'); // fuera de marzo
  const dm = await indicadores(marzo);
  assert.deepEqual(dm.coberturaLotes, { emergencias: 2, lotes: 2, promedioPorcentaje: 70 });
  assert.deepEqual(dm.caminosDecision, {
    todosCubiertos: 1,
    continuar: 1,
    reabrir: 3,
    reformular: 1,
  });
  // Dos recursos, ordenados por lo que más falta: raciones 40/100 y mantas 50/50 (eB no cuenta).
  assert.deepEqual(dm.suministrosPorRecurso, [
    { recursoCodigo: 'raciones', pedido: 100, movilizado: 40, porcentajeCubierto: 40 },
    { recursoCodigo: 'mantas', pedido: 50, movilizado: 50, porcentajeCubierto: 100 },
  ]);
  // Cobertura con lo habilitado: lote de 10, la ONG ofreció 10 pero el SN habilitó 6 → 60 %.
  const eH = await emergency('adjudicada');
  await q("UPDATE emergencies SET created_at = '2027-04-10T12:00:00Z' WHERE id = $1", [eH]);
  const lH = await lote(eH, 'mantas', 10);
  await oferta(eH, 'adjudicada', [a], [[lH, 10]], [['mantas', 6]], [[lH, 6]]);
  assert.deepEqual((await indicadores('?desde=2027-04-01&hasta=2027-04-30')).coberturaLotes, {
    emergencias: 1,
    lotes: 1,
    promedioPorcentaje: 60,
  });

  // El reabrir de E1 solo se ve en su período; E1 no tiene resumen → no cuenta en cubiertos.
  assert.deepEqual((await indicadores('?desde=2026-09-01&hasta=2026-09-30')).caminosDecision, {
    todosCubiertos: 0,
    continuar: 0,
    reabrir: 1,
    reformular: 0,
  });
  res = await csv('caminos-decision', { sid: 'vencida' }, marzo.replace('?', '&'));
  assert.equal(res.r.status, 200);
  assert.equal(res.r.headers.get('content-disposition'), adjunto('caminos-decision', 'csv'));
  assert.equal(
    res.text,
    'camino,cantidad\ntodosCubiertos,1\ncontinuar,1\nreabrir,3\nreformular,1\n',
  );
  res = await csv('suministros-por-recurso', { sid: 'vencida' }, marzo.replace('?', '&'));
  assert.equal(res.r.status, 200);
  assert.equal(res.r.headers.get('content-disposition'), adjunto('suministros-por-recurso', 'csv'));
  assert.equal(
    res.text,
    'recursoCodigo,pedido,movilizado,porcentajeCubierto\nraciones,100,40,40\nmantas,50,50,100\n',
  );
  res = await csv('suministros-por-recurso', {}, '&desde=2027-01-01&hasta=2027-01-31');
  assert.equal(res.text, 'recursoCodigo,pedido,movilizado,porcentajeCubierto\n');
  assert.equal((await call('/export?formato=csv&dataset=caminos')).status, 400);

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
