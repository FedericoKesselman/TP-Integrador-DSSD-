import { Router } from 'express';

import { login, logout } from '../bonita/bonita-client.js';

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

    // Guardamos la sesión de Bonita del lado del server
    req.session.bonita = bonitaSession; // se guarda en la memoria del server
    req.session.username = username;
    return res.json({ username });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: 'No se pudo conectar con Bonita.' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ message: 'No hay sesión iniciada.' });
  }
  return res.json({ username: req.session.username });
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
