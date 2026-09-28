import { Router } from 'express';

import { login, logout } from '../bonita/bonita-client.js';

const router = Router();

export function resolveUserRole(username) {
  if (!username) return null;
  const normalized = String(username).trim().toLowerCase();
  if (
    normalized.startsWith('operador') ||
    normalized.includes('municip') ||
    normalized.includes('la-plata')
  ) {
    return 'operador_municipal';
  }
  if (
    normalized.startsWith('coordinador') ||
    normalized.includes('centro') ||
    normalized.includes('regional')
  ) {
    return 'coordinador_regional';
  }
  if (
    normalized.includes('ong') ||
    normalized.includes('rescatistas') ||
    normalized.includes('solidarias')
  ) {
    return 'representante_ong';
  }
  if (
    normalized.includes('direccion') ||
    normalized.includes('dirección') ||
    normalized.includes('auditor')
  ) {
    return 'auditor';
  }
  return 'coordinador_regional';
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son obligatorios.' });
  }

  try {
    const bonitaSession = await login(username, password);
    if (!bonitaSession) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    const role = resolveUserRole(username);
    // Guardamos la sesión de Bonita del lado del server
    req.session.bonita = bonitaSession; // se guarda en la memoria del server
    req.session.username = username;
    req.session.role = role;
    return res.json({ username, role });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: 'No se pudo conectar con Bonita.' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ message: 'No hay sesión iniciada.' });
  }
  const role = req.session.role || resolveUserRole(req.session.username);
  return res.json({ username: req.session.username, role });
});

router.post('/logout', async (req, res) => {
  if (req.session.bonita) {
    await logout(req.session.bonita).catch((error) => console.error(error));
  }

  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

export default router;
