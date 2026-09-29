const BONITA_URL = process.env.BONITA_API_URL;

// Busca una cookie por nombre dentro de los "Set-Cookie" que devolvió Bonita
function findCookie(cookies, name) {
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  return cookie?.split(';')[0].split('=')[1];
}

// Equivalente a un POST /loginservice con usuario y contraseña a bonita, retorna token y jsessionId
export async function login(username, password) {
  const response = await fetch(`${BONITA_URL}/loginservice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password, redirect: 'false' }),
  });

  if (response.status === 401) return null; // usuario o clave incorrectos
  if (!response.ok) throw new Error(`Login en Bonita falló: ${response.status}`);

  const cookies = response.headers.getSetCookie();
  return {
    jsessionId: findCookie(cookies, 'JSESSIONID'),
    apiToken: findCookie(cookies, 'X-Bonita-API-Token'),
  };
}

// Cierra la sesión en Bonita (similar a un GET /logoutservice)
export async function logout(session) {
  await fetch(`${BONITA_URL}/logoutservice?redirect=false`, {
    headers: { Cookie: `JSESSIONID=${session.jsessionId}` },
  });
}

const PROCESS_NAME = process.env.BONITA_PROCESS_NAME || 'Gestionar Emergencia';

// Headers para llamar a la API de Bonita con la sesión guardada en el login.
function apiHeaders(session) {
  return {
    'X-Bonita-API-Token': session.apiToken,
    Cookie: `JSESSIONID=${session.jsessionId}; X-Bonita-API-Token=${session.apiToken}`,
  };
}

// Busca el id del proceso desplegado y activo con ese nombre (el id cambia en
// cada redeploy). Si hay varias versiones, devuelve la desplegada más
// recientemente.
export async function getProcessId(session, processName) {
  const filters = `f=name=${encodeURIComponent(processName)}&f=activationState=ENABLED`;
  const response = await fetch(`${BONITA_URL}/API/bpm/process?c=10&p=0&${filters}`, {
    headers: apiHeaders(session),
  });
  if (!response.ok) throw new Error(`No se pudo buscar el proceso en Bonita: ${response.status}`);

  const processes = await response.json();
  if (processes.length === 0) {
    throw new Error(`El proceso ${processName} no está desplegado y activo en Bonita`);
  }
  // deploymentDate es "YYYY-MM-DD HH:mm:ss.SSS", así que ordena como texto.
  return processes.sort((a, b) => b.deploymentDate.localeCompare(a.deploymentDate))[0].id;
}

// Inicia una instancia del proceso (POST /API/bpm/process/{id}/instantiation).
// `variables` es el body de la instanciación: Bonita lo valida contra el
// contrato de inicio del proceso, así que las claves tienen que coincidir con
// los inputs de ese contrato. Devuelve el caseId como string.
export async function startCase(session, variables) {
  if (!session) throw new Error('No hay sesión de Bonita.');

  const processId = await getProcessId(session, PROCESS_NAME);
  const response = await fetch(`${BONITA_URL}/API/bpm/process/${processId}/instantiation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...apiHeaders(session) },
    body: JSON.stringify(variables),
  });

  if (!response.ok) {
    throw new Error(`Bonita no pudo iniciar el caso: ${response.status} ${await response.text()}`);
  }
  const { caseId } = await response.json();
  return String(caseId);
}

// Completa la tarea humana pendiente (estado ready) con ese nombre dentro del
// caso: la toma para el usuario de la sesión y la ejecuta. Devuelve false si el
// caso no tiene esa tarea pendiente.
export async function completeTask(session, caseId, taskName) {
  const headers = apiHeaders(session);
  const filters = `f=caseId=${encodeURIComponent(caseId)}&f=state=ready`;
  const listResponse = await fetch(`${BONITA_URL}/API/bpm/humanTask?c=100&p=0&${filters}`, {
    headers,
  });
  if (!listResponse.ok) throw new Error(`No se pudieron listar las tareas: ${listResponse.status}`);

  const tasks = await listResponse.json();
  const task = tasks.find((t) => t.name === taskName || t.displayName === taskName);
  if (!task) return false;

  const sessionResponse = await fetch(`${BONITA_URL}/API/system/session/unusedId`, { headers });
  if (!sessionResponse.ok) throw new Error(`No se pudo leer la sesión: ${sessionResponse.status}`);
  const { user_id: userId } = await sessionResponse.json();

  const jsonHeaders = { 'Content-Type': 'application/json', ...headers };
  const assign = await fetch(`${BONITA_URL}/API/bpm/userTask/${task.id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ assigned_id: userId }),
  });
  if (!assign.ok) throw new Error(`No se pudo tomar "${taskName}": ${assign.status}`);

  // Las tareas humanas de este proceso tienen contrato vacío, por eso el body es {}.
  const execute = await fetch(`${BONITA_URL}/API/bpm/userTask/${task.id}/execution`, {
    method: 'POST',
    headers: jsonHeaders,
    body: '{}',
  });
  if (!execute.ok) {
    throw new Error(
      `No se pudo completar "${taskName}": ${execute.status} ${await execute.text()}`,
    );
  }
  return true;
}

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

// Completa, en el orden dado, las tareas que Bonita tenga pendientes; las que
// no estén pendientes se saltan. Tras completar una, la siguiente puede tardar
// un instante en aparecer, así que se reintenta antes de darla por no pendiente.
// Con `waitForFirst` también se reintenta la primera (recién creado el caso, su
// primera tarea tarda un instante en quedar lista).
// Si Bonita da error se corta ahí (el error lleva `completed` con lo ya hecho).
/* eslint-disable no-await-in-loop, no-restricted-syntax -- las tareas se completan en orden, una por una */
export async function completePendingTasks(
  session,
  caseId,
  taskNames,
  { waitForFirst = false } = {},
) {
  const completed = [];
  const skipped = [];
  let justCompleted = waitForFirst;

  try {
    for (const taskName of taskNames) {
      let done = await completeTask(session, caseId, taskName);
      for (let i = 0; !done && justCompleted && i < RETRY_ATTEMPTS; i += 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, RETRY_DELAY_MS);
        });
        done = await completeTask(session, caseId, taskName);
      }
      (done ? completed : skipped).push(taskName);
      justCompleted = done;
    }
  } catch (error) {
    error.completed = completed;
    throw error;
  }
  return { completed, skipped };
}
/* eslint-enable no-await-in-loop, no-restricted-syntax */
