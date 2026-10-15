import bcrypt from 'bcryptjs';

import pool from '../src/db.js';

// Crea (o actualiza la clave de) la cuenta de integración que usa Bonita.
// Idempotente: corre en cada arranque de producción (`npm run start:prod`),
// así que cambiar SN_INTEGRATION_PASSWORD en Render y redeployar rota la
// clave. Sin SN_INTEGRATION_PASSWORD no hace nada.
const username = process.env.SN_INTEGRATION_USERNAME || 'rescuesync-integracion';
const password = process.env.SN_INTEGRATION_PASSWORD;

if (!password) {
  console.warn('SN_INTEGRATION_PASSWORD vacía: no se crea la cuenta de integración.');
} else {
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO api_clients (username, password_hash, role)
     VALUES ($1, $2, 'integracion')
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, activo = true
     WHERE api_clients.role = 'integracion'`,
    [username, hash],
  );
  console.log(`Cuenta de integración "${username}" lista.`);
}

await pool.end();
