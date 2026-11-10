import { Router } from 'express';

import { getIndicadores } from '../dashboard/dashboard-repository.js';
import { sendError } from '../errors.js';
import { requireRole, requireSession } from '../middleware/auth-middleware.js';

const router = Router();

router.use(requireSession);
router.use(requireRole('auditor'));

// GET /api/dashboard/indicadores — datos propios (Postgres), sin Bonita.
router.get('/indicadores', async (req, res) => {
  try {
    return res.json(await getIndicadores());
  } catch (error) {
    return sendError(res, error, 'No se pudieron calcular los indicadores.');
  }
});

export default router;
