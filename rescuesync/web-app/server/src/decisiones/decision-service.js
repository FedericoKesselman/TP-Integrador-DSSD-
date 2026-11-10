import { completePendingTasks } from '../bonita/bonita-client.js';
import { withTransaction } from '../db.js';
import { getEmergencyById } from '../emergencies/emergencies-repository.js';
import {
  changeEmergencyStatus,
  lockEmergency,
  revertEmergencyStatus,
} from '../emergencies/state-machine.js';
import { createDomainError } from '../errors.js';
import { getOfertaById } from '../ofertas/ofertas-repository.js';

const TASK_DECIDIR = 'Decidir como Continuar';
const TASK_PUBLICAR = 'Publicar Convocatoria';

// Dentro de la transacción: la decisión solo vale con la emergencia validada
// (el chequeo de `decide` pudo quedar viejo si otro pedido se coló antes).
function assertValidada(emergency) {
  if (emergency.status !== 'validada') {
    throw createDomainError(
      `Solo se puede decidir con la emergencia validada (estado actual: "${emergency.status}").`,
      409,
    );
  }
}

// Completa tareas del caso en Bonita. Si Bonita da error, o alguna de las
// tareas `required` no estaba pendiente, tira un error de dominio 502.
async function completeInBonita(session, emergency, taskNames, inputs) {
  let completed;
  try {
    ({ completed } = await completePendingTasks(session, emergency.bonitaCaseId, taskNames, {
      inputs,
    }));
  } catch (error) {
    console.error(`Decisión de ${emergency.id}: Bonita no pudo avanzar:`, error, error.completed);
    throw createDomainError('No se pudo registrar la decisión en Bonita; reintentá.', 502);
  }
  const missing = taskNames.filter((name) => !completed.includes(name));
  if (missing.length > 0) {
    console.error(`Decisión de ${emergency.id}: tareas no pendientes en Bonita:`, missing);
    throw createDomainError(
      `Bonita no tenía pendiente "${missing[0]}"; la decisión no se aplicó.`,
      502,
    );
  }
}

// REABRIR: las ofertas validadas vuelven a `registrada`, la emergencia vuelve a
// `convocatoria_abierta` con una nueva ventana (y se descarta la selección vieja).
// Devuelve los ids de ofertas movidas por si hay que deshacer.
async function applyReabrir(emergencyId, duracionMinutos, changedBy) {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);
    assertValidada(emergency);
    const moved = await client.query(
      `UPDATE ofertas SET status = 'registrada'
       WHERE emergency_id = $1 AND status = 'validada'
       RETURNING id`,
      [emergencyId],
    );
    await client.query('DELETE FROM adjudicaciones WHERE emergency_id = $1', [emergencyId]);
    await client.query(
      `UPDATE emergencies
       SET duracion_convocatoria_min = $2,
           convocatoria_ronda = convocatoria_ronda + 1,
           ultimo_conflicto_compromiso = NULL
       WHERE id = $1`,
      [emergencyId, duracionMinutos],
    );
    await changeEmergencyStatus(client, emergency, 'convocatoria_abierta', changedBy);
    return moved.rows.map((row) => row.id);
  });
}

// Deshace `applyReabrir` si Bonita no pudo avanzar.
async function revertReabrir(emergencyId, movedOfertaIds) {
  await withTransaction(async (client) => {
    await lockEmergency(client, emergencyId);
    await revertEmergencyStatus(client, emergencyId, 'convocatoria_abierta', 'validada');
    if (movedOfertaIds.length > 0) {
      await client.query(
        `UPDATE ofertas SET status = 'validada'
         WHERE id = ANY($1::uuid[]) AND status = 'registrada'`,
        [movedOfertaIds],
      );
    }
    await client.query(
      `UPDATE emergencies
       SET convocatoria_ronda = GREATEST(convocatoria_ronda - 1, 0)
       WHERE id = $1 AND status = 'validada'`,
      [emergencyId],
    );
  });
}

