import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FilePenLine,
  History,
  MapPin,
  PackageCheck,
  Save,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  OFFER_OBSERVATIONS_MAX_LENGTH,
  validateOfertaPayload,
} from '../../../shared/oferta-validation.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import TextAreaField from '../components/ui/TextAreaField.jsx';
import { getEmergency } from '../services/emergency-service.js';
import { getLotes } from '../services/lote-service.js';
import {
  createOferta,
  getOfertaHistory,
  getOwnOfertas,
  updateOferta,
} from '../services/oferta-service.js';

function buildItemState(lotes, oferta) {
  const offeredByLote = new Map((oferta?.items ?? []).map((item) => [item.loteId, item]));

  return Object.fromEntries(
    lotes.map((lote) => {
      const offered = offeredByLote.get(lote.id);
      return [
        lote.id,
        {
          selected: Boolean(offered),
          quantityOffered: offered ? String(offered.quantityOffered) : '',
          notes: offered?.notes ?? '',
        },
      ];
    }),
  );
}

function firstValidationMessage(errors) {
  if (typeof errors.items === 'string') return errors.items;
  if (Array.isArray(errors.items)) {
    const itemError = errors.items.find(Boolean);
    if (itemError) return Object.values(itemError)[0];
  }
  return Object.values(errors).find((value) => typeof value === 'string');
}

