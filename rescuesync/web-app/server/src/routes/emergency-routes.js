import { Router } from 'express';

import { completePendingTasks, startCase } from '../bonita/bonita-client.js';
import {
  getEmergencyById,
  insertEmergency,
  listEmergencies,
  setBonitaCaseId,
} from '../emergencies/emergencies-repository.js';
import {
  listLotesForEmergency,
  publishConvocatoriaForEmergency,
  revertConvocatoria,
  saveLotesForEmergency,
} from '../lotes/lotes-repository.js';
import { requireRole, requireSession } from '../middleware/auth-middleware.js';
import {
  createOfertaForEmergency,
  listOwnOfertasForEmergency,
} from '../ofertas/ofertas-repository.js';
import { validateEmergencyPayload } from '../validate-emergency.js';
import { validateLotesPayload } from '../validate-lote.js';
import { validateOfertaPayload } from '../validate-oferta.js';

const router = Router();

// Tareas del Centro Coordinador que se tildan en Bonita al publicar la
// convocatoria, en este orden. Se completa lo que esté pendiente: en la primera
// vuelta las tres, y si Bonita vuelve a una tarea anterior, solo las últimas.
const COORDINATOR_TASKS = [
  'Revisar Emergencia',
  'Generar Lotes de Necesidades',
  'Publicar Convocatoria',
];

// Todos los endpoints de emergencias requieren una sesión iniciada mediante Bonita.
router.use(requireSession);

// POST /api/emergencies — alta de una emergencia por parte del Operador
// Municipal. Corresponde a la tarea BPM "Registrar Emergencia" (ver
// docs/api-contracts.md). El cliente ya valida antes de enviar, pero acá se
// vuelve a validar server-side con la misma regla compartida.
// Después de guardar, inicia el caso en Bonita con la sesión del usuario. Si
// Bonita falla la emergencia queda guardada igual (bonitaCaseId null) y la
// respuesta trae `bonitaWarning` para poder reintentar.
router.post('/', requireRole('operador_municipal'), async (req, res) => {
  const errors = validateEmergencyPayload(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Datos inválidos', errors });
  }

  try {
    const emergency = await insertEmergency(req.body);
    try {
      const caseId = await startCase(req.session.bonita, {
        emergencyID: emergency.id,
      });
      const saved = await setBonitaCaseId(emergency.id, caseId);

      // El alta ya es la tarea "Registrar Emergencia": se tilda para que el
      // caso llegue a "Revisar Emergencia". Si falla, el alta no se pierde.
      try {
        const { completed } = await completePendingTasks(
          req.session.bonita,
          caseId,
          ['Registrar Emergencia'],
          { waitForFirst: true },
        );
        if (completed.length === 0) throw new Error('la tarea no estaba pendiente');
      } catch (taskError) {
        console.error(
          `Caso ${caseId} creado, pero no se completó Registrar Emergencia:`,
          taskError,
        );
        return res.status(201).json({
          ...saved,
          bonitaWarning: 'El caso se creó pero no se pudo completar Registrar Emergencia.',
        });
      }
      return res.status(201).json(saved);
    } catch (error) {
      console.error(`Emergencia ${emergency.id} guardada, pero no se inició el caso:`, error);
      return res.status(201).json({
        ...emergency,
        bonitaWarning: 'La emergencia se guardó, pero no se pudo iniciar el caso en Bonita.',
      });
    }
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
router.post('/:emergencyId/lotes', requireRole('coordinador_regional'), async (req, res) => {
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
// Publicar en la web y completar "Publicar Convocatoria" en Bonita (que arranca
// el reloj de la convocatoria) van juntos: si Bonita no avanza, se revierte.
router.post('/:emergencyId/convocatoria', requireRole('coordinador_regional'), async (req, res) => {
  const { emergencyId } = req.params;
  try {
    const result = await publishConvocatoriaForEmergency(emergencyId);

    try {
      const emergency = await getEmergencyById(emergencyId);
      if (!emergency.bonitaCaseId) throw new Error('La emergencia no tiene caso en Bonita.');
      const { completed } = await completePendingTasks(
        req.session.bonita,
        emergency.bonitaCaseId,
        COORDINATOR_TASKS,
      );
      if (!completed.includes('Publicar Convocatoria')) {
        throw new Error(
          '"Publicar Convocatoria" no estaba pendiente ni se pudo completar en Bonita.',
        );
      }
    } catch (bonitaError) {
      console.error(
        `Convocatoria de ${emergencyId} revertida:`,
        bonitaError,
        bonitaError.completed,
      );
      await revertConvocatoria(emergencyId);
      return res.status(502).json({
        message:
          'No se pudo iniciar la convocatoria en Bonita; la emergencia sigue en estado registrada, reintentá.',
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'No se pudo publicar la convocatoria.' });
  }
});

// POST /api/emergencies/:emergencyId/ofertas — alta por parte de la ONG logueada
router.post('/:emergencyId/ofertas', requireRole('representante_ong'), async (req, res) => {
  const errors = validateOfertaPayload(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Datos de la oferta inválidos.', errors });
  }

  try {
    const oferta = await createOfertaForEmergency(
      req.params.emergencyId,
      req.session.ongRef,
      req.body,
    );
    return res.status(201).json(oferta);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'No se pudo registrar la oferta.' });
  }
});

// GET /api/emergencies/:emergencyId/ofertas/mine — ofertas de la ONG logueada
router.get('/:emergencyId/ofertas/mine', requireRole('representante_ong'), async (req, res) => {
  try {
    const ofertas = await listOwnOfertasForEmergency(
      req.params.emergencyId,
      req.session.ongRef,
    );
    return res.json(ofertas);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'No se pudieron obtener las ofertas.' });
  }
});

export default router;
