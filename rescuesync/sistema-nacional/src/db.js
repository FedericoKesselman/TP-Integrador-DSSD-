import pg from 'pg';

import config from './config.js';

const { Pool } = pg;

// El SSL se controla desde la connection string: Neon exige
// `?sslmode=require` (ver .env.example); el Postgres local no lo usa.
const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

// Ejecuta `work(client)` dentro de una transacción: COMMIT si termina bien,
// ROLLBACK si lanza. Es la base del locking del SN: los `SELECT ... FOR
// UPDATE` de validación y compromiso tienen que correr con el mismo
// `client` que se recibe acá, no con `pool.query`.
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
