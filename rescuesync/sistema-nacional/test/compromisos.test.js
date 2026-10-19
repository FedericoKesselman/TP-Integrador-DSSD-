import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, it } from 'node:test';

import app from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import pool from '../src/db.js';

// Prueba de concurrencia de POST /compromisos (E3-24).
// Una ONG tiene 10 raciones y llegan 10 pedidos AL MISMO TIEMPO de 3 raciones cada uno.
// Solo pueden entrar 3 (3 x 3 = 9). Si el bloqueo (FOR UPDATE) no funcionara,
// varios pedidos verían "hay 10 libres" a la vez y se reservaría de más.

const ong = `test-concurrencia-${Date.now()}`;
const token = signAccessToken({ username: 'test', role: 'integracion' });
let server;

before(async () => {
  server = app.listen(0);
  const { rows } = await pool.query(
    "INSERT INTO ongs (ref, nombre, nivel_operativo) VALUES ($1, 'ONG de prueba', 3) RETURNING id",
    [ong],
  );
  await pool.query(
    "INSERT INTO ong_recursos (ong_id, recurso_codigo, cantidad_total) VALUES ($1, 'raciones', 10)",
    [rows[0].id],
  );
});

after(async () => {
  // Borra lo que creó el test: primero los compromisos (apuntan al stock), después la ONG.
  await pool.query(
    `DELETE FROM compromisos WHERE id IN (
       SELECT i.compromiso_id FROM compromiso_items i
         JOIN ong_recursos r ON r.id = i.ong_recurso_id
         JOIN ongs o ON o.id = r.ong_id
        WHERE o.ref = $1)`,
    [ong],
  );
  await pool.query('DELETE FROM ongs WHERE ref = $1', [ong]);
  server.close();
  await pool.end();
});

function pedirTresRaciones() {
  return fetch(`http://127.0.0.1:${server.address().port}/compromisos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      emergenciaId: randomUUID(),
      ofertas: [
        {
          ofertaId: randomUUID(),
          ongs: [{ ref: ong, rol: 'principal' }],
          items: [{ recursoCodigo: 'raciones', cantidad: 3 }],
        },
      ],
    }),
  });
}

it('10 pedidos simultáneos nunca reservan más de lo que hay', async () => {
  // Los 10 pedidos salen juntos y vemos que pasa con la concurrencia
  const pedidos = Array.from({ length: 10 }, () => pedirTresRaciones());
  const respuestas = await Promise.all(pedidos);

  const aceptados = respuestas.filter((r) => r.status === 200).length;
  const rechazados = respuestas.filter((r) => r.status === 409).length;
  assert.equal(aceptados, 3);
  assert.equal(rechazados, 7);

  const { rows } = await pool.query(
    `SELECT r.cantidad_comprometida FROM ong_recursos r JOIN ongs o ON o.id = r.ong_id
      WHERE o.ref = $1`,
    [ong],
  );
  assert.equal(rows[0].cantidad_comprometida, 9); // nunca mas de 10
});
