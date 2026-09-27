import { Router } from 'express';

import { insertEmergency, listEmergencies } from '../emergencies/emergencies-repository.js';
import { validateEmergencyPayload } from '../validate-emergency.js';

const router = Router();

// POST /api/emergencies — alta de una emergencia por parte del Operador
// Municipal. Corresponde a la tarea BPM "Registrar Emergencia" (ver
// docs/api-contracts.md). El cliente ya valida antes de enviar, pero acá se
// vuelve a validar server-side con la misma regla compartida.
router.post('/', async (req, res) => {
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

// GET /api/emergencies — listado completo, para que el Centro Coordinador
// Regional las vea (lo empieza a usar la pantalla de la Fase 3).
router.get('/', async (req, res) => {
  try {
    const emergencies = await listEmergencies();
    return res.json(emergencies);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron obtener las emergencias.' });
  }
});

export default router;
