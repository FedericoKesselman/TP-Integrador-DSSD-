import { Router } from 'express';

import {
  confirmarCompromiso,
  getAdjudicacionBody,
  registrarCompromisoFallido,
  validateCompromisosPayload,
} from '../adjudicaciones/adjudicaciones-repository.js';
import { withTransaction } from '../db.js';
import { changeEmergencyStatus, lockEmergency } from '../emergencies/state-machine.js';
import { createDomainError, isUuid, sendError } from '../errors.js';
import { requireIntegrationKey } from '../middleware/auth-middleware.js';
import { createNotificationsFromBonita } from '../notifications/notifications-repository.js';
import { listFinalizedOngRefs } from '../ofertas/ofertas-repository.js';
import { getConsolidado, saveValidaciones } from '../validaciones/validaciones-repository.js';
import { validateValidacionesPayload } from '../validaciones/validate-validacion.js';
import { BONITA_NOTIFICATION_TYPES, BONITA_PATCHABLE_STATES } from '../workflow.js';

// Rutas que usa Bonita (conectores REST). Sin sesión de usuario: se autentican
// con el header `X-Integration-Key`. Ver docs/api-contracts.md, "Rutas internas".
const router = Router();

router.use(requireIntegrationKey);

router.param('id', (req, res, next, id) => {
  if (!isUuid(id))
    return res.status(400).json({ message: 'El id de la emergencia debe ser un UUID.' });
  return next();
});

// GET /api/internal/emergencies/:id/consolidado — body de POST /validaciones del SN
router.get('/emergencies/:id/consolidado', async (req, res) => {
  try {
    return res.json(await getConsolidado(req.params.id));
  } catch (error) {
    return sendError(res, error, 'No se pudo armar el consolidado.');
  }
});

// PATCH /api/internal/emergencies/:id/estado — {estado}; valida la whitelist.
// Es idempotente: si la emergencia ya está en ese estado responde 200 (Bonita
// puede reintentar la tarea de servicio).
router.patch('/emergencies/:id/estado', async (req, res) => {
  const { estado } = req.body ?? {};
  if (!BONITA_PATCHABLE_STATES.includes(estado)) {
    return res.status(400).json({
      message: `estado debe ser uno de: ${BONITA_PATCHABLE_STATES.join(', ')}.`,
    });
  }

  try {
    const result = await withTransaction(async (client) => {
      const emergency = await lockEmergency(client, req.params.id);
      if (emergency.status === estado) {
        return { emergenciaId: emergency.id, status: estado, alreadyApplied: true };
      }
      await changeEmergencyStatus(client, emergency, estado, 'bonita');
      return { emergenciaId: emergency.id, status: estado };
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 'No se pudo cambiar el estado de la emergencia.');
  }
});

// POST /api/internal/emergencies/:id/validaciones — guarda la respuesta del SN
router.post('/emergencies/:id/validaciones', async (req, res) => {
  const errors = validateValidacionesPayload(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Resultados de validación inválidos.', errors });
  }

  try {
    return res.json(await saveValidaciones(req.params.id, req.body));
  } catch (error) {
    return sendError(res, error, 'No se pudieron guardar las validaciones.');
  }
});

// GET /api/internal/emergencies/:id/adjudicacion — body de POST /compromisos del SN
router.get('/emergencies/:id/adjudicacion', async (req, res) => {
  try {
    return res.json(await getAdjudicacionBody(req.params.id));
  } catch (error) {
    return sendError(res, error, 'No se pudo armar la adjudicación.');
  }
});

// POST /api/internal/emergencies/:id/compromiso-confirmado — {compromisos} del SN
router.post('/emergencies/:id/compromiso-confirmado', async (req, res) => {
  const errors = validateCompromisosPayload(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Compromisos inválidos.', errors });
  }

  try {
    return res.json(await confirmarCompromiso(req.params.id, req.body.compromisos));
  } catch (error) {
    return sendError(res, error, 'No se pudo confirmar el compromiso.');
  }
});

// POST /api/internal/emergencies/:id/compromiso-fallido — {detalle} del 409 del SN
router.post('/emergencies/:id/compromiso-fallido', async (req, res) => {
  const { detalle } = req.body ?? {};
  if (detalle === undefined || detalle === null) {
    return res.status(400).json({ message: 'Falta el detalle del rechazo.' });
  }

  try {
    return res.json(await registrarCompromisoFallido(req.params.id, detalle));
  } catch (error) {
    return sendError(res, error, 'No se pudo registrar el compromiso fallido.');
  }
});

// GET /api/internal/emergencies/:id/finalizacion — {ongRefs} de las ONGs que terminaron
router.get('/emergencies/:id/finalizacion', async (req, res) => {
  try {
    return res.json({ ongRefs: await listFinalizedOngRefs(req.params.id) });
  } catch (error) {
    return sendError(res, error, 'No se pudo obtener la finalización.');
  }
});

// POST /api/internal/emergencies/:id/notificaciones — {tipo}; la web-app decide los destinatarios
router.post('/emergencies/:id/notificaciones', async (req, res) => {
  const { tipo } = req.body ?? {};
  if (!BONITA_NOTIFICATION_TYPES.includes(tipo)) {
    return sendError(
      res,
      createDomainError(`tipo debe ser uno de: ${BONITA_NOTIFICATION_TYPES.join(', ')}.`, 400),
    );
  }

  try {
    return res.json(await createNotificationsFromBonita(req.params.id, tipo));
  } catch (error) {
    return sendError(res, error, 'No se pudieron crear los avisos.');
  }
});

export default router;
