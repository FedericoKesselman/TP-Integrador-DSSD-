/* Los handlers de cada renglón dependen del recurso, así que se pasan como funciones. */
/* eslint-disable react/jsx-no-bind */
import { Boxes, RefreshCw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { validateInventarioPayload } from '../../../shared/inventario-validation.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import { RESOURCE_CATEGORIES } from '../features/lotes/lote-constants.js';
import { getInventario, saveInventario } from '../services/inventario-service.js';

const COLD_START_NOTE =
  'Si el Sistema Nacional estuvo inactivo, la primera respuesta puede tardar hasta un minuto.';

// Un renglón por recurso del catálogo (el mismo de los lotes), con el stock que
// el SN ya tiene de la ONG (o null si todavía no cargó ese recurso). Lo que el SN
// devuelva y no esté en el catálogo va aparte, para no esconderlo.
function buildSections(stockList) {
  const byCode = new Map(stockList.map((item) => [item.recursoCodigo, item]));
  const sections = RESOURCE_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    rows: category.resources.map((resource) => {
      const stock = byCode.get(resource.id) ?? null;
      return {
        code: resource.id,
        nombre: resource.label,
        unidad: stock?.unidad ?? resource.unit,
        stock,
      };
    }),
  }));

  const known = new Set(sections.flatMap((section) => section.rows.map((row) => row.code)));
  const extras = stockList
    .filter((item) => !known.has(item.recursoCodigo))
    .map((item) => ({
      code: item.recursoCodigo,
      nombre: item.nombre || item.recursoCodigo,
      unidad: item.unidad,
      stock: item,
    }));
  if (extras.length > 0) sections.push({ id: 'otros', label: 'Otros recursos', rows: extras });
  return sections;
}

function savedValue(row) {
  return row.stock ? String(row.stock.cantidadTotal) : '';
}

function parseTotal(text) {
  return text.trim() === '' ? Number.NaN : Number(text);
}

