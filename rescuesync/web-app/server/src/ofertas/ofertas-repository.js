import pool from '../db.js';

function createDomainError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function rowToOferta(row, ongs, items) {
  return {
    id: row.id,
    emergencyId: row.emergency_id,
    status: row.status,
    observations: row.observations,
    ongs,
    items,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function findOngByRef(queryable, ongRef) {
  if (!ongRef) {
    throw createDomainError('La sesión no está asociada a una ONG.', 409);
  }

  const result = await queryable.query(
    'SELECT id, name, bonita_org_ref FROM ongs WHERE bonita_org_ref = $1',
    [ongRef],
  );

  if (result.rowCount === 0) {
    throw createDomainError('No existe una ONG asociada a la sesión iniciada.', 409);
  }

  return result.rows[0];
}

async function getOfertaById(queryable, ofertaId) {
  const ofertaResult = await queryable.query('SELECT * FROM ofertas WHERE id = $1', [ofertaId]);
  if (ofertaResult.rowCount === 0) return null;

  const ongsResult = await queryable.query(
    `SELECT o.id, o.name, oo.role
     FROM oferta_ongs oo
     JOIN ongs o ON o.id = oo.ong_id
     WHERE oo.oferta_id = $1
     ORDER BY oo.created_at ASC`,
    [ofertaId],
  );

  const itemsResult = await queryable.query(
    `SELECT ol.id, ol.lote_id, ol.quantity_offered, ol.notes,
            l.resource_type, l.unit, l.quantity_requested
     FROM oferta_lotes ol
     JOIN lotes l ON l.id = ol.lote_id
     WHERE ol.oferta_id = $1
     ORDER BY ol.created_at ASC`,
    [ofertaId],
  );

  const ongs = ongsResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
  }));
  const items = itemsResult.rows.map((row) => ({
    id: row.id,
    loteId: row.lote_id,
    resourceType: row.resource_type,
    unit: row.unit,
    quantityRequested: row.quantity_requested,
    quantityOffered: row.quantity_offered,
    notes: row.notes,
  }));

  return rowToOferta(ofertaResult.rows[0], ongs, items);
}

async function ensureLotesBelongToEmergency(queryable, emergencyId, loteIds) {
  const lotesResult = await queryable.query(
    `SELECT id
     FROM lotes
     WHERE emergency_id = $1 AND id = ANY($2::uuid[])`,
    [emergencyId, loteIds],
  );
  if (lotesResult.rowCount !== loteIds.length) {
    throw createDomainError('Uno o más lotes no pertenecen a esta emergencia.', 400);
  }
}

async function insertOfertaItems(queryable, ofertaId, items) {
  await queryable.query(
    `INSERT INTO oferta_lotes (oferta_id, lote_id, quantity_offered, notes)
     SELECT $1, item.lote_id, item.quantity_offered, item.notes
     FROM unnest($2::uuid[], $3::integer[], $4::text[])
       AS item(lote_id, quantity_offered, notes)`,
    [
      ofertaId,
      items.map((item) => item.loteId.trim()),
      items.map((item) => Number(item.quantityOffered)),
      items.map((item) => item.notes?.trim() || null),
    ],
  );
}

async function ensureOngOwnsOferta(queryable, ofertaId, ongId) {
  const ownershipResult = await queryable.query(
    `SELECT 1
     FROM oferta_ongs
     WHERE oferta_id = $1 AND ong_id = $2`,
    [ofertaId, ongId],
  );
  if (ownershipResult.rowCount === 0) {
    throw createDomainError('La oferta no pertenece a la ONG de la sesión.', 403);
  }
}

