// Sin base de datos: node tests/tiempos-etapas.js
// Función pura calcularTiemposEtapas y parsePeriodo. Las rutas (con Bonita simulado) se
// prueban en dashboard.integration.js, que ya necesita la base para el cruce por tipo.
import assert from 'node:assert/strict';

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

// porTipo: cruce con el tipo de emergencia (Map caseId → tipo). Dos tipos, un caso sin
// emergencia (queda fuera de porTipo pero cuenta en etapas) y orden fijo del contrato.
const tipos = new Map([
  ['1', 'terremoto'],
  ['2', 'inundacion'],
]);
const cruzado = calcularTiemposEtapas(
  [...casos, { id: 3, start: '2026-11-06 09:00:00.000', end: null }],
  [...tareas, t(3, 'Registrar Emergencia', '2026-11-06 09:00:00.000')],
  {},
  tipos,
);
assert.equal(cruzado.casosAnalizados, 3);
assert.deepEqual(
  cruzado.porTipo.map((x) => [x.tipo, x.casosAnalizados]),
  [
    ['inundacion', 1],
    ['terremoto', 1],
  ],
);
assert.deepEqual(
  cruzado.porTipo[0].etapas.map((e) => e.etapa),
  ETAPAS,
);
assert.equal(cruzado.porTipo[0].etapas[0].promedioMinutos, 5); // caso 2
assert.equal(cruzado.porTipo[1].etapas[0].promedioMinutos, 2.1); // caso 1
assert.equal(cruzado.porTipo[1].etapas[4].promedioMinutos, 120); // total del caso 1
assert.equal(cruzado.porTipo[0].etapas[4].casos, 0); // caso 2 abierto
// Sin casos o sin tipos conocidos: porTipo vacío.
assert.deepEqual(calcularTiemposEtapas([], []).porTipo, []);
assert.deepEqual(calcularTiemposEtapas(casos, tareas).porTipo, []);
// El período también recorta porTipo.
assert.deepEqual(
  calcularTiemposEtapas(casos, tareas, { desde: '2026-11-05' }, tipos).porTipo.map((x) => x.tipo),
  ['inundacion'],
);

console.log('tiempos-etapas (función pura): OK');
