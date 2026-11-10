import PropTypes from 'prop-types';

// Cobertura por lote: lo pedido contra lo que el Sistema Nacional habilitó.
// `cubierta` null = todavía no hay una validación vigente para ese lote.
function CoberturaLotes({ lotes }) {
  return (
    <ul className="space-y-2.5">
      {lotes.map((lote) => {
        const sinDatos = lote.cubierta === null || lote.cubierta === undefined;
        const percent = sinDatos
          ? 0
          : Math.min(100, Math.round((lote.cubierta / lote.quantityRequested) * 100));
        const completo = !sinDatos && lote.cubierta >= lote.quantityRequested;
        return (
          <li key={lote.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{lote.resourceType}</span>
              <span className="tabular-nums text-ink-soft">
                {sinDatos ? 'Sin validar' : `${lote.cubierta} de ${lote.quantityRequested}`}
                {lote.unit ? ` ${lote.unit}` : ''}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`Cobertura de ${lote.resourceType}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className={`h-full rounded-full ${completo ? 'bg-ok' : 'bg-amber-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

CoberturaLotes.propTypes = {
  lotes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      resourceType: PropTypes.string.isRequired,
      unit: PropTypes.string,
      quantityRequested: PropTypes.number.isRequired,
      cubierta: PropTypes.number,
    }),
  ).isRequired,
};

export default CoberturaLotes;
