import PropTypes from 'prop-types';

import {
  CONVOCATORIA_DURACION,
  DURACION_PRESETS,
  formatDuracion,
  getDuracionError,
  parseDuracion,
} from '../duracion.js';

// Duración de la ventana de ofertas, en minutos: atajos, campo numérico y los
// límites visibles. El error sale de la misma validación que usa el backend.
function DuracionConvocatoriaField({ id, value, onChange, disabled = false }) {
  const error = getDuracionError(value);
  const parsed = parseDuracion(value);
  const { defaultMin, minMin, maxMin } = CONVOCATORIA_DURACION;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-slate-800">
        Duración de la ventana de ofertas (minutos)
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {DURACION_PRESETS.map((preset) => (
          <button
            key={preset.minutes}
            type="button"
            disabled={disabled}
            onClick={() => onChange(String(preset.minutes))}
            aria-pressed={parsed === preset.minutes}
            className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition-colors disabled:opacity-50 ${
              parsed === preset.minutes
                ? 'bg-brand text-white ring-brand'
                : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={minMin}
          max={maxMin}
          step="1"
          value={value}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={`${id}-help`}
          onChange={(event) => onChange(event.target.value)}
          className={`w-32 rounded-lg border px-3 py-2 text-right tabular-nums focus:outline-none focus:ring-4 ${
            error
              ? 'border-danger focus:ring-danger/20'
              : 'border-slate-300 focus:border-brand focus:ring-brand/20'
          }`}
        />
        {!error && (
          <span className="text-sm font-semibold text-slate-600">{formatDuracion(parsed)}</span>
        )}
      </div>
      <p id={`${id}-help`} className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-slate-500'}`}>
        {error ||
          `Sugerido: ${defaultMin} min. Mínimo ${minMin} min, máximo ${maxMin} min (${formatDuracion(maxMin)}). Pasado ese tiempo la convocatoria se cierra sola.`}
      </p>
    </div>
  );
}

DuracionConvocatoriaField.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default DuracionConvocatoriaField;
