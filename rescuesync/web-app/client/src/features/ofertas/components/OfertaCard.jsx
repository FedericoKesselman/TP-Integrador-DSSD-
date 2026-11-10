import PropTypes from 'prop-types';

import {
  NIVEL_HABILITACION,
  OFERTA_STATUS,
  RIESGO_PERMITIDO,
  ROL_SUGERIDO,
  ongNames,
} from '../ofertas-copy.js';

import Pill from './Pill.jsx';

// Una oferta con sus ONGs, lo que ofrece y el perfil que le dio el Sistema
// Nacional (nivel de habilitación, rol sugerido, riesgo permitido, capacidad por
// lote). Con `selectable` suma un checkbox para elegirla (adjudicación).
function OfertaCard({
  oferta,
  selectable = false,
  selected = false,
  onToggle = undefined,
  disabled = false,
}) {
  const { validacion } = oferta;
  const nivel = validacion ? NIVEL_HABILITACION[validacion.nivelHabilitacion] : null;
  const status = OFERTA_STATUS[oferta.status] ?? { label: oferta.status, tone: 'slate' };
  const habilitadaPorLote = new Map(
    (validacion?.capacidadesHabilitadas ?? []).map((item) => [
      item.loteId,
      item.cantidadHabilitada,
    ]),
  );
  const checkboxId = `oferta-${oferta.id}`;

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        selected ? 'border-brand ring-2 ring-brand/20' : 'border-line'
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {selectable ? (
            <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2.5">
              <input
                id={checkboxId}
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onToggle(oferta.id)}
                className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span className="text-base font-bold text-ink">{ongNames(oferta)}</span>
            </label>
          ) : (
            <h3 className="text-base font-bold text-ink">{ongNames(oferta)}</h3>
          )}
          {oferta.ongs.length > 1 && (
            <p className="mt-0.5 text-xs text-ink-muted">
              Consorcio: {oferta.ongs.map((ong) => `${ong.name} (${ong.role})`).join(', ')}
            </p>
          )}
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {validacion ? (
          <>
            <Pill tone={nivel?.tone ?? 'slate'}>
              {nivel?.label ?? validacion.nivelHabilitacion}
            </Pill>
            <span className="text-ink-soft">
              Rol sugerido:{' '}
              <strong>{ROL_SUGERIDO[validacion.rolSugerido] ?? validacion.rolSugerido}</strong>
            </span>
            <span className="text-ink-soft">
              Riesgo permitido hasta:{' '}
              <strong>
                {RIESGO_PERMITIDO[validacion.nivelRiesgoPermitido] ??
                  validacion.nivelRiesgoPermitido}
              </strong>
            </span>
          </>
        ) : (
          <span className="text-ink-muted">Todavía sin validar por el Sistema Nacional.</span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="py-1.5 pr-2 font-semibold">Recurso</th>
              <th className="px-2 py-1.5 text-right font-semibold">Pedido</th>
              <th className="px-2 py-1.5 text-right font-semibold">Ofrecido</th>
              {validacion && <th className="py-1.5 pl-2 text-right font-semibold">Habilitado</th>}
            </tr>
          </thead>
          <tbody>
            {oferta.items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  {item.resourceType}
                  {item.unit && <span className="ml-1 text-xs text-ink-muted">({item.unit})</span>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-ink-soft">
                  {item.quantityRequested}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{item.quantityOffered}</td>
                {validacion && (
                  <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">
                    {habilitadaPorLote.get(item.loteId) ?? 0}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validacion?.observaciones?.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-soft">
          {validacion.observaciones.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
      {oferta.observations && (
        <p className="mt-2 text-xs text-ink-muted">
          Observaciones de la ONG: {oferta.observations}
        </p>
      )}
    </article>
  );
}

OfertaCard.propTypes = {
  oferta: PropTypes.shape({
    id: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    observations: PropTypes.string,
    ongs: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, role: PropTypes.string }))
      .isRequired,
    items: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired })).isRequired,
    validacion: PropTypes.shape({
      nivelHabilitacion: PropTypes.string,
      rolSugerido: PropTypes.string,
      nivelRiesgoPermitido: PropTypes.string,
      capacidadesHabilitadas: PropTypes.arrayOf(PropTypes.shape({ loteId: PropTypes.string })),
      observaciones: PropTypes.arrayOf(PropTypes.string),
    }),
  }).isRequired,
  selectable: PropTypes.bool,
  selected: PropTypes.bool,
  onToggle: PropTypes.func,
  disabled: PropTypes.bool,
};

export default OfertaCard;
