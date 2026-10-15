import { readFileSync } from 'node:fs';

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

// La spec vive en openapi.yaml (fuente única); /docs.json la sirve como JSON
// para importarla en Postman o exportarla para la entrega.
const spec = YAML.parse(readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8'));

const router = Router();

router.get('/docs.json', (req, res) => res.json(spec));
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(spec, { customSiteTitle: 'Sistema Nacional' }),
);

export default router;
