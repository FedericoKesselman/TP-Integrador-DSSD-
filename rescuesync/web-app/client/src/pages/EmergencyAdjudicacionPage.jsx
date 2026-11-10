/* Los handlers dependen del estado de la pantalla, así que se pasan como funciones. */
/* eslint-disable react/jsx-no-bind */
import { ArrowLeft, Gavel, RefreshCw } from 'lucide-react';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import StatusBadge from '../features/emergencies/components/StatusBadge.jsx';
import CoberturaLotes from '../features/ofertas/components/CoberturaLotes.jsx';
import OfertaCard from '../features/ofertas/components/OfertaCard.jsx';
import { ongNames } from '../features/ofertas/ofertas-copy.js';
import {
  adjudicarOfertas,
  getEmergencyDetail,
  getOfertasValidadas,
} from '../services/ciclo-service.js';

// Lo que el municipio elegiría cubrir con las ofertas marcadas: suma lo que el
// Sistema Nacional habilitó por lote, sin pasarse de lo pedido.
function coberturaDeSeleccion(lotes, ofertas, selectedIds) {
  const totals = new Map();
  ofertas
    .filter((oferta) => selectedIds.has(oferta.id))
    .forEach((oferta) => {
      (oferta.validacion?.capacidadesHabilitadas ?? []).forEach((item) => {
        totals.set(item.loteId, (totals.get(item.loteId) ?? 0) + item.cantidadHabilitada);
      });
    });
  return lotes.map((lote) => ({
    ...lote,
    cubierta: Math.min(lote.quantityRequested, totals.get(lote.id) ?? 0),
  }));
}

function coberturaMessage(selectedCount, completa) {
  if (selectedCount === 0) {
    return 'Marcá las ofertas que querés adjudicar para ver qué lotes cubrirían.';
  }
  return completa
    ? 'La selección cubre todos los lotes.'
    : 'La selección no cubre todos los lotes.';
}

