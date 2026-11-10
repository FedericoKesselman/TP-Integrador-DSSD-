import pool, { withTransaction } from '../db.js';
import { changeEmergencyStatus, lockEmergency } from '../emergencies/state-machine.js';
import { createDomainError, isUuid } from '../errors.js';

// Guarda la selección del municipio (reemplaza la anterior). Las ofertas NO
// cambian de estado: solo pasan a adjudicada / no_seleccionada cuando el SN
// confirma el compromiso. Devuelve la selección anterior para poder deshacer.
export async function saveSeleccion(emergencyId, ofertaIds) {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);
    if (emergency.status !== 'validada') {
      throw createDomainError(
        `Solo se puede adjudicar con la emergencia validada (estado actual: "${emergency.status}").`,
        409,
      );
    }

    const unique = [...new Set(ofertaIds)];
    const validas = await client.query(
      `SELECT id FROM ofertas
       WHERE emergency_id = $1 AND status = 'validada' AND id = ANY($2::uuid[])`,
      [emergencyId, unique],
    );
    if (validas.rowCount !== unique.length) {
      throw createDomainError(
        'Hay ofertas que no están validadas o no pertenecen a esta emergencia.',
        400,
      );
    }

    const previous = await client.query(
      'SELECT oferta_id FROM adjudicaciones WHERE emergency_id = $1',
      [emergencyId],
    );
    await client.query('DELETE FROM adjudicaciones WHERE emergency_id = $1', [emergencyId]);
    await client.query(
      `INSERT INTO adjudicaciones (emergency_id, oferta_id)
       SELECT $1::uuid, oferta_id FROM unnest($2::uuid[]) AS oferta_id`,
      [emergencyId, unique],
    );

    return { previousOfertaIds: previous.rows.map((row) => row.oferta_id) };
  });
}

// Deshace `saveSeleccion` si Bonita no pudo completar "Adjudicar Ofertas".
export async function restoreSeleccion(emergencyId, previousOfertaIds) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM adjudicaciones WHERE emergency_id = $1', [emergencyId]);
    if (previousOfertaIds.length > 0) {
      await client.query(
        `INSERT INTO adjudicaciones (emergency_id, oferta_id)
         SELECT $1::uuid, oferta_id FROM unnest($2::uuid[]) AS oferta_id`,
        [emergencyId, previousOfertaIds],
      );
    }
  });
}

// Body de `POST /compromisos` del SN con la selección del municipio. La
// cantidad de cada recurso es lo que el SN habilitó en la validación (con tope
// en lo ofrecido); si una oferta no tiene validación se usa lo ofrecido.
export async function getAdjudicacionBody(emergencyId) {
  const emergency = await pool.query('SELECT id FROM emergencies WHERE id = $1', [emergencyId]);
  if (emergency.rowCount === 0) throw createDomainError('Emergencia no encontrada.', 404);

  const selected = await pool.query(
    `SELECT a.oferta_id FROM adjudicaciones a
     WHERE a.emergency_id = $1
     ORDER BY a.created_at ASC, a.oferta_id ASC`,
    [emergencyId],
  );
  if (selected.rowCount === 0) {
    throw createDomainError('El municipio todavía no eligió ofertas para adjudicar.', 409);
  }
  const ofertaIds = selected.rows.map((row) => row.oferta_id);

  const ongs = await pool.query(
    `SELECT oo.oferta_id, o.bonita_org_ref AS ref, oo.role
     FROM oferta_ongs oo
     JOIN ongs o ON o.id = oo.ong_id
     WHERE oo.oferta_id = ANY($1::uuid[]) AND o.bonita_org_ref IS NOT NULL
     ORDER BY (oo.role = 'principal') DESC, oo.created_at ASC, o.bonita_org_ref ASC`,
    [ofertaIds],
  );
  const items = await pool.query(
    `SELECT ol.oferta_id, ol.lote_id, l.resource_code, ol.quantity_offered
     FROM oferta_lotes ol
     JOIN lotes l ON l.id = ol.lote_id
     WHERE ol.oferta_id = ANY($1::uuid[])
     ORDER BY ol.created_at ASC`,
    [ofertaIds],
  );
  const validaciones = await pool.query(
    'SELECT oferta_id, capacidades FROM oferta_validaciones WHERE oferta_id = ANY($1::uuid[])',
    [ofertaIds],
  );
  const habilitadaByOferta = new Map(
    validaciones.rows.map((row) => [
      row.oferta_id,
      new Map((row.capacidades ?? []).map((c) => [c.loteId, c.cantidadHabilitada])),
    ]),
  );

  const ofertas = ofertaIds
    .map((ofertaId) => {
      const habilitadas = habilitadaByOferta.get(ofertaId);
      // Un mismo recurso puede estar en más de un lote: se suma por código.
      const cantidadPorRecurso = new Map();
      items.rows
        .filter((row) => row.oferta_id === ofertaId)
        .forEach((row) => {
          // Sin validación se usa lo ofrecido; con validación, un lote que el SN no
          // habilitó no se compromete (0).
          const habilitada = habilitadas
            ? (habilitadas.get(row.lote_id) ?? 0)
            : row.quantity_offered;
          const cantidad = Math.min(row.quantity_offered, habilitada);
          cantidadPorRecurso.set(
            row.resource_code,
            (cantidadPorRecurso.get(row.resource_code) ?? 0) + cantidad,
          );
        });

      return {
        ofertaId,
        ongs: ongs.rows
          .filter((row) => row.oferta_id === ofertaId)
          .map((row) => ({ ref: row.ref, rol: row.role === 'principal' ? 'principal' : 'apoyo' })),
        items: [...cantidadPorRecurso.entries()]
          .filter(([, cantidad]) => cantidad > 0)
          .map(([recursoCodigo, cantidad]) => ({ recursoCodigo, cantidad })),
      };
    })
    .filter((oferta) => oferta.items.length > 0);

  if (ofertas.length === 0) {
    throw createDomainError('Las ofertas elegidas no tienen cantidades habilitadas.', 409);
  }

  return { emergenciaId: emergencyId, ofertas };
}

