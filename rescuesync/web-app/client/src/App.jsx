import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout.jsx';
import EmergencyFormPage from './pages/EmergencyFormPage.jsx';

// Esqueleto de rutas (Fase 0, tarea 3 del roadmap). Todavía sin protección
// por rol propia: el rol lo resuelve la organización de Bonita, no esta
// app (ver roadmapfase2.md). Layout compartido vía <Outlet />; cada fase
// del roadmap suma rutas acá adentro (login, lotes, ofertas...).
function App() {
  return (
    <Routes>
      <Route
        element={
          <AppLayout roleLabel="Operador municipal">
            <Outlet />
          </AppLayout>
        }
      >
        <Route path="/" element={<Navigate to="/emergencias/nueva" replace />} />
        <Route path="/emergencias/nueva" element={<EmergencyFormPage />} />
      </Route>
    </Routes>
  );
}

export default App;
