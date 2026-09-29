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

// Inicia una instancia del proceso (POST /API/bpm/process/{id}/instantiation).
// `variables` es el body de la instanciación: Bonita lo valida contra el
// contrato de inicio del proceso, así que las claves tienen que coincidir con
// los inputs de ese contrato. Devuelve el caseId como string.
export async function startCase(session, processId, variables) {
  if (!session) throw new Error('No hay sesión de Bonita.');
  if (!processId) throw new Error('Falta BONITA_PROCESS_ID.');

  const response = await fetch(`${BONITA_URL}/API/bpm/process/${processId}/instantiation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bonita-API-Token': session.apiToken,
      Cookie: `JSESSIONID=${session.jsessionId}; X-Bonita-API-Token=${session.apiToken}`,
    },
    body: JSON.stringify(variables),
  });

  if (!response.ok) {
    throw new Error(`Bonita no pudo iniciar el caso: ${response.status} ${await response.text()}`);
  }
  const { caseId } = await response.json();
  return String(caseId);
}