// Valida el body de `compromiso-confirmado` (los `compromisos` de la respuesta del SN).
export function validateCompromisosPayload(body) {
  if (!body || !Array.isArray(body.compromisos) || body.compromisos.length === 0) {
    return { compromisos: 'compromisos debe ser un array con al menos un elemento.' };
  }
  const errors = {};
  body.compromisos.forEach((compromiso, index) => {
    if (!isUuid(compromiso?.ofertaId)) {
      errors[`compromisos[${index}].ofertaId`] = 'Debe ser un UUID.';
    }
    if (typeof compromiso?.compromisoId !== 'string' || !compromiso.compromisoId) {
      errors[`compromisos[${index}].compromisoId`] = 'Es obligatorio.';
    }
    if (compromiso?.reparto !== undefined && !Array.isArray(compromiso.reparto)) {
      errors[`compromisos[${index}].reparto`] = 'Debe ser un array.';
    }
  });
  return errors;
}

// El SN confirmó el compromiso: ofertas → adjudicada / no_seleccionada y
// emergencia → adjudicada, en una transacción.
export async function confirmarCompromiso(emergencyId, compromisos, changedBy = 'bonita') {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);
    // Reintento de Bonita (no vio la respuesta): el compromiso ya está confirmado.
    if (emergency.status === 'adjudicada') {
      return { emergencyId, status: 'adjudicada', alreadyApplied: true };
    }
    if (emergency.status !== 'validada') {
      throw createDomainError(
        `Solo se puede confirmar el compromiso con la emergencia validada (estado actual: "${emergency.status}").`,
        409,
      );
    }

    const selected = await client.query(
      'SELECT oferta_id FROM adjudicaciones WHERE emergency_id = $1',
      [emergencyId],
    );
    const selectedIds = new Set(selected.rows.map((row) => row.oferta_id));
    const unknown = compromisos.filter((c) => !selectedIds.has(c.ofertaId)).map((c) => c.ofertaId);
    if (unknown.length > 0) {
      throw createDomainError('El compromiso incluye ofertas que el municipio no eligió.', 400, {
        detalle: { ofertasNoElegidas: unknown },
      });
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const compromiso of compromisos) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `UPDATE adjudicaciones SET compromiso_id = $3, reparto = $4::jsonb
         WHERE emergency_id = $1 AND oferta_id = $2`,
        [
          emergencyId,
          compromiso.ofertaId,
          compromiso.compromisoId,
          JSON.stringify(compromiso.reparto ?? []),
        ],
      );
    }

    const adjudicadasIds = compromisos.map((c) => c.ofertaId);
    await client.query("UPDATE ofertas SET status = 'adjudicada' WHERE id = ANY($1::uuid[])", [
      adjudicadasIds,
    ]);
    await client.query(
      "UPDATE ofertas SET status = 'no_seleccionada' WHERE emergency_id = $1 AND status = 'validada'",
      [emergencyId],
    );
    await client.query('UPDATE emergencies SET ultimo_conflicto_compromiso = NULL WHERE id = $1', [
      emergencyId,
    ]);
    await changeEmergencyStatus(client, emergency, 'adjudicada', changedBy);

    return { emergencyId, status: 'adjudicada', ofertasAdjudicadas: adjudicadasIds.length };
  });
}

// El SN rechazó el compromiso (409): la selección queda sin efecto y el detalle
// se guarda para mostrárselo al municipio. La emergencia sigue `validada`.
export async function registrarCompromisoFallido(emergencyId, detalle) {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);
    if (emergency.status !== 'validada') {
      throw createDomainError(
        `Solo se puede registrar un compromiso fallido con la emergencia validada (estado actual: "${emergency.status}").`,
        409,
      );
    }

    await client.query('DELETE FROM adjudicaciones WHERE emergency_id = $1', [emergencyId]);
    await client.query(
      'UPDATE emergencies SET ultimo_conflicto_compromiso = $2::jsonb WHERE id = $1',
      [emergencyId, JSON.stringify({ detalle, registradoAt: new Date().toISOString() })],
    );

    return { emergencyId, status: 'validada' };
  });
}
