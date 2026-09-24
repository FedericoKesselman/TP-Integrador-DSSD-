import PropTypes from 'prop-types';

import { controlClassName, describedBy } from './field-styles.js';
import FormField from './FormField.jsx';

// Contador: primero muestra cuánto falta para el mínimo, después cuánto queda del máximo.
function CharacterCounter({ length, minLength = undefined, maxLength = undefined }) {
  const belowMin = minLength && length < minLength;
  const nearMax = maxLength && length > maxLength * 0.9;
  let text = maxLength ? `${length} / ${maxLength}` : `${length}`;
  if (belowMin) text = `Faltan ${minLength - length} caracteres`;

  return (
    <span
      aria-live="polite"
      className={`text-sm tabular-nums ${nearMax ? 'font-semibold text-warn' : 'text-ink-muted'}`}
    >
      {text}
    </span>
  );
}

CharacterCounter.propTypes = {
  length: PropTypes.number.isRequired,
  minLength: PropTypes.number,
  maxLength: PropTypes.number,
};

function TextAreaField({
  id,
  name,
  label,
  value,
  onChange,
  onBlur = undefined,
  optional = false,
  hint = undefined,
  error = undefined,
  className = '',
  rows = 5,
  minLength = undefined,
  maxLength = undefined,
}) {
  return (
    <FormField
      id={id}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      aside={<CharacterCounter length={value.length} minLength={minLength} maxLength={maxLength} />}
      className={className}
    >
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        rows={rows}
        maxLength={maxLength}
        aria-required={!optional}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, { hint, error })}
        className={`${controlClassName(Boolean(error))} resize-y leading-relaxed`}
      />
    </FormField>
  );
}

TextAreaField.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  optional: PropTypes.bool,
  hint: PropTypes.node,
  error: PropTypes.string,
  className: PropTypes.string,
  rows: PropTypes.number,
  minLength: PropTypes.number,
  maxLength: PropTypes.number,
};

export default TextAreaField;
