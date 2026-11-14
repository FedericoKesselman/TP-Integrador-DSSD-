import PropTypes from 'prop-types';

// Tarjeta común de los gráficos: título, resumen textual (accesible) y acciones opcionales.
function ChartCard({ id, title, summary = undefined, actions = undefined, children }) {
  return (
    <section
      aria-labelledby={id}
      className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-bold text-ink">
            {title}
          </h2>
          {summary && <p className="mt-0.5 text-xs text-ink-muted">{summary}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

ChartCard.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  summary: PropTypes.string,
  actions: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export function EmptyChart({ children }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line bg-paper-sunken px-4 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

EmptyChart.propTypes = { children: PropTypes.node.isRequired };

export default ChartCard;