function InventarioPage() {
  const [stockList, setStockList] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getInventario()
      .then((list) => {
        setStockList(list);
        setDrafts({});
      })
      .catch((err) => setLoadError(err.message || 'No se pudo cargar el inventario.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => buildSections(stockList), [stockList]);
  const rows = useMemo(() => sections.flatMap((section) => section.rows), [sections]);
  const rowsByCode = useMemo(() => new Map(rows.map((row) => [row.code, row])), [rows]);

  // Solo se mandan los renglones que el usuario cambió.
  const changes = useMemo(
    () =>
      rows
        .filter((row) => drafts[row.code] !== undefined)
        .map((row) => ({ code: row.code, cantidadTotal: parseTotal(drafts[row.code]) })),
    [rows, drafts],
  );

  const fieldErrors = useMemo(() => {
    const result = validateInventarioPayload({
      recursos: changes.map((change) => ({
        recursoCodigo: change.code,
        cantidadTotal: change.cantidadTotal,
      })),
    });
    const byCode = {};
    (result.items ?? []).forEach((itemErrors, index) => {
      if (itemErrors?.cantidadTotal) byCode[changes[index].code] = itemErrors.cantidadTotal;
    });
    return byCode;
  }, [changes]);

  const hasChanges = changes.length > 0;
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const loadedCount = rows.filter((row) => row.stock).length;

  function handleChange(row, value) {
    setSaved(false);
    setDrafts((current) => {
      const next = { ...current };
      if (value === savedValue(row)) delete next[row.code];
      else next[row.code] = value;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await saveInventario(
        changes.map((change) => ({
          recursoCodigo: change.code,
          cantidadTotal: change.cantidadTotal,
        })),
      );
      setStockList(updated);
      setDrafts({});
      setSaved(true);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  const insuficientes = saveError?.detalle?.insuficientes ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Boxes className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-bold text-ink">Mi inventario</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Cargá cuánto tiene tu organización de cada recurso. El Sistema Nacional usa estos
            totales para validar tus ofertas; lo comprometido en convocatorias adjudicadas no se
            puede bajar.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          onClick={load}
          disabled={loading || saving}
        >
          Actualizar
        </Button>
      </div>

      {loading && (
        <Alert tone="info" title="Consultando el Sistema Nacional…">
          {COLD_START_NOTE}
        </Alert>
      )}

      {!loading && loadError && (
        <Alert
          tone="error"
          title="No se pudo cargar el inventario"
          action={
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>
              Reintentar
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {!loading && !loadError && (
        <>
          <p className="mb-4 text-sm text-ink-muted">
            {loadedCount} de {rows.length} recursos con stock cargado.
          </p>

          <div className="space-y-6">
            {sections.map((section) => (
              <section
                key={section.id}
                aria-labelledby={`inv-${section.id}`}
                className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
              >
                <h2
                  id={`inv-${section.id}`}
                  className="border-b border-line bg-paper-sunken px-4 py-2.5 text-sm font-bold text-ink"
                >
                  {section.label}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] table-fixed text-sm">
                    <colgroup>
                      <col />
                      <col className="w-40" />
                      <col className="w-36" />
                      <col className="w-32" />
                    </colgroup>
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                        <th className="px-4 py-2 font-semibold">Recurso</th>
                        <th className="px-2 py-2 font-semibold">Total</th>
                        <th className="px-2 py-2 text-right font-semibold">Comprometido</th>
                        <th className="px-4 py-2 text-right font-semibold">Disponible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row) => {
                        const value = drafts[row.code] ?? savedValue(row);
                        const error = fieldErrors[row.code];
                        const committed = row.stock?.cantidadComprometida ?? 0;
                        const typed = parseTotal(value);
                        const available =
                          drafts[row.code] !== undefined && Number.isInteger(typed)
                            ? typed - committed
                            : (row.stock?.cantidadDisponible ?? null);
                        const inputId = `inv-input-${row.code}`;
                        return (
                          <tr key={row.code} className="border-t border-line align-top">
                            <td className="px-4 py-2.5">
                              <label htmlFor={inputId} className="font-medium text-ink">
                                {row.nombre}
                              </label>
                              {row.unidad && (
                                <span className="ml-1.5 text-xs text-ink-muted">
                                  ({row.unidad})
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                id={inputId}
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                value={value}
                                placeholder="—"
                                disabled={saving}
                                aria-invalid={error ? 'true' : undefined}
                                aria-describedby={error ? `${inputId}-error` : undefined}
                                onChange={(event) => handleChange(row, event.target.value)}
                                className={`w-28 rounded-lg border px-2.5 py-1.5 text-right tabular-nums focus:outline-none focus:ring-4 ${
                                  error
                                    ? 'border-danger focus:ring-danger/20'
                                    : 'border-line focus:border-brand focus:ring-brand/20'
                                }`}
                              />
                              {error && (
                                <p id={`${inputId}-error`} className="mt-1 text-xs text-danger">
                                  {error}
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-ink-soft">
                              {row.stock ? committed : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink">
                              {available ?? '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          <div className="sticky bottom-0 mt-6 space-y-3 rounded-t-2xl border border-line bg-white px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(23_33_47/0.25)]">
            {saved && <Alert tone="success">Inventario actualizado en el Sistema Nacional.</Alert>}
            {saveError && (
              <Alert tone="error" title="No se guardaron los cambios">
                {saveError.message}
                {insuficientes.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {insuficientes.map((item) => (
                      <li key={item.recursoCodigo}>
                        {rowsByCode.get(item.recursoCodigo)?.nombre ?? item.recursoCodigo}: total{' '}
                        {item.cantidadTotal}, comprometido {item.cantidadComprometida}
                      </li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">
                {hasChanges
                  ? `${changes.length} cambio${changes.length === 1 ? '' : 's'} sin guardar.`
                  : 'Sin cambios.'}{' '}
                {saving && COLD_START_NOTE}
              </p>
              <Button
                icon={Save}
                loading={saving}
                disabled={!hasChanges || hasErrors}
                onClick={handleSave}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default InventarioPage;
