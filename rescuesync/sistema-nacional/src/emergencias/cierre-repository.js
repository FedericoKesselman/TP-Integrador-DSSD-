import { withTransaction } from '../db.js';
import { badRequest } from '../errors.js';

// Orden de locks del SN (para no generar deadlocks con /compromisos):
// primero filas de `compromisos`, después filas de `ong_recursos` ORDER BY id.

// ONGs con compromisos activos en la emergencia que todavía no informaron
// la finalización.
async function selectOngsSinFinalizar(client, emergenciaId) {
  const { rows } = await client.query(
    `SELECT DISTINCT o.ref
       FROM compromisos c
       JOIN compromiso_items i ON i.compromiso_id = c.id
       JOIN ong_recursos r ON r.id = i.ong_recurso_id
       JOIN ongs o ON o.id = r.ong_id
      WHERE c.emergencia_id = $1 AND c.estado = 'activo'
        AND NOT EXISTS (
          SELECT 1 FROM emergencia_finalizaciones f
           WHERE f.emergencia_id = c.emergencia_id AND f.ong_id = o.id)
      ORDER BY o.ref`,
    [emergenciaId],
  );
  return rows.map((row) => row.ref);
}

// POST /emergencias/:id/finalizacion: registra qué ONGs terminaron su
// actividad. Idempotente (repetir una ONG no cambia su fecha). No libera
// recursos: eso lo hace el cierre.
export async function registrarFinalizacion(emergenciaId, ongRefs) {
  return withTransaction(async (client) => {
    const { rows: ongs } = await client.query(
      'SELECT id, ref FROM ongs WHERE ref = ANY($1::text[])',
      [ongRefs],
    );
    const conocidas = new Set(ongs.map((ong) => ong.ref));
    const desconocidas = ongRefs.filter((ref) => !conocidas.has(ref));
    if (desconocidas.length > 0) {
      throw badRequest('Hay ONGs que no existen en el Sistema Nacional.', {
        ongRefsDesconocidas: desconocidas,
      });
    }

    await client.query(
      `INSERT INTO emergencia_finalizaciones (emergencia_id, ong_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT (emergencia_id, ong_id) DO NOTHING`,
      [emergenciaId, ongs.map((ong) => ong.id)],
    );

    const { rows: finalizadas } = await client.query(
      `SELECT o.ref, f.finalizada_at
         FROM emergencia_finalizaciones f
         JOIN ongs o ON o.id = f.ong_id
        WHERE f.emergencia_id = $1
        ORDER BY o.ref`,
      [emergenciaId],
    );
    return {
      emergenciaId,
      finalizadas: finalizadas.map((row) => ({
        ongRef: row.ref,
        finalizadaAt: row.finalizada_at,
      })),
      ongsSinFinalizar: await selectOngsSinFinalizar(client, emergenciaId),
    };
  });
}

// POST /emergencias/:id/cierre: cierra el proyecto y libera todo lo
// comprometido. Idempotente: un segundo cierre (o uno concurrente) no
// encuentra compromisos activos y no libera nada de nuevo. Con 0
// compromisos (emergencia sin ofertas adjudicadas) responde igual 200.
export async function cerrarEmergencia(emergenciaId) {
  return withTransaction(async (client) => {
    // 1) Bloquea los compromisos activos. Un cierre concurrente espera acá y,
    //    al seguir, ya no los ve activos (READ COMMITTED reevalúa el WHERE).
    const { rows: compromisos } = await client.query(
      `SELECT id FROM compromisos
        WHERE emergencia_id = $1 AND estado = 'activo'
        ORDER BY id
          FOR UPDATE`,
      [emergenciaId],
    );
    const ongsSinFinalizar = await selectOngsSinFinalizar(client, emergenciaId);
    const compromisoIds = compromisos.map((row) => row.id);

    let recursosLiberados = [];
    if (compromisoIds.length > 0) {
      // 2) Bloquea el stock involucrado, siempre en orden de id.
      await client.query(
        `SELECT r.id FROM ong_recursos r
          WHERE r.id IN (SELECT ong_recurso_id FROM compromiso_items
                          WHERE compromiso_id = ANY($1::uuid[]))
          ORDER BY r.id
            FOR UPDATE`,
        [compromisoIds],
      );
      // 3) Devuelve lo comprometido. El CHECK (>= 0) de la tabla frena
      //    cualquier inconsistencia en lugar de dejar stock negativo.
      const { rows } = await client.query(
        `WITH liberado AS (
           SELECT ong_recurso_id, SUM(cantidad)::int AS cantidad
             FROM compromiso_items
            WHERE compromiso_id = ANY($1::uuid[])
            GROUP BY ong_recurso_id)
         UPDATE ong_recursos r
            SET cantidad_comprometida = r.cantidad_comprometida - l.cantidad
           FROM liberado l, ongs o
          WHERE r.id = l.ong_recurso_id AND o.id = r.ong_id
         RETURNING o.ref AS ong_ref, r.recurso_codigo, l.cantidad`,
        [compromisoIds],
      );
      recursosLiberados = rows
        .map((row) => ({
          ongRef: row.ong_ref,
          recursoCodigo: row.recurso_codigo,
          cantidad: row.cantidad,
        }))
        .sort(
          (a, b) =>
            a.ongRef.localeCompare(b.ongRef) || a.recursoCodigo.localeCompare(b.recursoCodigo),
        );
      await client.query(
        `UPDATE compromisos SET estado = 'liberado', liberado_at = now()
          WHERE id = ANY($1::uuid[])`,
        [compromisoIds],
      );
    }

    return {
      emergenciaId,
      compromisosLiberados: compromisoIds.length,
      recursosLiberados,
      ongsSinFinalizar,
    };
  });
}
