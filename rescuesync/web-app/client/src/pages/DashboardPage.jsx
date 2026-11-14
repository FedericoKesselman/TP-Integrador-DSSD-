import { BarChart3, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import Alert from '../components/ui/Alert.jsx';
import { getResourceInfo } from '../features/dashboard/dashboard-format.js';
import DashboardFilters from '../features/dashboard/DashboardFilters.jsx';
import EstadoProyectosChart from '../features/dashboard/EstadoProyectosChart.jsx';
import ExportMenu from '../features/dashboard/ExportMenu.jsx';
import KpiTiles from '../features/dashboard/KpiTiles.jsx';
import SuministrosChart from '../features/dashboard/SuministrosChart.jsx';
import TiemposEtapasChart from '../features/dashboard/TiemposEtapasChart.jsx';
import { getIndicadores, getTiemposEtapas } from '../services/dashboard-service.js';

function tiemposErrorMessage(err) {
  if (err.status === 401) return 'Tu sesión de Bonita venció. Volvé a iniciar sesión.';
  return err.message || 'No se pudieron consultar los tiempos en Bonita.';
}

function DashboardPage() {
  const [periodo, setPeriodo] = useState({ desde: '', hasta: '' });
  const [recurso, setRecurso] = useState('');
  const [indicadores, setIndicadores] = useState({ loading: true, data: null, error: null });
  const [tiempos, setTiempos] = useState({ loading: true, data: null, error: null });

  const periodoInvalido = Boolean(periodo.desde && periodo.hasta && periodo.desde > periodo.hasta);

  // El título del index.html es el del formulario; en esta pantalla se reemplaza.
  useEffect(() => {
    const anterior = document.title;
    document.title = 'Dashboard | RescueSync';
    return () => {
      document.title = anterior;
    };
  }, []);

  // Cada cambio de período vuelve a pedir ambos endpoints (en paralelo, sin pisarse).
  useEffect(() => {
    if (periodoInvalido) return undefined;
    let cancelled = false;
    setIndicadores((current) => ({ ...current, loading: true, error: null }));
    setTiempos((current) => ({ ...current, loading: true, error: null }));

    getIndicadores(periodo)
      .then((data) => !cancelled && setIndicadores({ loading: false, data, error: null }))
      .catch(
        (err) =>
          !cancelled &&
          setIndicadores({
            loading: false,
            data: null,
            error: err.message || 'No se pudieron cargar los indicadores.',
          }),
      );
    getTiemposEtapas(periodo)
      .then((data) => !cancelled && setTiempos({ loading: false, data, error: null }))
      .catch(
        (err) =>
          !cancelled && setTiempos({ loading: false, data: null, error: tiemposErrorMessage(err) }),
      );

    return () => {
      cancelled = true;
    };
  }, [periodo, periodoInvalido]);

  const suministros = indicadores.data?.suministrosMovilizados;
  const recursoOptions = useMemo(
    () =>
      [...new Set((suministros ?? []).map((item) => item.recursoCodigo))]
        .map((code) => ({ code, label: getResourceInfo(code).label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [suministros],
  );
  const recursoActivo = recursoOptions.some((option) => option.code === recurso) ? recurso : '';
  const suministrosFiltrados = useMemo(
    () =>
      recursoActivo
        ? (suministros ?? []).filter((item) => item.recursoCodigo === recursoActivo)
        : (suministros ?? []),
    [suministros, recursoActivo],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Indicadores de las operaciones de rescate: suministros, estado de los proyectos y
            tiempos de cada etapa.
          </p>
        </div>
        <ExportMenu periodo={periodo} disabled={periodoInvalido} />
      </div>

      <DashboardFilters
        periodo={periodo}
        onPeriodoChange={setPeriodo}
        recurso={recursoActivo}
        onRecursoChange={setRecurso}
        recursoOptions={recursoOptions}
      />

      {indicadores.loading && !indicadores.data && !periodoInvalido && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white/70 p-12 text-sm font-semibold text-ink-soft"
        >
          <LoaderCircle className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
          Cargando indicadores…
        </div>
      )}

      {indicadores.error && (
        <Alert tone="error" title="No se pudieron cargar los indicadores">
          {indicadores.error}
        </Alert>
      )}

      {indicadores.data && (
        <div
          className={indicadores.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}
        >
          <KpiTiles indicadores={indicadores.data} tiempos={tiempos.data} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SuministrosChart suministros={suministrosFiltrados} todos={suministros ?? []} />
            <EstadoProyectosChart estadoProyectos={indicadores.data.estadoProyectos} />
          </div>

          <div className="mt-6">
            {tiempos.loading && !tiempos.data && (
              <div
                role="status"
                className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white/70 p-10 text-sm font-semibold text-ink-soft"
              >
                <LoaderCircle className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
                Consultando tiempos en Bonita…
              </div>
            )}
            {tiempos.error && (
              <Alert tone="error" title="No se pudieron cargar los tiempos por etapa">
                {tiempos.error}
              </Alert>
            )}
            {tiempos.data && <TiemposEtapasChart tiempos={tiempos.data} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
