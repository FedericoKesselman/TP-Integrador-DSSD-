// E5-73: prueba de concurrencia contra un Sistema Nacional desplegado (por defecto, Render).
//
//   SN_URL=https://... SN_INTEGRATION_USERNAME=... SN_INTEGRATION_PASSWORD=... \
//     node scripts/prueba-concurrencia.js [ongRef]
//
// Toma el recurso de la ONG (por defecto rescatistas-unidos) con más unidades disponibles
// y lanza en paralelo:
//   1) dos adjudicaciones de emergencias distintas que piden cada una más de la mitad de lo
//      disponible: tiene que aceptarse exactamente una y la otra recibir 409;
//   2) diez adjudicaciones simultáneas de q unidades: se aceptan floor(disponible / q).
// En los dos casos verifica que lo comprometido aumentó exactamente lo aceptado y nunca
// supera el total. Al final cierra las emergencias de prueba (POST /emergencias/:id/cierre)
// para liberar el stock y comprueba que el inventario quedó como al principio.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const SN_URL = (
  process.env.SN_URL || 'https://tp-integrador-dssd-rescuesync-sistema.onrender.com'
).replace(/\/$/, '');
const USERNAME = process.env.SN_INTEGRATION_USERNAME || 'rescuesync-integracion';
const PASSWORD = process.env.SN_INTEGRATION_PASSWORD;
const ONG = process.argv[2] || 'rescatistas-unidos';
const TIMEOUT_MS = 90_000; // arranque en frío de Render

if (!PASSWORD) {
  console.error('Falta SN_INTEGRATION_PASSWORD.');
  process.exit(1);
}

async function sn(method, path, { token, body } = {}) {
  const res = await fetch(SN_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const stockDe = async (token, recursoCodigo) => {
  const { status, body } = await sn('GET', `/ongs/${ONG}/recursos`, { token });
  assert.equal(status, 200, `GET /ongs/${ONG}/recursos`);
  return recursoCodigo ? body.find((r) => r.recursoCodigo === recursoCodigo) : body;
};

const adjudicar = (token, emergenciaId, recursoCodigo, cantidad) =>
  sn('POST', '/compromisos', {
    token,
    body: {
      emergenciaId,
      ofertas: [
        {
          ofertaId: randomUUID(),
          ongs: [{ ref: ONG, rol: 'principal' }],
          items: [{ recursoCodigo, cantidad }],
        },
      ],
    },
  });

async function ronda(token, nombre, recurso, pedidos, cantidad) {
  const antes = await stockDe(token, recurso);
  const emergencias = Array.from({ length: pedidos }, () => randomUUID());
  const t0 = Date.now();
  const respuestas = await Promise.all(
    emergencias.map((id) => adjudicar(token, id, recurso, cantidad)),
  );
  const ms = Date.now() - t0;
  const aceptados = respuestas.filter((r) => r.status === 200).length;
  const rechazados = respuestas.filter((r) => r.status === 409).length;
  const otros = respuestas.filter((r) => ![200, 409].includes(r.status));
  const despues = await stockDe(token, recurso);
  const esperados = Math.floor(antes.cantidadDisponible / cantidad);

  console.log(
    `${nombre}: ${pedidos} pedidos de ${cantidad} "${recurso}" en paralelo con ${antes.cantidadDisponible} disponibles → ` +
      `${aceptados} aceptados, ${rechazados} con 409 (${ms} ms). Comprometido: ${antes.cantidadComprometida} → ${despues.cantidadComprometida} de ${despues.cantidadTotal}.`,
  );
  assert.equal(otros.length, 0, `respuestas inesperadas: ${JSON.stringify(otros)}`);
  assert.equal(aceptados, Math.min(esperados, pedidos));
  assert.equal(rechazados, pedidos - aceptados);
  assert.equal(despues.cantidadComprometida - antes.cantidadComprometida, aceptados * cantidad);
  assert.ok(despues.cantidadComprometida <= despues.cantidadTotal, 'sobre-asignación');
  const rechazo = respuestas.find((r) => r.status === 409);
  if (rechazo) assert.ok(rechazo.body?.message, '409 sin detalle');
  return emergencias;
}

const t0 = Date.now();
const health = await sn('GET', '/health');
console.log(`/health: ${health.status} ${JSON.stringify(health.body)} (${Date.now() - t0} ms)`);
const login = await sn('POST', '/auth/login', { body: { username: USERNAME, password: PASSWORD } });
assert.equal(login.status, 200, 'login de integración');
const token = login.body.accessToken;

const inicial = await stockDe(token);
const recurso = inicial
  .filter((r) => r.cantidadDisponible >= 2)
  .sort((a, b) => b.cantidadDisponible - a.cantidadDisponible)[0];
assert.ok(recurso, `La ONG ${ONG} no tiene ningún recurso con 2 o más unidades disponibles.`);

const emergencias = [];
try {
  const d = recurso.cantidadDisponible;
  emergencias.push(
    ...(await ronda(token, 'Ronda 1', recurso.recursoCodigo, 2, Math.floor(d / 2) + 1)),
  );
  const disponible = (await stockDe(token, recurso.recursoCodigo)).cantidadDisponible;
  emergencias.push(
    ...(await ronda(
      token,
      'Ronda 2',
      recurso.recursoCodigo,
      10,
      Math.max(1, Math.floor(disponible / 3)),
    )),
  );
} finally {
  // Liberar todo lo reservado por la prueba.
  await Promise.all(emergencias.map((id) => sn('POST', `/emergencias/${id}/cierre`, { token })));
  const final = await stockDe(token);
  assert.deepEqual(final, inicial, 'El inventario no volvió a su estado inicial.');
  console.log(
    `Cierre de ${emergencias.length} emergencias de prueba: inventario de ${ONG} restaurado.`,
  );
}
console.log('PASS: concurrencia contra el Sistema Nacional desplegado.');
