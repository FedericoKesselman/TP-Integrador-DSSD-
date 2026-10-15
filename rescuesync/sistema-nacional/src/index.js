import app from './app.js';
import config from './config.js';
import pool from './db.js';

app.listen(config.port, () => {
  console.log(`Sistema Nacional escuchando en el puerto ${config.port}`);
});

pool
  .query('SELECT 1')
  .then(() => console.log('Conexión a Postgres establecida'))
  .catch((error) => console.error('No se pudo conectar a Postgres', error));