// REFORMULAR: las ofertas pasan a `retirada` (con su snapshot en
// `oferta_historial`), se borran sus renglones, cada ONG con oferta recibe un
// aviso OFERTA_RETIRADA y la emergencia vuelve a `registrada` para rearmar
// lotes. Todo va en una transacción que NO se confirma hasta que Bonita avanza
// (`afterEffects`): Bonita no lee nada de la base en este paso, así que si falla,
// el rollback deja todo como estaba.
async function applyReformular(emergencyId, changedBy, afterEffects) {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);
    assertValidada(emergency);
    const ofertas = await client.query(
      `SELECT id FROM ofertas
       WHERE emergency_id = $1 AND status <> 'retirada'
       FOR UPDATE`,
      [emergencyId],
    );
    const ofertaIds = ofertas.rows.map((row) => row.id);

    // eslint-disable-next-line no-restricted-syntax
    for (const ofertaId of ofertaIds) {
      // eslint-disable-next-line no-await-in-loop
      const snapshot = await getOfertaById(client, ofertaId);
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO oferta_historial (oferta_id, version, snapshot, changed_by)
         VALUES (
           $1,
           (SELECT COALESCE(MAX(version), 0) + 1 FROM oferta_historial WHERE oferta_id = $1),
           $2::jsonb,
           $3
         )`,
        [ofertaId, JSON.stringify(snapshot), `reformular:${changedBy}`],
      );
    }

    if (ofertaIds.length > 0) {
      await client.query("UPDATE ofertas SET status = 'retirada' WHERE id = ANY($1::uuid[])", [
        ofertaIds,
      ]);
      await client.query('DELETE FROM oferta_lotes WHERE oferta_id = ANY($1::uuid[])', [ofertaIds]);
      // Aviso a cada ONG con oferta, en el mismo paso que retira las ofertas.
      await client.query(
        `INSERT INTO notifications (emergency_id, ong_id, tipo, ronda)
         SELECT DISTINCT $1::uuid, oo.ong_id, 'OFERTA_RETIRADA', $3::integer
         FROM oferta_ongs oo
         WHERE oo.oferta_id = ANY($2::uuid[])
         ON CONFLICT (emergency_id, ong_id, tipo, ronda) DO NOTHING`,
        [emergencyId, ofertaIds, emergency.convocatoria_ronda],
      );
    }

    await client.query('DELETE FROM adjudicaciones WHERE emergency_id = $1', [emergencyId]);
    await client.query(
      `UPDATE emergencies
       SET validacion_resumen = NULL, ultimo_conflicto_compromiso = NULL
       WHERE id = $1`,
      [emergencyId],
    );
    await changeEmergencyStatus(client, emergency, 'registrada', changedBy);

    await afterEffects();
    return ofertaIds.length;
  });
}

// E5-17: aplica la decisión del coordinador cuando no se cubrieron todos los
// lotes. Completa "Decidir como Continuar" en Bonita con `camino` y aplica el
// efecto en la web-app.
export async function decide({ emergencyId, camino, duracionMinutos, session, changedBy }) {
  const emergency = await getEmergencyById(emergencyId);
  if (!emergency) throw createDomainError('Emergencia no encontrada.', 404);
  if (emergency.status !== 'validada') {
    throw createDomainError(
      `Solo se puede decidir con la emergencia validada (estado actual: "${emergency.status}").`,
      409,
    );
  }
  if (!emergency.bonitaCaseId) {
    throw createDomainError('La emergencia no tiene caso en Bonita.', 409);
  }

  const decidirInput = { [TASK_DECIDIR]: { camino } };

  if (camino === 'continuar') {
    await completeInBonita(session, emergency, [TASK_DECIDIR], decidirInput);
    return { emergencyId, camino, status: 'validada' };
  }

  if (camino === 'reformular') {
    await applyReformular(emergencyId, changedBy, () =>
      completeInBonita(session, emergency, [TASK_DECIDIR], decidirInput),
    );
    return { emergencyId, camino, status: 'registrada' };
  }

  // reabrir: Bonita vuelve a "Publicar Convocatoria" y, al completarla, su
  // conector de avisos lee la emergencia: por eso el estado se confirma ANTES de
  // hablar con Bonita y se deshace si Bonita falla. Si falla justo después de
  // "Decidir" (y antes de "Publicar"), el caso queda esperando "Publicar
  // Convocatoria" en Bonita: se revierte la web-app y hay que revisar el caso.
  const moved = await applyReabrir(emergencyId, duracionMinutos, changedBy);
  try {
    await completeInBonita(session, emergency, [TASK_DECIDIR, TASK_PUBLICAR], {
      ...decidirInput,
      [TASK_PUBLICAR]: { duracionConvocatoria: duracionMinutos },
    });
  } catch (error) {
    await revertReabrir(emergencyId, moved);
    throw error;
  }
  return { emergencyId, camino, status: 'convocatoria_abierta', duracionMinutos };
}
