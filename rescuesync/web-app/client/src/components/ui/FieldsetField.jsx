import PropTypes from 'prop-types';

import FieldMessages from './FieldMessages.jsx';
import { describedBy, groupClassName } from './field-styles.js';

// Grupo de opciones (radios) con leyenda, ayuda y error.
function FieldsetField({
  id,
  legend,
  hint = undefined,
  error = undefined,
  className = '',
  children,
}) {
  return (
    <fieldset
      aria-describedby={describedBy(id, { hint, error })}
      className={groupClassName(Boolean(error), className)}
    >
      <legend className="float-left w-full text-base font-semibold text-ink">{legend}</legend>
      <div className="clear-left">
        <FieldMessages id={id} hint={hint} error={error} />
        <div className="mt-2">{children}</div>
      </div>
    </fieldset>
  );
}

FieldsetField.propTypes = {
  id: PropTypes.string.isRequired,
  legend: PropTypes.string.isRequired,
  hint: PropTypes.node,
  error: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default FieldsetField;
