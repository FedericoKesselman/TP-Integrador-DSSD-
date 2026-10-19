import { Router } from 'express';

import { validateCompromisoRequest } from '../compromisos/compromiso-input.js';
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
    // 3) Forma del body. Si algo está mal → 400 con el detalle por campo.
    const errors = validateCompromisoRequest(req.body);
    if (Object.keys(errors).length > 0) {
      throw badRequest('Datos inválidos.', errors);
    }

    // 4) Reservar y responder con el resultado (409 si el stock no alcanza).
    const { emergenciaId, ofertas } = req.body;
    res.json(await comprometerRecursos(emergenciaId, ofertas));
  }),
);

export default router;
