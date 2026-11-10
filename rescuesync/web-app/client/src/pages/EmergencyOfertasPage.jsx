/* Los handlers dependen del estado de la pantalla, así que se pasan como funciones. */
/* eslint-disable react/jsx-no-bind */
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import EmergencyStatusStepper from '../features/emergencies/components/EmergencyStatusStepper.jsx';
import StatusBadge from '../features/emergencies/components/StatusBadge.jsx';
import CoberturaLotes from '../features/ofertas/components/CoberturaLotes.jsx';
import DecisionPanel from '../features/ofertas/components/DecisionPanel.jsx';
import EjecucionPanel from '../features/ofertas/components/EjecucionPanel.jsx';
import OfertaCard from '../features/ofertas/components/OfertaCard.jsx';
import { getEmergencyDetail, getOfertasConValidacion } from '../services/ciclo-service.js';

// Mensajes de contexto cuando no hay una acción para el coordinador.
const STATUS_INFO = {
  registrada: 'La emergencia no tiene una convocatoria abierta. Armá los lotes y publicala.',
  convocatoria_abierta:
    'La convocatoria sigue abierta: las ONGs todavía pueden cargar o cambiar sus ofertas.',
  convocatoria_cerrada:
    'La convocatoria cerró y las ofertas se están validando con el Sistema Nacional. Actualizá en unos instantes.',
  adjudicada: 'Las ofertas fueron adjudicadas; la ejecución está por comenzar.',
  finalizada: 'El ciclo de esta emergencia terminó.',
};

// Vista del coordinador: ofertas con su perfil y la cobertura por lote, decisión
// cuando las ofertas están validadas y cierre de la ejecución (E5-52 y E5-57).
function EmergencyOfertasPage() {
  const { id } = useParams();
  const [emergency, setEmergency] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [detail, ofertas] = await Promise.all([
        getEmergencyDetail(id),
        getOfertasConValidacion(id),
      ]);
      setEmergency(detail);
      setData(ofertas);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function handleDone(text) {
    setMessage(text);
    load();
  }

  const status = data?.status;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/emergencias"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a la bandeja
      </Link>

      {loading && !data && <Alert tone="info">Cargando ofertas…</Alert>}

      {loadError && (
        <Alert
          tone="error"
          title="No se pudieron cargar las ofertas"
          action={
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>
              Reintentar
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {emergency && data && (
        <div className="space-y-6">
          <header>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-ink">
                  Ofertas · {emergency.municipality}, {emergency.province}
                </h1>
                <p className="mt-1 text-sm text-ink-soft">{emergency.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RefreshCw}
                  loading={loading}
                  onClick={load}
                >
                  Actualizar
                </Button>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-white p-3.5">
              <EmergencyStatusStepper status={status} />
            </div>
          </header>

          {message && <Alert tone="success">{message}</Alert>}
          {STATUS_INFO[status] && <Alert tone="info">{STATUS_INFO[status]}</Alert>}

          {status === 'validada' && (
            <DecisionPanel
              emergencyId={id}
              todosLosLotesCubiertos={data.todosLosLotesCubiertos}
              onDone={handleDone}
            />
          )}

          {status === 'en_ejecucion' && (
            <EjecucionPanel emergencyId={id} ofertas={data.ofertas} onDone={handleDone} />
          )}

          <section
            aria-labelledby="cobertura-title"
            className="rounded-2xl border border-line bg-white p-5 shadow-sm"
          >
            <h2 id="cobertura-title" className="text-lg font-bold text-ink">
              Cobertura por lote
            </h2>
            {data.todosLosLotesCubiertos !== null && (
              <p className="mt-1 text-sm text-ink-soft">
                {data.todosLosLotesCubiertos
                  ? 'Las ofertas validadas cubren todos los lotes.'
                  : 'Hay lotes que las ofertas validadas no cubren por completo.'}
              </p>
            )}
            <div className="mt-3">
              <CoberturaLotes lotes={data.lotes} />
            </div>
          </section>

          <section aria-labelledby="ofertas-title">
            <h2 id="ofertas-title" className="mb-3 text-lg font-bold text-ink">
              Ofertas ({data.ofertas.length})
            </h2>
            {data.ofertas.length === 0 ? (
              <Alert tone="warning">Todavía no hay ofertas para esta emergencia.</Alert>
            ) : (
              <div className="space-y-3">
                {data.ofertas.map((oferta) => (
                  <OfertaCard key={oferta.id} oferta={oferta} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default EmergencyOfertasPage;
