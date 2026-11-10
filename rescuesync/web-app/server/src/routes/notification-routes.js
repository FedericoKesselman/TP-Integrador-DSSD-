import { Router } from 'express';

import { isUuid, sendError } from '../errors.js';
import { requireRole, requireSession } from '../middleware/auth-middleware.js';
import {
  listNotificationsForOng,
  markNotificationRead,
} from '../notifications/notifications-repository.js';

// Bandeja de la ONG. Los avisos los crea Bonita por /api/internal/* (con
// X-Integration-Key) y la web-app al reformular; acá solo se leen y se marcan.
const router = Router();

router.use(requireSession);
router.use(requireRole('representante_ong'));

// GET /api/notifications — todos los tipos de aviso de la ONG de la sesión
router.get('/', async (req, res) => {
  try {
    return res.json(await listNotificationsForOng(req.session.ongRef));
  } catch (error) {
    return sendError(res, error, 'No se pudieron cargar los avisos.');
  }
});

// PATCH /api/notifications/:id/leida — marca como leído un aviso propio
router.patch('/:id/leida', async (req, res) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ message: 'El id del aviso debe ser un UUID.' });
  }
  try {
    return res.json(await markNotificationRead(req.params.id, req.session.ongRef));
  } catch (error) {
    return sendError(res, error, 'No se pudo marcar el aviso como leído.');
  }
});

export default router;
