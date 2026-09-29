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
