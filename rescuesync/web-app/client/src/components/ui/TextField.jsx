import PropTypes from 'prop-types';

import { controlClassName, describedBy } from './field-styles.js';
import FormField from './FormField.jsx';

function TextField({
  id,
  name,
  label,
  value,
  onChange,
  onBlur = undefined,
  type = 'text',
  optional = false,
  hint = undefined,
  error = undefined,
  className = '',
  inputMode = undefined,
  step = undefined,
  min = undefined,
  max = undefined,
  autoComplete = undefined,
}) {
  return (
    <FormField
      id={id}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      className={className}
    >
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        inputMode={inputMode}
        step={step}
        min={min}
        max={max}
        autoComplete={autoComplete}
        aria-required={!optional}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, { hint, error })}
        className={controlClassName(Boolean(error))}
      />
    </FormField>
  );
}

TextField.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  type: PropTypes.string,
  optional: PropTypes.bool,
  hint: PropTypes.node,
  error: PropTypes.string,
  className: PropTypes.string,
  inputMode: PropTypes.string,
  step: PropTypes.string,
  min: PropTypes.string,
  max: PropTypes.string,
  autoComplete: PropTypes.string,
};

export default TextField;
