import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';

import pool from '../db.js';
import { requireRole, requireSession } from '../middleware/auth-middleware.js';

const router = Router();

// Called by the automatic Bonita connector, independently of browser sessions.
router.post('/convocatoria', async (req, res) => {
  const token = process.env.BONITA_NOTIFICATION_TOKEN;
  if (!token) return res.status(503).json({ message: 'Notificaciones sin configurar.' });
  const expected = Buffer.from(`Bearer ${token}`);
  const received = Buffer.from(req.get('Authorization') || '');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return res.status(401).json({ message: 'Autenticación inválida.' });
  }
  const { emergenciaId } = req.body;
  if (
    typeof emergenciaId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emergenciaId)
  ) {
    return res.status(400).json({ message: 'emergenciaId debe ser un UUID.' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT status FROM emergencies WHERE id = $1 FOR UPDATE', [
      emergenciaId,
    ]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Emergencia no encontrada.' });
    }
    if (rows[0].status !== 'convocatoria_abierta') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'La convocatoria no está publicada.' });
    }
    const result = await client.query(
      `INSERT INTO notifications (emergency_id, ong_id)
       SELECT $1, id FROM ongs ON CONFLICT (emergency_id, ong_id) DO NOTHING`,
      [emergenciaId],
    );
    await client.query('COMMIT');
    return res.json({ emergenciaId, created: result.rowCount });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error al notificar convocatoria:', error);
    return res.status(500).json({ message: 'No se pudo notificar la convocatoria.' });
  } finally {
    client?.release();
  }
});

router.get('/', requireSession, requireRole('representante_ong'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.id, n.emergency_id AS "emergencyId", e.description AS "emergencyDescription",
              e.type AS "emergencyType", e.severity AS "emergencySeverity",
              e.province AS "emergencyProvince", e.municipality AS "emergencyMunicipality",
              e.status AS "emergencyStatus",
              n.created_at AS "createdAt"
       FROM notifications n
       JOIN ongs o ON o.id = n.ong_id
       JOIN emergencies e ON e.id = n.emergency_id
       WHERE o.bonita_org_ref = $1 ORDER BY n.created_at DESC`,
      [req.session.ongRef],
    );
    return res.json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron cargar los avisos.' });
  }
});

export default router;
