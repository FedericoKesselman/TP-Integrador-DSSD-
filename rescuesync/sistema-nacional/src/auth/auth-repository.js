import pool from '../db.js';

// Cuenta activa por username, con el ref de su ONG si es rol `ong`.
export async function findActiveClientByUsername(username) {
  const { rows } = await pool.query(
    `SELECT c.username, c.password_hash, c.role, o.ref AS ong_ref
       FROM api_clients c
       LEFT JOIN ongs o ON o.id = c.ong_id
      WHERE c.username = $1 AND c.activo AND (c.ong_id IS NULL OR o.habilitada)`,
    [username],
  );
  return rows[0] ?? null;
}
