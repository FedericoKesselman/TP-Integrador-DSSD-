import { createDomainError } from '../errors.js';
import { canTransition } from '../workflow.js';

// Bloquea la fila de la emergencia durante la transacción y la devuelve cruda
// (snake_case). Tira 404 si no existe.
export async function lockEmergency(client, emergencyId) {
  const { rows } = await client.query('SELECT * FROM emergencies WHERE id = $1 FOR UPDATE', [
    emergencyId,
  ]);
  if (rows.length === 0) throw createDomainError('Emergencia no encontrada.', 404);
  return rows[0];
}

// Cambia el estado validando la whitelist de transiciones y deja una fila en
// el historial (lo usa el dashboard). `emergency` es la fila ya bloqueada.
export async function changeEmergencyStatus(client, emergency, to, changedBy = null) {
  if (!canTransition(emergency.status, to)) {
    throw createDomainError(
      `La emergencia no puede pasar de "${emergency.status}" a "${to}".`,
      409,
    );
  }
  await client.query('UPDATE emergencies SET status = $2 WHERE id = $1', [emergency.id, to]);
  await client.query(
    `INSERT INTO emergency_status_history (emergency_id, from_status, to_status, changed_by)
     VALUES ($1, $2, $3, $4)`,
    [emergency.id, emergency.status, to, changedBy],
  );
}

// Deshace un cambio de estado hecho por `changeEmergencyStatus` cuando Bonita
// no pudo avanzar: pasa de `currentStatus` de vuelta a `previousStatus` y borra
// la última fila del historial de ese cambio (la operación se revirtió, no
// ocurrió). Si la emergencia ya no está en `currentStatus`, no toca nada.
export async function revertEmergencyStatus(client, emergencyId, currentStatus, previousStatus) {
  const { rowCount } = await client.query(
    'UPDATE emergencies SET status = $3 WHERE id = $1 AND status = $2',
    [emergencyId, currentStatus, previousStatus],
  );
  if (rowCount === 0) return;
  await client.query(
    `DELETE FROM emergency_status_history
     WHERE id = (
       SELECT id FROM emergency_status_history
       WHERE emergency_id = $1 AND from_status = $3 AND to_status = $2
       ORDER BY changed_at DESC
       LIMIT 1
     )`,
    [emergencyId, currentStatus, previousStatus],
  );
}
