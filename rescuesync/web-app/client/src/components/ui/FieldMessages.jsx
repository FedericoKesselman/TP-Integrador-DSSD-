import { CircleAlert } from 'lucide-react';
import PropTypes from 'prop-types';

// Ayuda y error de un campo, entre la etiqueta y el control (patrón de GOV.UK):
// así los ejemplos se leen antes de escribir y no desaparecen como un placeholder.
function FieldMessages({ id, hint = undefined, error = undefined }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-danger"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      )}
    </>
  );
}

FieldMessages.propTypes = {
  id: PropTypes.string.isRequired,
  hint: PropTypes.node,
  error: PropTypes.string,
};

export default FieldMessages;
