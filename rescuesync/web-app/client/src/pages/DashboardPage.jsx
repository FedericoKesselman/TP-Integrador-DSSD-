import { BarChart3 } from 'lucide-react';

import Alert from '../components/ui/Alert.jsx';

// Ruta del Auditor reservada (E5-50). El contenido real (indicadores, gráficos,
// filtros y exportación) se implementa en E5-61 a E5-64 dentro de esta misma
// página; el backend de indicadores todavía no existe.
function DashboardPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
      </div>
      <Alert tone="info" title="En construcción">
        Los indicadores y gráficos de las operaciones de rescate se publican en una próxima entrega.
      </Alert>
    </div>
  );
}

export default DashboardPage;
