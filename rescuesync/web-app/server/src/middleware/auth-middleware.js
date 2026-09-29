export function requireSession(req, res, next) {
  if (!req.session?.username) {
    return res.status(401).json({ message: 'Debés iniciar sesión.' });
  }

  return next();
}

export function requireRole(expectedRole) {
  return (req, res, next) => {
    if (req.session.role !== expectedRole) {
      return res.status(403).json({ message: 'No tenés permisos para realizar esta acción.' });
    }

    return next();
  };
}
