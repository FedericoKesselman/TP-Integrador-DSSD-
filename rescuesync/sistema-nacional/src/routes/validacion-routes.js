import { Router } from 'express';

import { asyncHandler, badRequest } from '../errors.js';
import { requireAuth, requireRole } from '../middleware/auth-middleware.js';
import { validateValidacionRequest } from '../validaciones/validacion-input.js';
import { validarOfertas } from '../validaciones/validar-ofertas.js';

const router = Router();

// POST /validaciones — lo llama Bonita al cerrar la convocatoria, con el
// "consolidado" de la web-app. Evalúa cada oferta y devuelve su perfil.
router.post(
  '/',
  requireAuth, // 1) ¿trae un JWT válido? si no → 401
  requireRole('integracion'), // 2) ¿el token es de la cuenta de integración? si no → 403
  asyncHandler(async (req, res) => {
    // 3) Forma del body. Si algo está mal → 400 con el detalle por campo.
    const errors = validateValidacionRequest(req.body);
    if (Object.keys(errors).length > 0) {
      throw badRequest('Datos inválidos.', errors);
    }
    // 4) Evaluar (lee con lock, no reserva) y responder.
    res.json(await validarOfertas(req.body));
  }),
);

export default router;
