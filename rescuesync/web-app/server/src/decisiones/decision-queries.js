import pool from '../db.js';

// ¿El coordinador ya decidió "continuar" en esta ronda de validación? Vale
// si hay una decisión `continuar` posterior al último paso a `validada`
// (reabrir o reformular y volver a validar abre una ronda nueva). En Bonita,
// "Decidir como Continuar" ya no está pendiente: el caso espera la adjudicación.
// `db` es el pool o un client.
export async function yaDecidioContinuar(emergencyId, db = pool) {
  const { rows } = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM emergency_decisiones d
       WHERE d.emergency_id = $1
         AND d.camino = 'continuar'
         AND d.decided_at > COALESCE(
           (SELECT max(h.changed_at) FROM emergency_status_history h
            WHERE h.emergency_id = $1 AND h.to_status = 'validada'),
           '-infinity'::timestamptz
         )
     ) AS decidido`,
    [emergencyId],
  );
  return rows[0].decidido;
}
