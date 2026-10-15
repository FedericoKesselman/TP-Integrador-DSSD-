import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import config from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import authRoutes from './routes/auth-routes.js';
import docsRoutes from './routes/docs-routes.js';
import emergenciaRoutes from './routes/emergencia-routes.js';
import healthRoutes from './routes/health-routes.js';
import ongRoutes from './routes/ong-routes.js';
import recursosRoutes from './routes/recursos-routes.js';

// La app se arma separada de `listen` (index.js) para poder levantarla en
// los tests sin abrir un puerto fijo.
const app = express();

// Render termina el TLS en su proxy y nos pasa X-Forwarded-Proto: sin esto
// Express no sabría si el pedido original fue HTTPS ni la IP real (que usa
// el rate limit del login).
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Solo HTTPS en producción (en local se usa http://localhost). /health queda
// afuera: el chequeo de salud de Render puede llegar por HTTP plano adentro
// de su red y, si se rechazara, marcaría el servicio como caído.
if (config.isProduction) {
  app.use((req, res, next) => {
    if (req.secure || req.path === '/health') return next();
    return res.status(403).json({ message: 'El Sistema Nacional solo acepta HTTPS.' });
  });
}

app.use(helmet());
app.use(cors({ origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins }));
app.use(express.json({ limit: '100kb' }));

// Públicas: /auth/login, /health, /docs.
app.use('/auth', authRoutes);
app.use('/health', healthRoutes);
app.use(docsRoutes);

// Dominio (todas con requireAuth adentro del router).
app.use('/ongs', ongRoutes);
app.use('/recursos', recursosRoutes);
app.use('/emergencias', emergenciaRoutes);
// Pista B: /validaciones y /compromisos se montan acá.

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
