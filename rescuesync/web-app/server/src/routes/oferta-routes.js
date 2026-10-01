import { Router } from 'express';

import { requireRole, requireSession } from '../middleware/auth-middleware.js';
import { listOngs, listOwnOfertaHistory, updateOwnOferta } from '../ofertas/ofertas-repository.js';
import { validateOfertaPayload } from '../validate-oferta.js';

const router = Router();

router.use(requireSession);
router.use(requireRole('representante_ong'));

// GET /api/ofertas/ongs — ONGs de la red, para armar un consorcio
router.get('/ongs', async (req, res) => {
  try {
    return res.json(await listOngs());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron obtener las ONGs.' });
  }
});

// PUT /api/ofertas/:id — modifica una oferta propia y conserva la versión anterior
router.put('/:id', async (req, res) => {
  const errors = validateOfertaPayload(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Datos de la oferta inválidos.', errors });
  }

  try {
    const oferta = await updateOwnOferta(
      req.params.id,
      req.session.ongRef,
      req.session.username,
      req.body,
    );
    return res.json(oferta);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'No se pudo actualizar la oferta.' });
  }
});

// GET /api/ofertas/:id/historial — versiones anteriores de una oferta propia
router.get('/:id/historial', async (req, res) => {
  try {
    const history = await listOwnOfertaHistory(req.params.id, req.session.ongRef);
    return res.json(history);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'No se pudo obtener el historial.' });
  }
});

export default router;
