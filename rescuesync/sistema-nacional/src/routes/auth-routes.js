import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { findActiveClientByUsername } from '../auth/auth-repository.js';
import { signAccessToken } from '../auth/jwt.js';
import config from '../config.js';
import { asyncHandler, badRequest, unauthorized } from '../errors.js';

const router = Router();

// Freno a la fuerza bruta: 10 intentos por IP cada 15 minutos.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de login; esperá unos minutos.' },
});

// Hash fijo para comparar cuando el usuario no existe: así la respuesta
// tarda lo mismo y no revela qué usernames son válidos.
const DUMMY_HASH = bcrypt.hashSync('usuario-inexistente', 10);

// POST /auth/login — { username, password } → { accessToken, tokenType, expiresIn }
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      throw badRequest('Se requieren username y password.');
    }

    const client = await findActiveClientByUsername(username);
    const valid = await bcrypt.compare(password, client?.password_hash ?? DUMMY_HASH);
    if (!client || !valid) {
      throw unauthorized('Usuario o contraseña incorrectos.');
    }

    const accessToken = signAccessToken({
      username: client.username,
      role: client.role,
      ongRef: client.ong_ref,
    });
    res.json({ accessToken, tokenType: 'Bearer', expiresIn: config.jwt.expiresIn });
  }),
);

export default router;
