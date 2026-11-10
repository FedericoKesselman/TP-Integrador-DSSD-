import pool, { withTransaction } from '../db.js';
import { lockEmergency } from '../emergencies/state-machine.js';
import { createDomainError } from '../errors.js';

function assertStatus(emergency, allowed, tipo) {
  if (!allowed.includes(emergency.status)) {
    throw createDomainError(
      `No se puede avisar "${tipo}" con la emergencia en estado "${emergency.status}".`,
      409,
    );
  }
}

// Avisos que pide Bonita. La web-app decide los destinatarios. Idempotente: la
// clave única (emergencia, ONG, tipo, ronda) evita duplicados ante reintentos,
// y al reabrir la convocatoria (ronda nueva) las ONGs vuelven a recibir aviso.
export async function createNotificationsFromBonita(emergencyId, tipo) {
  return withTransaction(async (client) => {
    const emergency = await lockEmergency(client, emergencyId);
    const ronda = emergency.convocatoria_ronda;
    let created = 0;

    const insertForAllOngs = async (tipoAviso) => {
      const result = await client.query(
        `INSERT INTO notifications (emergency_id, ong_id, tipo, ronda)
         SELECT $1::uuid, id, $2::text, $3::integer FROM ongs
         ON CONFLICT (emergency_id, ong_id, tipo, ronda) DO NOTHING`,
        [emergencyId, tipoAviso, ronda],
      );
      return result.rowCount;
    };

    if (tipo === 'CONVOCATORIA') {
      assertStatus(emergency, ['convocatoria_abierta'], tipo);
      created = await insertForAllOngs('CONVOCATORIA');
    } else if (tipo === 'CIERRE_CONVOCATORIA') {
      assertStatus(emergency, ['convocatoria_cerrada'], tipo);
      created = await insertForAllOngs('CIERRE_CONVOCATORIA');
    } else if (tipo === 'COMPROMISO') {
      // Se acepta también en ejecución por si Bonita reintenta tarde.
      assertStatus(emergency, ['adjudicada', 'en_ejecucion'], tipo);
      const adjudicadas = await client.query(
        `INSERT INTO notifications (emergency_id, ong_id, tipo, ronda)
         SELECT DISTINCT $1::uuid, oo.ong_id, 'ADJUDICADA', $2::integer
         FROM ofertas f JOIN oferta_ongs oo ON oo.oferta_id = f.id
         WHERE f.emergency_id = $1 AND f.status IN ('adjudicada', 'finalizada')
         ON CONFLICT (emergency_id, ong_id, tipo, ronda) DO NOTHING`,
        [emergencyId, ronda],
      );
      // Una ONG con alguna oferta adjudicada no recibe además NO_SELECCIONADA.
      const noSeleccionadas = await client.query(
        `INSERT INTO notifications (emergency_id, ong_id, tipo, ronda)
         SELECT DISTINCT $1::uuid, oo.ong_id, 'NO_SELECCIONADA', $2::integer
         FROM ofertas f JOIN oferta_ongs oo ON oo.oferta_id = f.id
         WHERE f.emergency_id = $1 AND f.status = 'no_seleccionada'
           AND oo.ong_id NOT IN (
             SELECT oo2.ong_id
             FROM ofertas f2 JOIN oferta_ongs oo2 ON oo2.oferta_id = f2.id
             WHERE f2.emergency_id = $1 AND f2.status IN ('adjudicada', 'finalizada')
           )
         ON CONFLICT (emergency_id, ong_id, tipo, ronda) DO NOTHING`,
        [emergencyId, ronda],
      );
      created = adjudicadas.rowCount + noSeleccionadas.rowCount;
    }

    return { emergenciaId: emergencyId, tipo, created };
  });
}

// Bandeja de la ONG de la sesión: todos los tipos de aviso, más recientes primero.
export async function listNotificationsForOng(ongRef) {
  const { rows } = await pool.query(
    `SELECT n.id, n.tipo, n.leida_at, n.emergency_id AS "emergencyId",
            e.description AS "emergencyDescription", e.type AS "emergencyType",
            e.severity AS "emergencySeverity", e.province AS "emergencyProvince",
            e.municipality AS "emergencyMunicipality", e.status AS "emergencyStatus",
            n.created_at AS "createdAt"
     FROM notifications n
     JOIN ongs o ON o.id = n.ong_id
     JOIN emergencies e ON e.id = n.emergency_id
     WHERE o.bonita_org_ref = $1
     ORDER BY n.created_at DESC`,
    [ongRef],
  );
  return rows.map(({ leida_at: leidaAt, ...row }) => ({
    ...row,
    leida: leidaAt !== null,
    leidaAt: leidaAt ? leidaAt.toISOString() : null,
  }));
}

// Marca como leído un aviso propio (idempotente: conserva la primera fecha).
export async function markNotificationRead(notificationId, ongRef) {
  const { rows } = await pool.query(
    `UPDATE notifications n
     SET leida_at = COALESCE(n.leida_at, now())
     FROM ongs o
     WHERE n.id = $1 AND o.id = n.ong_id AND o.bonita_org_ref = $2
     RETURNING n.id, n.leida_at`,
    [notificationId, ongRef],
  );
  if (rows.length === 0) throw createDomainError('Aviso no encontrado.', 404);
  return { id: rows[0].id, leida: true, leidaAt: rows[0].leida_at.toISOString() };
}
