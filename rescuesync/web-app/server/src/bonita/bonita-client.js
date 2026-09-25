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
