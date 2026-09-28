import { Router } from 'express';

import {
  getEmergencyById,
  insertEmergency,
  listEmergencies,
} from '../emergencies/emergencies-repository.js';
import {
  listLotesForEmergency,
  publishConvocatoriaForEmergency,
  saveLotesForEmergency,
} from '../lotes/lotes-repository.js';
import { validateEmergencyPayload } from '../validate-emergency.js';
import { validateLotesPayload } from '../validate-lote.js';
import { resolveUserRole } from './auth-routes.js';

const router = Router();

// POST /api/emergencies — alta de una emergencia por parte del Operador
// Municipal. Corresponde a la tarea BPM "Registrar Emergencia" (ver docs/api-contracts.md).
router.post('/', async (req, res) => {
  if (req.session?.username) {
    const role = req.session.role || resolveUserRole(req.session.username);
    if (role !== 'operador_municipal') {
      return res.status(403).json({
        message: 'Acceso denegado: solo los usuarios del Municipio pueden registrar emergencias.',
      });
    }
  }

  const errors = validateEmergencyPayload(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Datos inválidos', errors });
  }

  try {
    const emergency = await insertEmergency(req.body);
    return res.status(201).json(emergency);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo registrar la emergencia.' });
  }
});

// GET /api/emergencies — listado completo, para que el Centro Coordinador Regional las vea.
router.get('/', async (req, res) => {
  try {
    const emergencies = await listEmergencies();
    return res.json(emergencies);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron obtener las emergencias.' });
  }
});

// GET /api/emergencies/:id — detalle individual de una emergencia
router.get('/:id', async (req, res) => {
  try {
    const emergency = await getEmergencyById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ message: 'Emergencia no encontrada.' });
    }
    return res.json(emergency);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo obtener la emergencia.' });
  }
});

// POST /api/emergencies/:emergencyId/lotes — desglose de lotes de recursos
router.post('/:emergencyId/lotes', async (req, res) => {
  const errors = validateLotesPayload(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Datos de lotes inválidos.', errors });
  }

  try {
    const result = await saveLotesForEmergency(req.params.emergencyId, req.body.lotes);
    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'No se pudieron guardar los lotes.' });
  }
});

// GET /api/emergencies/:emergencyId/lotes — lista de lotes de una emergencia
router.get('/:emergencyId/lotes', async (req, res) => {
  try {
    const lotes = await listLotesForEmergency(req.params.emergencyId);
    return res.json(lotes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron obtener los lotes.' });
  }
});

// POST /api/emergencies/:emergencyId/convocatoria — publica la convocatoria (pasa a convocatoria_abierta)
router.post('/:emergencyId/convocatoria', async (req, res) => {
  try {
    const result = await publishConvocatoriaForEmergency(req.params.emergencyId);
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'No se pudo publicar la convocatoria.' });
  }
});

export default router;

