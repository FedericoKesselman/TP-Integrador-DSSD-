import { Router } from 'express';

import { createDomainError, sendError } from '../errors.js';
import { requireRole, requireSession } from '../middleware/auth-middleware.js';
import { snRequest, translateSnError } from '../sistema-nacional/sn-client.js';
import { validateInventarioPayload } from '../validate-inventario.js';

const router = Router();

router.use(requireSession);
router.use(requireRole('representante_ong'));

// La ONG sale SIEMPRE de la sesión (su grupo en Bonita = `ref` en el SN), nunca
// de un parámetro del pedido.
function ongRefFromSession(req) {
  const { ongRef } = req.session;
  if (!ongRef) throw createDomainError('La sesión no está asociada a una ONG.', 409);
  return encodeURIComponent(ongRef);
}

// GET /api/inventario — stock de la ONG: total, comprometido y disponible por recurso.
router.get('/', async (req, res) => {
  try {
    const recursos = await snRequest(`/ongs/${ongRefFromSession(req)}/recursos`);
    return res.json(recursos);
  } catch (error) {
    return sendError(res, translateSnError(error), 'No se pudo obtener el inventario.');
  }
});

// PUT /api/inventario — alta / actualización de totales; devuelve el stock completo.
router.put('/', async (req, res) => {
  const errors = validateInventarioPayload(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Datos de inventario inválidos.', errors });
  }

  try {
    const recursos = await snRequest(`/ongs/${ongRefFromSession(req)}/recursos`, {
      method: 'PUT',
      body: req.body.recursos.map(({ recursoCodigo, cantidadTotal }) => ({
        recursoCodigo: recursoCodigo.trim(),
        cantidadTotal,
      })),
    });
    return res.json(recursos);
  } catch (error) {
    return sendError(res, translateSnError(error), 'No se pudo actualizar el inventario.');
  }
});

export default router;
