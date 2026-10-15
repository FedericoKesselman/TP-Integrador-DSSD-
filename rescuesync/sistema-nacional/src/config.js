import 'dotenv/config';

// Toda la configuración sale de variables de entorno (.env en local,
// variables del servicio en Render). Se valida al arrancar: si falta algo
// crítico el proceso se corta acá y no a mitad de un request.

const MIN_SECRET_LENGTH = 32;

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (ver .env.example).`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < MIN_SECRET_LENGTH) {
  throw new Error(`JWT_SECRET tiene que tener al menos ${MIN_SECRET_LENGTH} caracteres.`);
}

const config = {
  isProduction,
  port: Number(process.env.PORT) || 5000,
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    secret: jwtSecret,
    expiresIn: Number(process.env.JWT_EXPIRES_IN) || 3600,
    issuer: process.env.JWT_ISSUER || 'rescuesync-sistema-nacional',
    audience: process.env.JWT_AUDIENCE || 'rescuesync',
  },
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((origin) => origin.trim()),
};

export default config;
