// E5-60: lee tareas cerradas por la API REST de Bonita y calcula el tiempo entre dos tareas de un caso.
// Uso: BONITA_USER=... BONITA_PASS=... node probar-tiempos-auditor.mjs [tareaDesde] [tareaHasta]
// Sirve para comprobar qué usuario de Bonita puede leer tareas cerradas (bpm/archivedTask) y
// como prueba mínima de la consulta de tiempos del dashboard (E5-62). Con un usuario sin permiso
// la API responde 403. Cualquier usuario por BONITA_USER/BONITA_PASS. Solo GET; no guarda cookies ni tokens.
// Límites: toma solo la primera aparición de cada tarea por caso (con reabrir o reformular se
// repiten); ignora las tareas abortadas, como "Cargar ofertas" (cierra por el timer); requiere
// Node 21+ por Map.groupBy.
if (!process.env.BONITA_USER || !process.env.BONITA_PASS) {
  console.error('Definí BONITA_USER y BONITA_PASS');
  process.exit(1);
}
const BASE = process.env.BONITA_URL || 'http://localhost:8080/bonita';
const [desde = 'Registrar Emergencia', hasta = 'Publicar Convocatoria'] = process.argv.slice(2);

const login = await fetch(`${BASE}/loginservice`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    username: process.env.BONITA_USER,
    password: process.env.BONITA_PASS,
    redirect: 'false',
  }),
});
if (login.status !== 204) throw new Error(`login ${login.status}`);
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');

async function getAll(path) {
  const out = [];
  for (let p = 0; ; p++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${BASE}/API/${path}${sep}c=100&p=${p}`, { headers: { Cookie: cookie } });
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 100) return out;
  }
}

// Ver docs Bonita 10.4: bpm/archivedTask, campos rootCaseId, name, state, reached_state_date, archivedDate
const tareas = await getAll('bpm/archivedTask?f=state=completed&o=reached_state_date+ASC');
const porCaso = Map.groupBy(tareas, (t) => t.rootCaseId);
console.log(`tareas completadas: ${tareas.length}, casos: ${porCaso.size}`);
console.log(
  'campos de fecha:',
  Object.keys(tareas[0] ?? {})
    .filter((k) => /date/i.test(k))
    .join(', '),
);

const ms = (s) => new Date(s.replace(' ', 'T')).getTime();
let n = 0;
for (const [caso, ts] of porCaso) {
  const a = ts.find((t) => t.name === desde);
  const b = ts.find((t) => t.name === hasta);
  if (!a || !b) continue;
  n++;
  console.log(
    `caso ${caso}: ${desde} -> ${hasta} = ${((ms(b.reached_state_date) - ms(a.reached_state_date)) / 60000).toFixed(1)} min`,
  );
}
if (!n) console.log('ningún caso tiene ambas tareas cerradas');
