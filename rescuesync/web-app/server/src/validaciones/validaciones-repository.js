import pool, { withTransaction } from '../db.js';
import { changeEmergencyStatus, lockEmergency } from '../emergencies/state-machine.js';
import { createDomainError } from '../errors.js';
import { getOfertaById } from '../ofertas/ofertas-repository.js';

// E5-13: body de `POST /validaciones` del Sistema Nacional. Solo ofertas no
// retiradas; el rol `asociada` de la web-app es `apoyo` en el SN.
export async function getConsolidado(emergencyId) {
  const emergencyResult = await pool.query('SELECT id, severity FROM emergencies WHERE id = $1', [
    emergencyId,
  ]);
  if (emergencyResult.rowCount === 0) {
    throw createDomainError('Emergencia no encontrada.', 404);
  }

  const lotesResult = await pool.query(
    `SELECT id, resource_code, quantity_requested
     FROM lotes WHERE emergency_id = $1 ORDER BY created_at ASC`,
    [emergencyId],
  );
  const ofertasResult = await pool.query(
    `SELECT id FROM ofertas
     WHERE emergency_id = $1 AND status <> 'retirada'
     ORDER BY created_at ASC`,
    [emergencyId],
  );
  const ofertaIds = ofertasResult.rows.map((row) => row.id);

  const ongsResult = await pool.query(
    `SELECT oo.oferta_id, o.bonita_org_ref AS ref, oo.role
     FROM oferta_ongs oo
     JOIN ongs o ON o.id = oo.ong_id
     WHERE oo.oferta_id = ANY($1::uuid[]) AND o.bonita_org_ref IS NOT NULL
     ORDER BY (oo.role = 'principal') DESC, oo.created_at ASC, o.bonita_org_ref ASC`,
    [ofertaIds],
  );
  const itemsResult = await pool.query(
    `SELECT ol.oferta_id, ol.lote_id, l.resource_code, ol.quantity_offered
     FROM oferta_lotes ol
     JOIN lotes l ON l.id = ol.lote_id
     WHERE ol.oferta_id = ANY($1::uuid[])
     ORDER BY ol.created_at ASC`,
    [ofertaIds],
  );

  return {
    emergenciaId: emergencyId,
    severidad: emergencyResult.rows[0].severity,
    lotes: lotesResult.rows.map((row) => ({
      id: row.id,
      recursoCodigo: row.resource_code,
      cantidadSolicitada: row.quantity_requested,
    })),
    ofertas: ofertaIds.map((ofertaId) => ({
      ofertaId,
      ongs: ongsResult.rows
        .filter((row) => row.oferta_id === ofertaId)
        .map((row) => ({ ref: row.ref, rol: row.role === 'principal' ? 'principal' : 'apoyo' })),
      items: itemsResult.rows
        .filter((row) => row.oferta_id === ofertaId)
        .map((row) => ({
          loteId: row.lote_id,
          recursoCodigo: row.resource_code,
          cantidadOfrecida: row.quantity_offered,
        })),
    })),
  };
}

