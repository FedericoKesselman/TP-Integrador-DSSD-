import { Router } from 'express';

import { cerrarEmergencia, registrarFinalizacion } from '../emergencias/cierre-repository.js';
import { asyncHandler, badRequest } from '../errors.js';
import { requireAuth, requireRole } from '../middleware/auth-middleware.js';

const router = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use(requireAuth, requireRole('integracion'));

// Valida el :emergenciaId (id de la web-app) antes de llegar a la base.
router.param('emergenciaId', (req, res, next, id) => {
  if (!UUID_PATTERN.test(id)) {
    return next(badRequest('emergenciaId tiene que ser un UUID.'));
  }
  return next();
});

// POST /emergencias/:emergenciaId/finalizacion — { ongRefs: [...] }
router.post(
  '/:emergenciaId/finalizacion',
  asyncHandler(async (req, res) => {
    const { ongRefs } = req.body ?? {};
    const valido =
      Array.isArray(ongRefs) &&
      ongRefs.length > 0 &&
      ongRefs.every((ref) => typeof ref === 'string' && ref.length > 0);
    if (!valido) {
      throw badRequest('ongRefs tiene que ser una lista no vacía de refs de ONG.');
    }
    const unicos = [...new Set(ongRefs)];
    res.json(await registrarFinalizacion(req.params.emergenciaId, unicos));
  }),
);

// POST /emergencias/:emergenciaId/cierre — libera todo lo comprometido.
router.post(
  '/:emergenciaId/cierre',
  asyncHandler(async (req, res) => {
    res.json(await cerrarEmergencia(req.params.emergenciaId));
  }),
);

export default router;
