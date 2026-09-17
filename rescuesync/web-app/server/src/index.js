import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import pool from './db.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.listen(port, () => {
  console.log(`RescueSync server listening on port ${port}`);
});

pool
  .query('SELECT 1')
  .then(() => console.log('Postgres connection established'))
  .catch((error) => console.error('Postgres connection failed', error));
