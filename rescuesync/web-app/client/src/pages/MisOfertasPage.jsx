/* Los handlers de cada oferta dependen de la oferta, así que se pasan como funciones. */
/* eslint-disable react/jsx-no-bind */
import { CheckCheck, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import StatusBadge from '../features/emergencies/components/StatusBadge.jsx';
import Pill from '../features/ofertas/components/Pill.jsx';
import { OFERTA_STATUS, ongNames } from '../features/ofertas/ofertas-copy.js';
import { finalizarOferta } from '../services/ciclo-service.js';
import { listEmergencies } from '../services/emergency-service.js';
import { getOwnOfertas } from '../services/oferta-service.js';

// Solo importan las emergencias donde ya hubo adjudicación.
const EMERGENCY_STATES_WITH_RESULT = ['adjudicada', 'en_ejecucion', 'finalizada'];
const OFERTA_STATES_WITH_RESULT = ['adjudicada', 'finalizada', 'no_seleccionada'];

// "Mis ofertas" (ONG, E5-55): resultado de las ofertas de la ONG y, mientras la
// emergencia está en ejecución, el botón para marcar la actividad como finalizada.
function MisOfertasPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [finalizingId, setFinalizingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const emergencies = (await listEmergencies()).filter((item) =>
        EMERGENCY_STATES_WITH_RESULT.includes(item.status),
      );
      const withOfertas = await Promise.all(
        emergencies.map(async (emergency) => {
          const ofertas = await getOwnOfertas(emergency.id);
          return {
            emergency,
            ofertas: ofertas.filter((oferta) => OFERTA_STATES_WITH_RESULT.includes(oferta.status)),
          };
        }),
      );
      setEntries(withOfertas.filter((entry) => entry.ofertas.length > 0));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function finalize(ofertaId) {
    setFinalizingId(ofertaId);
    setActionError(null);
    try {
      await finalizarOferta(ofertaId);
      setConfirmingId(null);
      await load();
    } catch (err) {
      setActionError(err.message);
      setConfirmingId(null);
    } finally {
      setFinalizingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Mis ofertas</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Resultado de tus ofertas en las emergencias adjudicadas. Cuando empiece la ejecución,
            marcá tu actividad como finalizada al terminar.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={load}>
          Actualizar
        </Button>
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="error" title="No se pudo finalizar la actividad">
            {actionError}
          </Alert>
        </div>
      )}

      {loadError && (
        <Alert
          tone="error"
          title="No se pudieron cargar tus ofertas"
          action={
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>
              Reintentar
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {!loading && !loadError && entries.length === 0 && (
        <Alert tone="info">
          Todavía no tenés ofertas con resultado. Aparecen acá cuando el municipio adjudica una
          convocatoria en la que participaste.
        </Alert>
      )}

      <div className="space-y-6">
        {entries.map(({ emergency, ofertas }) => (
          <section
            key={emergency.id}
            aria-labelledby={`emg-${emergency.id}`}
            className="rounded-2xl border border-line bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 id={`emg-${emergency.id}`} className="text-lg font-bold text-ink">
                {emergency.municipality}, {emergency.province}
              </h2>
              <StatusBadge status={emergency.status} />
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">{emergency.description}</p>

            <ul className="mt-4 space-y-3">
              {ofertas.map((oferta) => {
                const status = OFERTA_STATUS[oferta.status];
                const canFinalize =
                  oferta.status === 'adjudicada' && emergency.status === 'en_ejecucion';
                return (
                  <li key={oferta.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-ink">{ongNames(oferta)}</p>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </div>
                    <ul className="mt-2 text-sm text-ink-soft">
                      {oferta.items.map((item) => (
                        <li key={item.id}>
                          {item.resourceType}: {item.quantityOffered}
                          {item.unit ? ` ${item.unit}` : ''}
                        </li>
                      ))}
                    </ul>

                    {oferta.status === 'adjudicada' && !canFinalize && (
                      <p className="mt-3 text-xs text-ink-muted">
                        Vas a poder marcarla como finalizada cuando comience la ejecución.
                      </p>
                    )}
                    {canFinalize &&
                      (confirmingId === oferta.id ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <p className="text-sm text-ink">
                            ¿Confirmás que la actividad terminó? No se puede deshacer.
                          </p>
                          <Button
                            size="sm"
                            icon={CheckCheck}
                            loading={finalizingId === oferta.id}
                            onClick={() => finalize(oferta.id)}
                          >
                            Sí, finalizar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={finalizingId === oferta.id}
                            onClick={() => setConfirmingId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            icon={CheckCheck}
                            onClick={() => setConfirmingId(oferta.id)}
                          >
                            Marcar actividad como finalizada
                          </Button>
                        </div>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-sm text-ink-muted">
        <Link to="/emergencias" className="font-semibold text-brand hover:underline">
          Volver a la bandeja
        </Link>
      </p>
    </div>
  );
}

export default MisOfertasPage;
