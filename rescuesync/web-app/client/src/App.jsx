import AppLayout from './components/layout/AppLayout.jsx';
import EmergencyFormPage from './pages/EmergencyFormPage.jsx';

function App() {
  return (
    <AppLayout roleLabel="Operador municipal">
      <EmergencyFormPage />
    </AppLayout>
  );
}

export default App;
