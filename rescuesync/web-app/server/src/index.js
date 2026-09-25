import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import session from 'express-session';

import pool from './db.js';
import authRoutes from './routes/auth-routes.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));

app.use('/api/auth', authRoutes); // "Toda petición que empiece con /api/auth, mandala a este router".

app.listen(port, () => {
  console.log(`RescueSync server listening on port ${port}`);
});

pool
  .query('SELECT 1')
  .then(() => console.log('Postgres connection established'))
  .catch((error) => console.error('Postgres connection failed', error));
