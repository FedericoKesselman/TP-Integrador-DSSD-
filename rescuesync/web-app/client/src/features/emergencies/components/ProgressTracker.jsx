import PropTypes from 'prop-types';

import StepMarker from '../../../components/ui/StepMarker.jsx';
import { SECTION_ICONS } from '../emergency-icons.js';

// Barra fija arriba: pasos navegables + barra de avance con una luz en el frente.
// Se vuelve verde cuando están todos los datos obligatorios.
function ProgressTracker({ sections, activeId = undefined, onNavigate }) {
  const done = sections.reduce((sum, section) => sum + section.done, 0);
  const total = sections.reduce((sum, section) => sum + section.total, 0);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const complete = percent === 100;

  // Marcas donde termina cada sección, proporcionales a sus campos.
  let accumulated = 0;
  const ticks = sections.slice(0, -1).map((section) => {
    accumulated += section.total;
    return { id: section.id, left: (accumulated / total) * 100 };
  });

  return (
    <div className="sticky top-0 z-30 border-b border-white/70 bg-fog/80 shadow-[0_10px_24px_-18px_rgb(23_33_47/0.5)] backdrop-blur-md backdrop-saturate-150">
      <div className="px-3 pt-1.5 pb-2 sm:px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <nav aria-label="Secciones del formulario" className="min-w-0 flex-1">
            <ol className="flex gap-1 md:grid md:grid-cols-4 md:gap-2">
              {sections.map((section, index) => {
                const active = section.id === activeId;
                return (
                  <li key={section.id} className={active ? 'min-w-0 flex-1 md:flex-none' : ''}>
                    <button
                      type="button"
                      onClick={() => onNavigate(section.id)}
                      aria-current={active ? 'step' : undefined}
                      className={`group flex w-full items-center gap-2 rounded-lg p-0.5 pr-2 text-left transition-colors hover:bg-white/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 ${active ? 'bg-white/70' : ''}`}
                    >
                      <StepMarker
                        step={index + 1}
                        icon={SECTION_ICONS[section.id]}
                        complete={section.complete}
                        active={active}
                        size="sm"
                      />
                      <span
                        className={`min-w-0 leading-tight ${active ? 'block' : 'hidden'} md:block`}
                      >
                        <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand">
                          {section.title}
                        </span>
                        <span className="block text-xs text-ink-muted tabular-nums">
                          {section.done} de {section.total}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <p className="shrink-0 text-right leading-tight tabular-nums" aria-hidden="true">
            <span className={`block text-lg font-bold ${complete ? 'text-ok' : 'text-brand'}`}>
              {percent}%
            </span>
            <span className="hidden text-xs text-ink-soft sm:block">
              {complete ? 'Listo para registrar' : `${done} de ${total} obligatorios`}
            </span>
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="Datos obligatorios completos"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${done} de ${total} datos obligatorios`}
          className="relative mt-1.5 h-2 rounded-full bg-ink/10 shadow-[inset_0_1px_2px_rgb(23_33_47/0.2)]"
        >
          <div
            className={`progress-fill absolute inset-y-0 left-0 overflow-hidden rounded-full ${complete ? 'is-complete' : ''}`}
            style={{ width: `${percent}%` }}
          >
            <span className="progress-shimmer absolute inset-0" />
          </div>
          {ticks.map((tick) => (
            <span
              key={tick.id}
              aria-hidden="true"
              className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_0_1px_rgb(23_33_47/0.12)]"
              style={{ left: `${tick.left}%` }}
            />
          ))}
          {percent > 0 && (
            <span
              aria-hidden="true"
              className={`progress-beacon ${complete ? 'is-complete' : ''}`}
              style={{ left: `${percent}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

ProgressTracker.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      done: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired,
      complete: PropTypes.bool.isRequired,
    }),
  ).isRequired,
  activeId: PropTypes.string,
  onNavigate: PropTypes.func.isRequired,
};

export default ProgressTracker;
