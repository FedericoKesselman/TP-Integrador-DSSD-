import { Router } from 'express';

import { leerCasosYTareas } from '../dashboard/bonita-tiempos-source.js';
import { getIndicadores, getTiposPorCaso } from '../dashboard/dashboard-repository.js';
import { DATASETS, datasetCsv } from '../dashboard/export.js';
import { calcularTiemposEtapas, parsePeriodo } from '../dashboard/tiempos-etapas.js';
import { createDomainError, sendError } from '../errors.js';
import { requireRole, requireSession } from '../middleware/auth-middleware.js';

const router = Router();

router.use(requireSession);
router.use(requireRole('auditor'));

// Tiempos por etapa (Bonita con la sesión del propio Auditor, solo GET) cruzados con el tipo
// de cada emergencia (Postgres).
async function getTiempos(session, periodo) {
  if (!session.bonita) {
    throw createDomainError('Tu sesión de Bonita venció. Volvé a iniciar sesión.', 401);
  }
  const { casos, tareas } = await leerCasosYTareas(session.bonita, periodo);
  const tipos = await getTiposPorCaso(casos.map((c) => c.id));
  return calcularTiemposEtapas(casos, tareas, periodo, tipos);
}

// GET /api/dashboard/indicadores — datos propios (Postgres), sin Bonita.
router.get('/indicadores', async (req, res) => {
  try {
    return res.json(await getIndicadores(parsePeriodo(req.query)));
  } catch (error) {
    return sendError(res, error, 'No se pudieron calcular los indicadores.');
  }
});

// GET /api/dashboard/tiempos-etapas — datos de Bonita con la sesión del propio Auditor (solo GET).
router.get('/tiempos-etapas', async (req, res) => {
  try {
    return res.json(await getTiempos(req.session, parsePeriodo(req.query)));
  } catch (error) {
    return sendError(res, error, 'No se pudieron calcular los tiempos por etapa.');
  }
});

// Fecha de hoy en Argentina (YYYY-MM-DD) para el nombre del archivo.
const hoy = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

// GET /api/dashboard/export?formato=json|csv[&dataset=...][&desde&hasta]
router.get('/export', async (req, res) => {
  try {
    const { formato, dataset } = req.query;
    const periodo = parsePeriodo(req.query);
    if (formato !== 'json' && formato !== 'csv') {
      throw createDomainError('"formato" debe ser json o csv.', 400);
    }
    if (formato === 'csv' && !DATASETS.includes(dataset)) {
      throw createDomainError(`"dataset" debe ser uno de: ${DATASETS.join(', ')}.`, 400);
    }
    const adjunto = (ext, parte) =>
      `attachment; filename="rescuesync-dashboard-${parte}-${hoy()}.${ext}"`;

    if (formato === 'json') {
      const avisos = [];
      const indicadores = await getIndicadores(periodo);
      // Si Bonita falla, el export sale igual sin tiempos y con un aviso.
      const tiemposEtapas = await getTiempos(req.session, periodo).catch((error) => {
        avisos.push(
          error.status ? error.message : 'No se pudieron calcular los tiempos por etapa.',
        );
        return null;
      });
      res.set('Content-Disposition', adjunto('json', 'completo'));
      return res.json({
        generadoAt: new Date().toISOString(),
        periodo,
        indicadores,
        tiemposEtapas,
        avisos,
      });
    }

    const conTiempos = dataset.startsWith('tiempos');
    const indicadores = conTiempos ? null : await getIndicadores(periodo);
    const tiempos = conTiempos ? await getTiempos(req.session, periodo) : null;
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', adjunto('csv', dataset));
    return res.send(datasetCsv(dataset, indicadores, tiempos));
  } catch (error) {
    return sendError(res, error, 'No se pudo generar el export.');
  }
});

export default router;