export async function createOfertaForEmergency(emergencyId, ongRef, payload) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const emergencyResult = await client.query(
      'SELECT id, status FROM emergencies WHERE id = $1',
      [emergencyId],
    );
    if (emergencyResult.rowCount === 0) {
      throw createDomainError('Emergencia no encontrada.', 404);
    }
    if (emergencyResult.rows[0].status !== 'convocatoria_abierta') {
      throw createDomainError('La convocatoria no está abierta para recibir ofertas.', 409);
    }

    const ong = await findOngByRef(client, ongRef);
    const loteIds = payload.items.map((item) => item.loteId.trim());
    await ensureLotesBelongToEmergency(client, emergencyId, loteIds);

    const ofertaResult = await client.query(
      `INSERT INTO ofertas (emergency_id, observations)
       VALUES ($1, $2)
       RETURNING *`,
      [emergencyId, payload.observations?.trim() || null],
    );
    const oferta = ofertaResult.rows[0];

    await client.query(
      `INSERT INTO oferta_ongs (oferta_id, ong_id, role)
       VALUES ($1, $2, $3)`,
      [oferta.id, ong.id, 'principal'],
    );

    await insertOfertaItems(client, oferta.id, payload.items);

    const createdOferta = await getOfertaById(client, oferta.id);
    await client.query('COMMIT');
    return createdOferta;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listOwnOfertasForEmergency(emergencyId, ongRef) {
  const emergencyResult = await pool.query('SELECT id FROM emergencies WHERE id = $1', [
    emergencyId,
  ]);
  if (emergencyResult.rowCount === 0) {
    throw createDomainError('Emergencia no encontrada.', 404);
  }

  const ong = await findOngByRef(pool, ongRef);
  const ofertaIdsResult = await pool.query(
    `SELECT f.id
     FROM ofertas f
     JOIN oferta_ongs oo ON oo.oferta_id = f.id
     WHERE f.emergency_id = $1 AND oo.ong_id = $2
     ORDER BY f.created_at DESC`,
    [emergencyId, ong.id],
  );

  return Promise.all(ofertaIdsResult.rows.map((row) => getOfertaById(pool, row.id)));
}

export async function updateOwnOferta(ofertaId, ongRef, changedBy, payload) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const ofertaResult = await client.query(
      `SELECT f.id, f.emergency_id, e.status AS emergency_status
       FROM ofertas f
       JOIN emergencies e ON e.id = f.emergency_id
       WHERE f.id = $1
       FOR UPDATE OF f`,
      [ofertaId],
    );
    if (ofertaResult.rowCount === 0) {
      throw createDomainError('Oferta no encontrada.', 404);
    }

    const oferta = ofertaResult.rows[0];
    const ong = await findOngByRef(client, ongRef);
    await ensureOngOwnsOferta(client, ofertaId, ong.id);

    if (oferta.emergency_status !== 'convocatoria_abierta') {
      throw createDomainError('La oferta no se puede editar porque la convocatoria cerró.', 409);
    }

    const loteIds = payload.items.map((item) => item.loteId.trim());
    await ensureLotesBelongToEmergency(client, oferta.emergency_id, loteIds);

    const previousSnapshot = await getOfertaById(client, ofertaId);
    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM oferta_historial
       WHERE oferta_id = $1`,
      [ofertaId],
    );

    await client.query(
      `INSERT INTO oferta_historial (oferta_id, version, snapshot, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [ofertaId, versionResult.rows[0].next_version, previousSnapshot, changedBy],
    );

    await client.query(
      `UPDATE ofertas
       SET observations = $2
       WHERE id = $1`,
      [ofertaId, payload.observations?.trim() || null],
    );
    await client.query('DELETE FROM oferta_lotes WHERE oferta_id = $1', [ofertaId]);
    await insertOfertaItems(client, ofertaId, payload.items);

    const updatedOferta = await getOfertaById(client, ofertaId);
    await client.query('COMMIT');
    return updatedOferta;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listOwnOfertaHistory(ofertaId, ongRef) {
  const ofertaResult = await pool.query('SELECT id FROM ofertas WHERE id = $1', [ofertaId]);
  if (ofertaResult.rowCount === 0) {
    throw createDomainError('Oferta no encontrada.', 404);
  }

  const ong = await findOngByRef(pool, ongRef);
  await ensureOngOwnsOferta(pool, ofertaId, ong.id);

  const historyResult = await pool.query(
    `SELECT version, snapshot, changed_by, changed_at
     FROM oferta_historial
     WHERE oferta_id = $1
     ORDER BY version ASC`,
    [ofertaId],
  );

  return historyResult.rows.map((row) => ({
    version: row.version,
    snapshot: row.snapshot,
    changedBy: row.changed_by,
    changedAt: row.changed_at.toISOString(),
  }));
}
