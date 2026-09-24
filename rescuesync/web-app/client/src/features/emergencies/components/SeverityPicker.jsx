import PropTypes from 'prop-types';

import FieldsetField from '../../../components/ui/FieldsetField.jsx';
import { SEVERITY_LEVELS } from '../emergency-constants.js';

// Barras tipo "señal": muestran que los niveles están ordenados de menor a mayor.
function SeverityMeter({ level }) {
  return (
    <span className="flex items-end gap-0.5" aria-hidden="true">
      {SEVERITY_LEVELS.map((item, index) => (
        <span
          key={item.value}
          className={`w-1.5 rounded-sm ${index < level ? 'bg-(--sev)' : 'bg-ink/15'}`}
          style={{ height: `${6 + index * 3}px` }}
        />
      ))}
    </span>
  );
}

SeverityMeter.propTypes = {
  level: PropTypes.number.isRequired,
};

function SeverityPicker({ value, onChange, error = undefined, className = '' }) {
  return (
    <FieldsetField
      id="severity"
      legend="Nivel de gravedad"
      hint="Elegí el nivel según la situación actual; el Centro Coordinador puede ajustarlo."
      error={error}
      className={className}
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {SEVERITY_LEVELS.map((level, index) => {
          const checked = value === level.value;
          return (
            <label
              key={level.value}
              htmlFor={`severity-${level.value}`}
              style={{ '--sev': level.color }}
              className={
                'relative flex cursor-pointer flex-col gap-1 overflow-hidden rounded-xl border bg-white p-3 pt-4 transition-[border-color,box-shadow,transform,background-color] duration-150 ' +
                'hover:-translate-y-px hover:shadow-lift has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/25 ' +
                `${checked ? 'border-(--sev) bg-[color-mix(in_srgb,var(--sev)_7%,white)] shadow-lift ring-2 ring-(--sev)/25' : 'border-line hover:border-ink-muted'}`
              }
            >
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-1.5 bg-(--sev) transition-opacity ${checked ? 'opacity-100' : 'opacity-45'}`}
              />
              <input
                id={`severity-${level.value}`}
                type="radio"
                name="severity"
                value={level.value}
                checked={checked}
                onChange={onChange}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className={`font-bold ${checked ? 'text-(--sev)' : 'text-ink'}`}>
                  {level.label}
                </span>
                <SeverityMeter level={index + 1} />
              </span>
              <span className="text-sm leading-snug text-ink-soft">{level.description}</span>
            </label>
          );
        })}
      </div>
    </FieldsetField>
  );
}

SeverityPicker.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  className: PropTypes.string,
};

export default SeverityPicker;