function EmergencyOfertaPage() {
  const { id: emergencyId } = useParams();
  const [emergency, setEmergency] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [oferta, setOferta] = useState(null);
  const [history, setHistory] = useState([]);
  const [items, setItems] = useState({});
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [emergencyData, lotesData, ofertasData] = await Promise.all([
          getEmergency(emergencyId),
          getLotes(emergencyId),
          getOwnOfertas(emergencyId),
        ]);
        if (!active) return;

        const currentOferta = ofertasData[0] ?? null;
        setEmergency(emergencyData);
        setLotes(lotesData);
        setOferta(currentOferta);
        setItems(buildItemState(lotesData, currentOferta));
        setObservations(currentOferta?.observations ?? '');

        if (currentOferta) {
          const historyData = await getOfertaHistory(currentOferta.id);
          if (active) setHistory(historyData);
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'No se pudo cargar la convocatoria.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [emergencyId]);

  const selectedCount = useMemo(
    () => Object.values(items).filter((item) => item.selected).length,
    [items],
  );

  function updateItem(loteId, changes) {
    setItems((current) => ({
      ...current,
      [loteId]: { ...current[loteId], ...changes },
    }));
  }

  function toggleLote(loteId) {
    const current = items[loteId];
    updateItem(loteId, {
      selected: !current.selected,
      quantityOffered: current.selected ? '' : current.quantityOffered || '1',
      notes: current.selected ? '' : current.notes,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = {
      observations: observations.trim() || null,
      items: lotes
        .filter((lote) => items[lote.id]?.selected)
        .map((lote) => ({
          loteId: lote.id,
          quantityOffered: Number(items[lote.id].quantityOffered),
          notes: items[lote.id].notes.trim() || null,
        })),
    };
    const validationErrors = validateOfertaPayload(payload);
    if (Object.keys(validationErrors).length > 0) {
      setError(firstValidationMessage(validationErrors) || 'Revisá los datos de la oferta.');
      return;
    }

    try {
      setSaving(true);
      const saved = oferta
        ? await updateOferta(oferta.id, payload)
        : await createOferta(emergencyId, payload);
      setOferta(saved);
      setSuccess(oferta ? 'La oferta fue actualizada.' : 'La oferta fue registrada.');
      setItems(buildItemState(lotes, saved));
      setObservations(saved.observations ?? '');
      setHistory(await getOfertaHistory(saved.id));
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la oferta.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-center text-ink-muted">
        Cargando convocatoria y oferta…
      </div>
    );
  }

  if (!emergency) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Alert tone="error">{error || 'No se encontró la emergencia.'}</Alert>
      </div>
    );
  }

  const isOpen = emergency.status === 'convocatoria_abierta';

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-7">
          <Link
            to="/emergencias"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a convocatorias
          </Link>

          <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700">
                <PackageCheck className="h-4 w-4" />
                Oferta de ayuda humanitaria
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {emergency.municipality}, {emergency.province}
              </h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-brand" />
                {emergency.affectedZone}
              </p>
            </div>

            <span
              className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-bold ring-1 ${
                isOpen
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                  : 'bg-amber-50 text-amber-800 ring-amber-600/20'
              }`}
            >
              {isOpen ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {isOpen ? 'Convocatoria abierta' : 'Convocatoria no disponible'}
            </span>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}
          {!isOpen && (
            <Alert tone="warning">
              La convocatoria ya no está abierta, por lo que la oferta quedó en modo consulta.
            </Alert>
          )}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-900 px-6 py-5 text-white">
              <h2 className="text-lg font-black">Recursos solicitados</h2>
              <p className="mt-1 text-sm text-white/70">
                Seleccioná los lotes que tu organización puede cubrir e indicá la cantidad.
              </p>
            </div>

            <div className="divide-y divide-slate-200">
              {lotes.map((lote) => {
                const item = items[lote.id] ?? {
                  selected: false,
                  quantityOffered: '',
                  notes: '',
                };
                return (
                  <div
                    key={lote.id}
                    className={`p-5 transition-colors ${item.selected ? 'bg-emerald-50/40' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        id={`lote-${lote.id}`}
                        type="checkbox"
                        checked={item.selected}
                        disabled={!isOpen}
                        onChange={() => toggleLote(lote.id)}
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`lote-${lote.id}`} className="font-bold text-slate-900">
                          {lote.resourceType}
                        </label>
                        <p className="mt-1 text-sm text-slate-500">
                          Solicitado: <strong>{lote.quantityRequested}</strong>{' '}
                          {lote.unit || 'unidades'}
                          {lote.notes ? ` · ${lote.notes}` : ''}
                        </p>

                        {item.selected && (
                          <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
                            <label
                              className="text-sm font-semibold text-slate-700"
                              htmlFor={`quantity-${lote.id}`}
                            >
                              Cantidad ofrecida
                              <input
                                id={`quantity-${lote.id}`}
                                type="number"
                                min="1"
                                step="1"
                                required
                                disabled={!isOpen}
                                value={item.quantityOffered}
                                onChange={(event) =>
                                  updateItem(lote.id, { quantityOffered: event.target.value })
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                              />
                            </label>
                            <label
                              className="text-sm font-semibold text-slate-700"
                              htmlFor={`notes-${lote.id}`}
                            >
                              Nota del recurso{' '}
                              <span className="font-normal text-slate-400">(opcional)</span>
                              <input
                                id={`notes-${lote.id}`}
                                type="text"
                                disabled={!isOpen}
                                value={item.notes}
                                onChange={(event) =>
                                  updateItem(lote.id, { notes: event.target.value })
                                }
                                placeholder="Disponibilidad, condiciones o detalle"
                                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <TextAreaField
              id="observations"
              name="observations"
              label="Observaciones generales"
              optional
              rows={4}
              maxLength={OFFER_OBSERVATIONS_MAX_LENGTH}
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
              hint="Agregá información general sobre disponibilidad, traslado o coordinación."
            />
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <FilePenLine className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Estado de carga
                </p>
                <p className="font-black text-slate-900">
                  {oferta ? 'Editando oferta' : 'Nueva oferta'}
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-3 border-y border-slate-100 py-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Lotes seleccionados</dt>
                <dd className="font-bold text-slate-900">{selectedCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Versiones anteriores</dt>
                <dd className="font-bold text-slate-900">{history.length}</dd>
              </div>
            </dl>

            <Button
              type="submit"
              icon={Save}
              loading={saving}
              disabled={!isOpen || selectedCount === 0}
              className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {oferta ? 'Actualizar oferta' : 'Registrar oferta'}
            </Button>
          </section>

          {history.length > 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-black text-slate-900">
                <History className="h-5 w-5 text-brand" />
                Historial
              </h2>
              <div className="mt-4 space-y-3">
                {[...history].reverse().map((entry) => (
                  <div key={entry.version} className="rounded-2xl bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-slate-800">Versión {entry.version}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(entry.changedAt).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Modificada por {entry.changedBy || 'usuario de Bonita'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </form>
    </div>
  );
}

export default EmergencyOfertaPage;
