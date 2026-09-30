import { Router } from 'express';

import { getUserProfile, login, logout } from '../bonita/bonita-client.js';

const router = Router();

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

    // El rol sale de la organización de Bonita (membresías del usuario).
    const profile = await getUserProfile(bonitaSession);
    if (!profile.role) {
      await logout(bonitaSession).catch((error) => console.error(error));
      return res
        .status(403)
        .json({ message: 'Tu usuario no tiene un rol habilitado en RescueSync.' });
    }

    // Guardamos la sesión de Bonita y el perfil del lado del server
    req.session.bonita = bonitaSession;
    req.session.username = username;
    req.session.userId = profile.userId;
    req.session.role = profile.role;
    req.session.groupPath = profile.groupPath;
    return res.json({ username, role: profile.role, groupPath: profile.groupPath });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: 'No se pudo conectar con Bonita.' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ message: 'No hay sesión iniciada.' });
  }
  const { username, role, groupPath } = req.session;
  return res.json({ username, role, groupPath });
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
