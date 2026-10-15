import { Router } from 'express';

import pool from '../db.js';

const router = Router();

// GET /health — público. Render lo usa como healthcheck; también sirve para
// "despertar" el servicio antes de que Bonita lo llame (arranque en frío).
router.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch (error) {
    console.error('Healthcheck: la base no responde', error);
    res.status(503).json({ message: 'La base de datos no responde.' });
  }
});

export default router;
