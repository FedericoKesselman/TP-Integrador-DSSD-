import PropTypes from 'prop-types';

import FieldsetField from '../../../components/ui/FieldsetField.jsx';
import { TYPE_ICONS } from '../emergency-icons.js';
import { EMERGENCY_TYPES } from '../emergency-constants.js';

function EmergencyTypePicker({ value, onChange, error = undefined, className = '' }) {
  return (
    <FieldsetField id="type" legend="Tipo de emergencia" error={error} className={className}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {EMERGENCY_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type.value];
          const checked = value === type.value;
          return (
            <label
              key={type.value}
              htmlFor={`type-${type.value}`}
              className={
                'group flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-2.5 transition-[border-color,box-shadow,transform,background-color] duration-150 ' +
                'hover:-translate-y-px hover:shadow-lift has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/25 ' +
                `${checked ? 'border-brand bg-brand-soft shadow-lift' : 'border-line hover:border-ink-muted'}`
              }
            >
              <input
                id={`type-${type.value}`}
                type="radio"
                name="type"
                value={type.value}
                checked={checked}
                onChange={onChange}
                className="sr-only"
              />
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  checked
                    ? 'bg-brand text-white'
                    : 'bg-paper-sunken text-ink-soft group-hover:text-brand'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 leading-tight font-semibold break-words text-ink">
                {type.label}
              </span>
            </label>
          );
        })}
      </div>
    </FieldsetField>
  );
}

EmergencyTypePicker.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  className: PropTypes.string,
};

export default EmergencyTypePicker;
