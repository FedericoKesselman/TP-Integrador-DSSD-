// Lectura de casos y tareas cerradas desde la API REST de Bonita con la sesión del propio
// Auditor logueado (req.session.bonita; necesita perfil Administrador en Bonita). Solo GET.
import { apiGet } from '../bonita/bonita-client.js';
import { createDomainError } from '../errors.js';
import { filtrarCasos } from './tiempos-etapas.js';

const PAGE_SIZE = 100;

// GET con la sesión del usuario. 401 → la sesión de Bonita venció (hay que volver a
// loguearse); 403 → el usuario no tiene permiso (le falta el perfil Administrador).
async function getJson(session, path) {
  let response;
  try {
    response = await apiGet(session, path);
  } catch (error) {
    throw createDomainError('No se pudo conectar con Bonita.', 502);
  }
  if (response.status === 401) {
    throw createDomainError('Tu sesión de Bonita venció. Volvé a iniciar sesión.', 401);
  }
  if (response.status === 403) {
    throw createDomainError(
      'Bonita rechazó la consulta: el usuario auditor necesita perfil Administrador en Bonita.',
      502,
    );
  }
  if (!response.ok) throw createDomainError(`Bonita respondió ${response.status} en ${path}.`, 502);
  return response.json();
}

// Trae todas las páginas de un listado.
async function getAll(session, path) {
  const items = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let p = 0; ; p += 1) {
    // eslint-disable-next-line no-await-in-loop -- páginas en orden
    const page = await getJson(session, `${path}${sep}c=${PAGE_SIZE}&p=${p}`);
    items.push(...page);
    if (page.length < PAGE_SIZE) return items;
  }
}

const filter = (...pairs) => pairs.map(([k, v]) => `f=${k}=${encodeURIComponent(v)}`).join('&');

// Casos (abiertos y terminados, de todas las versiones del proceso) en el período, con
// sus tareas completadas. Devuelve { casos, tareas } listos para calcularTiemposEtapas.
// ponytail: una consulta de tareas por caso, en serie; paralelizar si hay cientos de casos.
export async function leerCasosYTareas(session, periodo) {
  const processName = process.env.BONITA_PROCESS_NAME || 'Gestionar Emergencia';
  const procesos = await getAll(session, `bpm/process?${filter(['name', processName])}`);

  const casos = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const proceso of procesos) {
    const byProcess = filter(['processDefinitionId', proceso.id]);
    // eslint-disable-next-line no-await-in-loop
    const abiertos = await getAll(session, `bpm/case?${byProcess}`);
    // eslint-disable-next-line no-await-in-loop
    const archivados = await getAll(session, `bpm/archivedCase?${byProcess}`);
    abiertos.forEach((c) => casos.push({ id: c.id, start: c.start, end: null }));
    archivados.forEach((c) =>
      casos.push({
        id: c.sourceObjectId,
        start: c.start,
        end: c.state === 'completed' ? c.end_date : null,
      }),
    );
  }

  const enPeriodo = filtrarCasos(
    casos.filter((c) => c.start),
    periodo,
  );
  const tareas = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const caso of enPeriodo) {
    // eslint-disable-next-line no-await-in-loop
    const archivadas = await getAll(
      session,
      `bpm/archivedActivity?${filter(['caseId', caso.id], ['state', 'completed'])}`,
    );
    archivadas.forEach((t) =>
      tareas.push({ caseId: caso.id, name: t.name, date: t.reached_state_date }),
    );
  }
  return { casos: enPeriodo, tareas };
}
