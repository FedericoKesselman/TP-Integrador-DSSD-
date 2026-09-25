import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout.jsx';
import EmergencyFormPage from './pages/EmergencyFormPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { getCurrentUser, logout } from './services/auth-service.js';

// Usuarios y roles viven en la organización de Bonita (ver roadmapfase2.md).
// Al arrancar se consulta /api/auth/me: sin sesión, todas las rutas llevan a /login.
function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  function handleLogin(loggedUser) {
    setUser(loggedUser);
    navigate('/', { replace: true });
  }

  async function handleLogout() {
    await logout().catch(() => {});
    setUser(null);
    navigate('/login', { replace: true });
  }

  if (checkingSession) {
    return <p className="p-6 text-ink-muted">Cargando…</p>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        element={
          user ? (
            <AppLayout userName={user.username} onLogout={handleLogout}>
              <Outlet />
            </AppLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<Navigate to="/emergencias/nueva" replace />} />
        <Route path="/emergencias/nueva" element={<EmergencyFormPage />} />
      </Route>
    </Routes>
  );
}

export default App;
