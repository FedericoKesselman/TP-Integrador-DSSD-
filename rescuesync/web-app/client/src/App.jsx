/* Event handlers are intentionally passed to the login and layout components. */
/* eslint-disable react/jsx-no-bind */
import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout.jsx';
import RequireRole from './components/layout/RequireRole.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EmergenciesListPage from './pages/EmergenciesListPage.jsx';
import EmergencyAdjudicacionPage from './pages/EmergencyAdjudicacionPage.jsx';
import EmergencyFormPage from './pages/EmergencyFormPage.jsx';
import EmergencyLotesPage from './pages/EmergencyLotesPage.jsx';
import EmergencyOfertaPage from './pages/EmergencyOfertaPage.jsx';
import EmergencyOfertasPage from './pages/EmergencyOfertasPage.jsx';
import InventarioPage from './pages/InventarioPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MisOfertasPage from './pages/MisOfertasPage.jsx';
import { getCurrentUser, logout } from './services/auth-service.js';

import {
  isAuditor,
  isMunicipalOperator,
  isOngRepresentative,
  isRegionalCoordinator,
} from './lib/auth-roles.js';

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
    navigate('/emergencias', { replace: true });
  }

  async function handleLogout() {
    await logout().catch(() => {});
    setUser(null);
    navigate('/login', { replace: true });
  }

  if (checkingSession) {
    return <p className="p-6 text-ink-muted">Cargando…</p>;
  }

  const canRegisterEmergency = isMunicipalOperator(user);
  const canManageLotes = isRegionalCoordinator(user);
  const canManageOffers = isOngRepresentative(user);
  const canSeeDashboard = isAuditor(user);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? <Navigate to="/emergencias" replace /> : <LoginPage onLogin={handleLogin} />
        }
      />
      <Route
        element={
          user ? (
            <AppLayout user={user} userName={user.username} onLogout={handleLogout}>
              <Outlet context={{ user }} />
            </AppLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<Navigate to="/emergencias" replace />} />
        <Route path="/emergencias" element={<EmergenciesListPage />} />

        {/* Municipio */}
        <Route element={<RequireRole allowed={canRegisterEmergency} />}>
          <Route path="/emergencias/nueva" element={<EmergencyFormPage />} />
          <Route path="/emergencias/:id/adjudicacion" element={<EmergencyAdjudicacionPage />} />
        </Route>

        {/* Centro coordinador */}
        <Route element={<RequireRole allowed={canManageLotes} />}>
          <Route path="/emergencias/:id/lotes" element={<EmergencyLotesPage />} />
          <Route path="/emergencias/:id/ofertas" element={<EmergencyOfertasPage />} />
        </Route>

        {/* ONG */}
        <Route element={<RequireRole allowed={canManageOffers} />}>
          <Route path="/emergencias/:id/oferta" element={<EmergencyOfertaPage />} />
          <Route path="/mis-ofertas" element={<MisOfertasPage />} />
          <Route path="/inventario" element={<InventarioPage />} />
        </Route>

        {/* Dirección / Auditor */}
        <Route element={<RequireRole allowed={canSeeDashboard} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