// Explica el último rechazo del Sistema Nacional (409 de /compromisos): qué
// oferta y qué recurso no alcanzaron.
function ConflictoCompromiso({ conflicto, ofertas, lotes }) {
  const { detalle, registradoAt } = conflicto;
  const oferta = ofertas.find((item) => item.id === detalle?.ofertaId);
  const lote = lotes.find((item) => item.resourceCode === detalle?.recursoCodigo);

  return (
    <Alert tone="warning" title="El Sistema Nacional rechazó la adjudicación anterior">
      <p>
        Los recursos no alcanzaron y no se reservó nada
        {registradoAt ? ` (${new Date(registradoAt).toLocaleString('es-AR')})` : ''}. Elegí otra
        combinación de ofertas.
      </p>
      {detalle && (
        <ul className="mt-1 list-disc pl-5">
          <li>Oferta: {oferta ? ongNames(oferta) : detalle.ofertaId}</li>
          <li>Recurso: {lote?.resourceType ?? detalle.recursoCodigo}</li>
          <li>
            Solicitado {detalle.solicitado}, disponible {detalle.disponible}, faltan{' '}
            {detalle.faltante}
          </li>
          {(detalle.ongs ?? []).map((ong) => (
            <li key={ong.ongRef}>
              {ong.ongRef}: disponible {ong.disponible}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

ConflictoCompromiso.propTypes = {
  conflicto: PropTypes.shape({
    registradoAt: PropTypes.string,
    detalle: PropTypes.shape({
      ofertaId: PropTypes.string,
      recursoCodigo: PropTypes.string,
      solicitado: PropTypes.number,
      disponible: PropTypes.number,
      faltante: PropTypes.number,
      ongs: PropTypes.arrayOf(
        PropTypes.shape({ ongRef: PropTypes.string, disponible: PropTypes.number }),
      ),
    }),
  }).isRequired,
  ofertas: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string })).isRequired,
  lotes: PropTypes.arrayOf(PropTypes.shape({ resourceCode: PropTypes.string })).isRequired,
};

// Adjudicación (municipio, E5-53): ofertas validadas con su perfil de competencia
// y riesgo, selección con la cobertura que lograría, y confirmación.
function EmergencyAdjudicacionPage() {
  const { id } = useParams();
  const [emergency, setEmergency] = useState(null);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [sent, setSent] = useState(false);
  // Fecha del último rechazo del SN al momento de enviar: si cambia, hay un rechazo nuevo.
  const conflictAtSentRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [detail, ofertas] = await Promise.all([
        getEmergencyDetail(id),
        getOfertasValidadas(id),
      ]);
      setEmergency(detail);
      setData(ofertas);
      // Tras enviar, la pantalla queda bloqueada hasta que cambie el estado o llegue un rechazo nuevo.
      const conflictAt = detail.ultimoConflictoCompromiso?.registradoAt ?? null;
      setSent((current) => current && conflictAt === conflictAtSentRef.current);
      setSelected(new Set());
      setConfirming(false);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const cobertura = useMemo(
    () => (data ? coberturaDeSeleccion(data.lotes, data.ofertas, selected) : []),
    [data, selected],
  );

  function toggle(ofertaId) {
    setSent(false);
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(ofertaId)) next.delete(ofertaId);
      else next.add(ofertaId);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await adjudicarOfertas(id, [...selected]);
      conflictAtSentRef.current = emergency?.ultimoConflictoCompromiso?.registradoAt ?? null;
      setSent(true);
      setConfirming(false);
    } catch (err) {
      setSubmitError(err.message);
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  const canSelect = emergency?.status === 'validada' && !sent;
  const conflicto = emergency?.ultimoConflictoCompromiso;
  const completa =
    cobertura.length > 0 && cobertura.every((l) => l.cubierta >= l.quantityRequested);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/emergencias"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a la bandeja
      </Link>

      {loading && !data && <Alert tone="info">Cargando ofertas validadas…</Alert>}

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
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-ink">
                Adjudicación · {emergency.municipality}, {emergency.province}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">{emergency.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={emergency.status} />
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
          </header>

          {sent && (
            <Alert tone="success" title="Selección enviada">
              Los recursos se reservan en el Sistema Nacional. Si alcanzan, la emergencia pasa a
              &quot;Adjudicada&quot; en unos instantes; si no, vas a ver el motivo acá. Actualizá
              para ver el resultado.
            </Alert>
          )}
          {submitError && (
            <Alert tone="error" title="No se pudo registrar la adjudicación">
              {submitError}
            </Alert>
          )}
          {emergency.status !== 'validada' && (
            <Alert tone="info">
              {emergency.status === 'convocatoria_cerrada'
                ? 'Las ofertas todavía se están validando. Volvé a esta pantalla cuando estén listas.'
                : 'Esta emergencia no está esperando adjudicación.'}
            </Alert>
          )}
          {conflicto && emergency.status === 'validada' && (
            <ConflictoCompromiso conflicto={conflicto} ofertas={data.ofertas} lotes={data.lotes} />
          )}

          <section
            aria-labelledby="cobertura-title"
            className="rounded-2xl border border-line bg-white p-5 shadow-sm"
          >
            <h2 id="cobertura-title" className="text-lg font-bold text-ink">
              Cobertura con tu selección
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {coberturaMessage(selected.size, completa)}
            </p>
            <div className="mt-3">
              <CoberturaLotes lotes={cobertura} />
            </div>
          </section>

          <section aria-labelledby="ofertas-title">
            <h2 id="ofertas-title" className="mb-3 text-lg font-bold text-ink">
              Ofertas validadas ({data.ofertas.length})
            </h2>
            {data.ofertas.length === 0 ? (
              <Alert tone="warning">No hay ofertas validadas para adjudicar.</Alert>
            ) : (
              <div className="space-y-3">
                {data.ofertas.map((oferta) => (
                  <OfertaCard
                    key={oferta.id}
                    oferta={oferta}
                    selectable={canSelect}
                    selected={selected.has(oferta.id)}
                    onToggle={toggle}
                    disabled={submitting}
                  />
                ))}
              </div>
            )}
          </section>

          {canSelect && data.ofertas.length > 0 && (
            <div className="sticky bottom-0 rounded-t-2xl border border-line bg-white px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(23_33_47/0.25)]">
              {confirming ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink">
                    ¿Adjudicar {selected.size} {selected.size === 1 ? 'oferta' : 'ofertas'}? Se
                    reservan los recursos en el Sistema Nacional.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={submitting}
                      onClick={() => setConfirming(false)}
                    >
                      Cancelar
                    </Button>
                    <Button icon={Gavel} loading={submitting} onClick={submit}>
                      Confirmar adjudicación
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted">
                    {selected.size}{' '}
                    {selected.size === 1 ? 'oferta seleccionada' : 'ofertas seleccionadas'}.
                  </p>
                  <Button
                    icon={Gavel}
                    disabled={selected.size === 0}
                    onClick={() => setConfirming(true)}
                  >
                    Adjudicar ofertas
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmergencyAdjudicacionPage;
