import { CircleAlert } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';

// Resumen de errores (patrón de GOV.UK): recibe el foco en cada intento de envío y cada error
// es un enlace que lleva al campo correspondiente.
function ErrorSummary({ errors, focusKey, onSelect, getTargetId }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusKey]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-2xl border-l-8 border-danger bg-paper p-5 shadow-paper outline-none focus-visible:ring-4 focus-visible:ring-danger/25 sm:p-6"
    >
      <h2
        id="error-summary-title"
        className="flex items-center gap-2 text-xl font-bold text-ink font-stretch-semi-condensed"
      >
        <CircleAlert className="h-6 w-6 text-danger" aria-hidden="true" />
        {errors.length === 1 ? 'Falta corregir 1 dato' : `Faltan corregir ${errors.length} datos`}
      </h2>
      <ul className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 2xl:grid-cols-3">
        {errors.map(([field, message]) => (
          <li key={field}>
            <a
              href={`#${getTargetId(field)}`}
              onClick={(event) => {
                event.preventDefault();
                onSelect(field);
              }}
              className="font-semibold text-danger underline decoration-danger/40 underline-offset-2 transition-colors hover:decoration-danger hover:decoration-2 focus-visible:rounded focus-visible:bg-warn-soft focus-visible:outline-none"
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

ErrorSummary.propTypes = {
  errors: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  focusKey: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
  getTargetId: PropTypes.func.isRequired,
};

export default ErrorSummary;
