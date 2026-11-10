import pool, { withTransaction } from '../db.js';

// Única capa que sabe de SQL para la tabla `emergencies`. Mapea entre el
// objeto camelCase que usa el resto del server (mismo shape que
// docs/api-contracts.md) y las columnas snake_case de Postgres.

const INSERT_COLUMNS = [
  'type',
  'type_other',
  'severity',
  'province_id',
  'province',
  'municipality_id',
  'municipality',
  'affected_zone',
  'latitude',
  'longitude',
  'occurred_at',
  'estimated_affected_people',
  'description',
  'contact_name',
  'contact_phone',
];

// Convierte una fila de Postgres (snake_case) al objeto camelCase que
// devuelve la API (ver docs/api-contracts.md).
function rowToEmergency(row) {
  return {
    id: row.id,
    type: row.type,
    typeOther: row.type_other,
    severity: row.severity,
    provinceId: row.province_id,
    province: row.province,
    municipalityId: row.municipality_id,
    municipality: row.municipality,
    affectedZone: row.affected_zone,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    occurredAt: row.occurred_at.toISOString(),
    estimatedAffectedPeople: row.estimated_affected_people,
    description: row.description,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    status: row.status,
    bonitaCaseId: row.bonita_case_id,
    duracionConvocatoriaMin: row.duracion_convocatoria_min,
    // Último 409 del SN al registrar el compromiso (null si no hubo o ya se resolvió).
    ultimoConflictoCompromiso: row.ultimo_conflicto_compromiso,
    createdAt: row.created_at.toISOString(),
  };
}

// Alta de una emergencia. `status` y `bonita_case_id` quedan en su default
// de la tabla ('registrada' / NULL) — todavía no se integra con Bonita
// (eso es la Fase 5 del roadmap), no se insertan explícitamente acá.
export async function insertEmergency(payload, createdBy = null) {
  const values = [
    payload.type,
    payload.typeOther ?? null,
    payload.severity,
    payload.provinceId,
    payload.province,
    payload.municipalityId ?? null,
    payload.municipality,
    payload.affectedZone,
    payload.latitude ?? null,
    payload.longitude ?? null,
    payload.occurredAt,
    payload.estimatedAffectedPeople ?? null,
    payload.description,
    payload.contactName,
    payload.contactPhone,
  ];

  const placeholders = INSERT_COLUMNS.map((_, index) => `$${index + 1}`).join(', ');
  const query = `
    INSERT INTO emergencies (${INSERT_COLUMNS.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;

  return withTransaction(async (client) => {
    const { rows } = await client.query(query, values);
    await client.query(
      `INSERT INTO emergency_status_history (emergency_id, from_status, to_status, changed_by)
       VALUES ($1, NULL, $2, $3)`,
      [rows[0].id, rows[0].status, createdBy],
    );
    return rowToEmergency(rows[0]);
  });
}

// Listado completo, más reciente primero (ver docs/api-contracts.md).
export async function listEmergencies() {
  const { rows } = await pool.query('SELECT * FROM emergencies ORDER BY created_at DESC');
  return rows.map(rowToEmergency);
}

// Guarda el id del caso de Bonita una vez iniciado el proceso (Fase 5).
export async function setBonitaCaseId(id, caseId) {
  const { rows } = await pool.query(
    'UPDATE emergencies SET bonita_case_id = $1 WHERE id = $2 RETURNING *',
    [caseId, id],
  );
  return rowToEmergency(rows[0]);
}

// Obtener una emergencia por su ID
export async function getEmergencyById(id) {
  const { rows } = await pool.query('SELECT * FROM emergencies WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return rowToEmergency(rows[0]);
}
