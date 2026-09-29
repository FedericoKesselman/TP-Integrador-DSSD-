import pool from '../db.js';

function rowToLote(row) {
  return {
    id: row.id,
    emergencyId: row.emergency_id,
    resourceType: row.resource_type,
    unit: row.unit,
    quantityRequested: row.quantity_requested,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

// Guarda o reemplaza los lotes asociados a una emergencia (guardado de borrador / actualización de desglose)
export async function saveLotesForEmergency(emergencyId, lotesList) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar si la emergencia existe
    const emgRes = await client.query('SELECT id, status FROM emergencies WHERE id = $1', [emergencyId]);
    if (emgRes.rowCount === 0) {
      const err = new Error('Emergencia no encontrada.');
      err.status = 404;
      throw err;
    }

    if (emgRes.rows[0].status !== 'registrada') {
      const err = new Error(
        'Los lotes no se pueden modificar después de publicar la convocatoria.',
      );
      err.status = 409;
      throw err;
    }

    // Limpiar lotes previos de esta emergencia para guardar la lista actualizada
    await client.query('DELETE FROM lotes WHERE emergency_id = $1', [emergencyId]);

    const insertedLotes = await Promise.all(
      lotesList.map(async (lote) => {
        const result = await client.query(
          `INSERT INTO lotes (emergency_id, resource_type, unit, quantity_requested, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            emergencyId,
            lote.resourceType.trim(),
            lote.unit?.trim() || null,
            Number(lote.quantityRequested),
            lote.notes?.trim() || null,
          ],
        );
        return rowToLote(result.rows[0]);
      }),
    );

    await client.query('COMMIT');
    return {
      emergencyId,
      lotes: insertedLotes,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Listar lotes de una emergencia
export async function listLotesForEmergency(emergencyId) {
  const { rows } = await pool.query(
    'SELECT * FROM lotes WHERE emergency_id = $1 ORDER BY created_at ASC',
    [emergencyId],
  );
  return rows.map(rowToLote);
}

// Publicar la convocatoria (pasa emergencies.status de 'registrada' a 'convocatoria_abierta')
export async function publishConvocatoriaForEmergency(emergencyId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const emgRes = await client.query('SELECT id, status FROM emergencies WHERE id = $1', [emergencyId]);
    if (emgRes.rowCount === 0) {
      const err = new Error('Emergencia no encontrada.');
      err.status = 404;
      throw err;
    }

    const currentStatus = emgRes.rows[0].status;
    if (currentStatus !== 'registrada') {
      const err = new Error(`La emergencia no se puede abrir: su estado actual es "${currentStatus}".`);
      err.status = 409;
      throw err;
    }

    const lotesCountRes = await client.query('SELECT COUNT(*) AS count FROM lotes WHERE emergency_id = $1', [emergencyId]);
    const count = Number(lotesCountRes.rows[0].count);
    if (count === 0) {
      const err = new Error('La emergencia no tiene lotes cargados.');
      err.status = 409;
      throw err;
    }

    await client.query(
      "UPDATE emergencies SET status = 'convocatoria_abierta' WHERE id = $1",
      [emergencyId],
    );

    await client.query('COMMIT');
    return {
      emergencyId,
      status: 'convocatoria_abierta',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