// E5-15: guarda lo que respondió el SN. Ofertas → `validada` y emergencia →
// `validada`, todo en una transacción. Con 0 ofertas `resultados` es [] y igual
// se avanza (la decisión la toma el coordinador).
export async function saveValidaciones(emergencyId, body, changedBy = 'bonita') {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);
    // Bonita puede reintentar la tarea de servicio si no vio la respuesta: no es un error.
    if (emergency.status === 'validada') {
      return {
        emergencyId,
        status: 'validada',
        alreadyApplied: true,
        todosLosLotesCubiertos: emergency.validacion_resumen?.todosLosLotesCubiertos ?? null,
      };
    }
    if (emergency.status !== 'convocatoria_cerrada') {
      throw createDomainError(
        `Solo se puede validar con la convocatoria cerrada (estado actual: "${emergency.status}").`,
        409,
      );
    }

    const ofertasResult = await client.query(
      "SELECT id FROM ofertas WHERE emergency_id = $1 AND status <> 'retirada'",
      [emergencyId],
    );
    const expected = new Set(ofertasResult.rows.map((row) => row.id));
    const received = new Set(body.resultados.map((resultado) => resultado.ofertaId));
    const unknown = [...received].filter((id) => !expected.has(id));
    const missing = [...expected].filter((id) => !received.has(id));
    if (unknown.length > 0 || missing.length > 0) {
      throw createDomainError(
        'Los resultados no coinciden con las ofertas de la emergencia.',
        400,
        {
          detalle: { ofertasDesconocidas: unknown, ofertasSinResultado: missing },
        },
      );
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const resultado of body.resultados) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO oferta_validaciones
           (oferta_id, nivel_habilitacion, rol_sugerido, nivel_riesgo_permitido,
            capacidades, observaciones)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
         ON CONFLICT (oferta_id) DO UPDATE SET
           nivel_habilitacion = EXCLUDED.nivel_habilitacion,
           rol_sugerido = EXCLUDED.rol_sugerido,
           nivel_riesgo_permitido = EXCLUDED.nivel_riesgo_permitido,
           capacidades = EXCLUDED.capacidades,
           observaciones = EXCLUDED.observaciones`,
        [
          resultado.ofertaId,
          resultado.nivelHabilitacion,
          resultado.rolSugerido,
          resultado.nivelRiesgoPermitido,
          JSON.stringify(resultado.capacidadesHabilitadas ?? []),
          JSON.stringify(resultado.observaciones ?? []),
        ],
      );
    }

    if (expected.size > 0) {
      await client.query("UPDATE ofertas SET status = 'validada' WHERE id = ANY($1::uuid[])", [
        [...expected],
      ]);
    }
    await client.query('UPDATE emergencies SET validacion_resumen = $2::jsonb WHERE id = $1', [
      emergencyId,
      JSON.stringify(body.resumen),
    ]);
    await changeEmergencyStatus(client, emergency, 'validada', changedBy);

    return {
      emergencyId,
      status: 'validada',
      todosLosLotesCubiertos: body.resumen.todosLosLotesCubiertos,
    };
  });
}

// E5-16: ofertas de la emergencia con su perfil de validación y la cobertura
// por lote. `soloValidadas` es la vista del municipio.
export async function listOfertasWithValidation(emergencyId, { soloValidadas = false } = {}) {
  const emergencyResult = await pool.query(
    'SELECT id, status, validacion_resumen FROM emergencies WHERE id = $1',
    [emergencyId],
  );
  if (emergencyResult.rowCount === 0) {
    throw createDomainError('Emergencia no encontrada.', 404);
  }
  const emergency = emergencyResult.rows[0];

  const lotesResult = await pool.query(
    'SELECT * FROM lotes WHERE emergency_id = $1 ORDER BY created_at ASC',
    [emergencyId],
  );
  const statusFilter = soloValidadas ? "f.status = 'validada'" : "f.status <> 'retirada'";
  const idsResult = await pool.query(
    `SELECT f.id FROM ofertas f
     WHERE f.emergency_id = $1 AND ${statusFilter}
     ORDER BY f.created_at ASC`,
    [emergencyId],
  );
  const ofertaIds = idsResult.rows.map((row) => row.id);

  const validacionesResult = await pool.query(
    'SELECT * FROM oferta_validaciones WHERE oferta_id = ANY($1::uuid[])',
    [ofertaIds],
  );
  const validacionByOferta = new Map(validacionesResult.rows.map((row) => [row.oferta_id, row]));

  // El resumen solo vale mientras la emergencia está validada (o más adelante);
  // al reabrir queda viejo y no se muestra.
  const resumenVigente = ['validada', 'adjudicada', 'en_ejecucion', 'finalizada'].includes(
    emergency.status,
  )
    ? emergency.validacion_resumen
    : null;
  const cubiertaByLote = new Map(
    (resumenVigente?.cobertura ?? []).map((item) => [item.loteId, item.cubierta]),
  );

  const ofertas = await Promise.all(
    ofertaIds.map(async (ofertaId) => {
      const oferta = await getOfertaById(pool, ofertaId);
      const validacion = validacionByOferta.get(ofertaId);
      return {
        ...oferta,
        validacion: validacion
          ? {
              nivelHabilitacion: validacion.nivel_habilitacion,
              rolSugerido: validacion.rol_sugerido,
              nivelRiesgoPermitido: validacion.nivel_riesgo_permitido,
              capacidadesHabilitadas: validacion.capacidades,
              observaciones: validacion.observaciones,
            }
          : null,
      };
    }),
  );

  return {
    emergencyId,
    status: emergency.status,
    todosLosLotesCubiertos: resumenVigente?.todosLosLotesCubiertos ?? null,
    lotes: lotesResult.rows.map((row) => ({
      id: row.id,
      resourceType: row.resource_type,
      resourceCode: row.resource_code,
      unit: row.unit,
      quantityRequested: row.quantity_requested,
      cubierta: cubiertaByLote.has(row.id) ? cubiertaByLote.get(row.id) : null,
    })),
    ofertas,
  };
}
