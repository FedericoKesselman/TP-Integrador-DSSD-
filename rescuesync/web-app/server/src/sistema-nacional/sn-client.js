import { createDomainError } from '../errors.js';

// Cliente del Sistema Nacional para el único caso en que la web-app le habla
// directo: el inventario de la ONG ("Mi inventario"). Es mantenimiento del
// stock, no un paso del ciclo, así que es la excepción documentada a "solo
// Bonita habla con el SN". Usa la cuenta de integración.

const DEFAULT_SN_URL = 'https://tp-integrador-dssd-rescuesync-sistema.onrender.com';
// Render duerme el servicio gratuito: el primer pedido puede tardar ~1 minuto.
const REQUEST_TIMEOUT_MS = 90_000;
// El token dura 1 h; se renueva un poco antes.
const TOKEN_SAFETY_MARGIN_MS = 60_000;

let cachedToken = null; // { token, expiresAt }
let loginInFlight = null;

function snUrl() {
  return (process.env.SISTEMA_NACIONAL_API_URL || DEFAULT_SN_URL).replace(/\/$/, '');
}

class SnError extends Error {
  constructor(status, body) {
    super(body?.message || `El Sistema Nacional respondió ${status}.`);
    this.snStatus = status;
    this.body = body;
  }
}

async function rawRequest(path, { method = 'GET', body, token } = {}) {
  let response;
  try {
    response = await fetch(`${snUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('No se pudo conectar con el Sistema Nacional:', error);
    throw createDomainError('No se pudo conectar con el Sistema Nacional.', 502);
  }

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { message: text };
  }
  if (!response.ok) throw new SnError(response.status, parsed);
  return parsed;
}

async function login() {
  const username = process.env.SN_INTEGRATION_USERNAME;
  const password = process.env.SN_INTEGRATION_PASSWORD;
  if (!username || !password) {
    throw createDomainError('Las credenciales del Sistema Nacional no están configuradas.', 503);
  }

  try {
    const data = await rawRequest('/auth/login', { method: 'POST', body: { username, password } });
    cachedToken = {
      token: data.accessToken,
      expiresAt: Date.now() + data.expiresIn * 1000 - TOKEN_SAFETY_MARGIN_MS,
    };
    return cachedToken.token;
  } catch (error) {
    if (error instanceof SnError) {
      console.error('El Sistema Nacional rechazó el login de integración:', error.message);
      throw createDomainError('No se pudo autenticar contra el Sistema Nacional.', 502);
    }
    throw error;
  }
}

// Token en memoria; si hay un login en curso lo comparte (evita pedidos duplicados).
async function getToken({ force = false } = {}) {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  if (!loginInFlight) {
    loginInFlight = login().finally(() => {
      loginInFlight = null;
    });
  }
  return loginInFlight;
}

// Pedido autenticado al SN. Si responde 401 (token vencido) renueva el token y
// reintenta una vez. Los errores HTTP del SN salen como `SnError`.
export async function snRequest(path, options = {}) {
  try {
    return await rawRequest(path, { ...options, token: await getToken() });
  } catch (error) {
    if (error instanceof SnError && error.snStatus === 401) {
      return rawRequest(path, { ...options, token: await getToken({ force: true }) });
    }
    throw error;
  }
}

// Traduce un error del SN al error de dominio que devuelve la web-app.
export function translateSnError(error) {
  if (!(error instanceof SnError)) return error;
  const { snStatus, body } = error;

  if (snStatus === 404) {
    return createDomainError('Tu ONG todavía no está dada de alta en el Sistema Nacional.', 409);
  }
  if (snStatus === 409 && body?.detalle?.insuficientes) {
    return createDomainError(
      'No podés bajar el total de un recurso por debajo de lo que ya está comprometido.',
      409,
      { detalle: body.detalle },
    );
  }
  if (snStatus === 400) {
    return createDomainError(body?.message || 'El Sistema Nacional rechazó los datos.', 400, {
      detalle: body?.detalle,
    });
  }
  console.error('Error inesperado del Sistema Nacional:', snStatus, body);
  return createDomainError('El Sistema Nacional no pudo procesar el pedido.', 502);
}
