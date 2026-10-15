import { Router } from 'express';

import { asyncHandler, badRequest } from '../errors.js';
import {
  requireAuth,
  requireIntegracionOrOwnOng,
  requireRole,
} from '../middleware/auth-middleware.js';
import { validateOngAlta, validateStockItems } from '../ongs/ong-validation.js';
import {
  createOng,
  getStockByRef,
  listOngsHabilitadas,
  upsertStockByRef,
} from '../ongs/ongs-repository.js';

const router = Router();

router.use(requireAuth);

function assertValid(errors) {
  if (Object.keys(errors).length > 0) throw badRequest('Datos inválidos.', errors);
}

// POST /ongs — onboarding: crea la ONG habilitada, su cuenta y su stock inicial.
router.post(
  '/',
  requireRole('integracion'),
  asyncHandler(async (req, res) => {
    assertValid(validateOngAlta(req.body));
    res.status(201).json(await createOng(req.body));
  }),
);

// GET /ongs — ONGs habilitadas (cualquier usuario autenticado).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listOngsHabilitadas());
  }),
);

// PUT /ongs/:ref/recursos — alta/actualización de stock.
router.put(
  '/:ref/recursos',
  requireRole('integracion'),
  asyncHandler(async (req, res) => {
    assertValid(validateStockItems(req.body, 'body'));
    res.json(await upsertStockByRef(req.params.ref, req.body));
  }),
);

// GET /ongs/:ref/recursos — total, comprometido y disponible (integración o la propia ONG).
router.get(
  '/:ref/recursos',
  requireIntegracionOrOwnOng,
  asyncHandler(async (req, res) => {
    res.json(await getStockByRef(req.params.ref));
  }),
);

export default router;
