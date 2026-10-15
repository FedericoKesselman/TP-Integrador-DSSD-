import { Router } from 'express';

import { asyncHandler } from '../errors.js';
import { requireAuth } from '../middleware/auth-middleware.js';
import { getDisponibilidadGlobal } from '../ongs/ongs-repository.js';

const router = Router();

// GET /recursos/disponibilidad — disponibilidad global por recursoCodigo.
router.get(
  '/disponibilidad',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getDisponibilidadGlobal());
  }),
);

export default router;
