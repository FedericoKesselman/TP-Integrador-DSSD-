import pool, { withTransaction } from '../db.js';
import {
  changeEmergencyStatus,
  lockEmergency,
  revertEmergencyStatus,
} from '../emergencies/state-machine.js';
import { createDomainError } from '../errors.js';

function rowToLote(row) {
  return {
    id: row.id,
    emergencyId: row.emergency_id,
    resourceType: row.resource_type,
    resourceCode: row.resource_code,
    unit: row.unit,
    quantityRequested: row.quantity_requested,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

// Guarda o reemplaza los lotes asociados a una emergencia (guardado de borrador / actualización de desglose)
export async function saveLotesForEmergency(emergencyId, lotesList) {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);

    if (emergency.status !== 'registrada') {
      throw createDomainError(
        'Los lotes no se pueden modificar después de publicar la convocatoria.',
        409,
      );
    }

    // Limpiar lotes previos de esta emergencia para guardar la lista actualizada
    await client.query('DELETE FROM lotes WHERE emergency_id = $1', [emergencyId]);

    const insertedLotes = [];
    // Se insertan de a uno para conservar el orden de carga.
    // eslint-disable-next-line no-restricted-syntax
    for (const lote of lotesList) {
      // eslint-disable-next-line no-await-in-loop
      const result = await client.query(
        `INSERT INTO lotes (emergency_id, resource_type, resource_code, unit, quantity_requested, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          emergencyId,
          lote.resourceType.trim(),
          lote.resourceCode,
          lote.unit?.trim() || null,
          Number(lote.quantityRequested),
          lote.notes?.trim() || null,
        ],
      );
      insertedLotes.push(rowToLote(result.rows[0]));
    }

    return { emergencyId, lotes: insertedLotes };
  });
}

// Listar lotes de una emergencia
export async function listLotesForEmergency(emergencyId) {
  const { rows } = await pool.query(
    'SELECT * FROM lotes WHERE emergency_id = $1 ORDER BY created_at ASC',
    [emergencyId],
  );
  return rows.map(rowToLote);
}

// Publicar la convocatoria (pasa emergencies.status de 'registrada' a
// 'convocatoria_abierta') y guarda la duración de la ventana de ofertas.
export async function publishConvocatoriaForEmergency(emergencyId, duracionMinutos, changedBy) {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);

    if (emergency.status !== 'registrada') {
      throw createDomainError(
        `La emergencia no se puede abrir: su estado actual es "${emergency.status}".`,
        409,
      );
    }

    const lotesCountRes = await client.query(
      'SELECT COUNT(*) AS count FROM lotes WHERE emergency_id = $1',
      [emergencyId],
    );
    if (Number(lotesCountRes.rows[0].count) === 0) {
      throw createDomainError('La emergencia no tiene lotes cargados.', 409);
    }

    await client.query(
      `UPDATE emergencies
       SET duracion_convocatoria_min = $2, convocatoria_ronda = convocatoria_ronda + 1
       WHERE id = $1`,
      [emergencyId, duracionMinutos],
    );
    await changeEmergencyStatus(client, emergency, 'convocatoria_abierta', changedBy);

    return { emergencyId, status: 'convocatoria_abierta', duracionMinutos };
  });
}

// Deshace la publicación si Bonita no pudo avanzar (vuelve a 'registrada').
export async function revertConvocatoria(emergencyId) {
  await withTransaction(async (client) => {
    await revertEmergencyStatus(client, emergencyId, 'convocatoria_abierta', 'registrada');
    await client.query(
      `UPDATE emergencies
       SET duracion_convocatoria_min = NULL,
           convocatoria_ronda = GREATEST(convocatoria_ronda - 1, 0)
       WHERE id = $1 AND status = 'registrada'`,
      [emergencyId],
    );
  });
}
