import { Router } from 'express';

import { leerCasosYTareas } from '../dashboard/bonita-tiempos-source.js';
import { getIndicadores } from '../dashboard/dashboard-repository.js';
import { calcularTiemposEtapas, parsePeriodo } from '../dashboard/tiempos-etapas.js';
import { createDomainError, sendError } from '../errors.js';
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

// GET /api/dashboard/tiempos-etapas — datos de Bonita con la sesión del propio Auditor (solo GET).
router.get('/tiempos-etapas', async (req, res) => {
  try {
    const periodo = parsePeriodo(req.query);
    if (!req.session.bonita) {
      throw createDomainError('Tu sesión de Bonita venció. Volvé a iniciar sesión.', 401);
    }
    const { casos, tareas } = await leerCasosYTareas(req.session.bonita, periodo);
    return res.json(calcularTiemposEtapas(casos, tareas, periodo));
  } catch (error) {
    return sendError(res, error, 'No se pudieron calcular los tiempos por etapa.');
  }
});

export default router;
