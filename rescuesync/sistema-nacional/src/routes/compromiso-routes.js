import { Router } from 'express';

import { comprometerRecursos } from '../compromisos/comprometer-recursos.js';
import { asyncHandler, badRequest } from '../errors.js';
import { requireAuth, requireRole } from '../middleware/auth-middleware.js';

const router = Router();

// POST /compromisos — lo llama Bonita después de que el municipio adjudica.
router.post(
  '/',
  requireAuth, // 1) ¿trae un JWT válido? si no → 401
  requireRole('integracion'), // 2) ¿el token es de Bonita (cuenta de integración)? si no → 403
  asyncHandler(async (req, res) => {
    const { emergenciaId, ofertas } = req.body;

    // 3) Controles mínimos del body. Si falta algo → 400
    if (!emergenciaId) {
      throw badRequest('Falta emergenciaId.');
    }
    if (!Array.isArray(ofertas) || ofertas.length === 0) {
      throw badRequest('ofertas tiene que ser una lista con al menos una oferta.');
    }

    // 4) Reservar y responder con el resultado.
    const resultado = await comprometerRecursos(emergenciaId, ofertas);
    res.json(resultado);
  }),
);

export default router;
