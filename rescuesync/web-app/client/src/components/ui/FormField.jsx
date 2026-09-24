import PropTypes from 'prop-types';

import FieldMessages from './FieldMessages.jsx';
import { groupClassName } from './field-styles.js';

function FormField({
  id,
  label,
  optional = false,
  hint = undefined,
  error = undefined,
  aside = undefined,
  className = '',
  children,
}) {
  return (
    <div className={groupClassName(Boolean(error), className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-base font-semibold text-ink">
          {label}
          {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
        </label>
        {aside}
      </div>
      <FieldMessages id={id} hint={hint} error={error} />
      <div className="mt-2">{children}</div>
    </div>
  );
}

FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  optional: PropTypes.bool,
  hint: PropTypes.node,
  error: PropTypes.string,
  aside: PropTypes.node,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default FormField;
