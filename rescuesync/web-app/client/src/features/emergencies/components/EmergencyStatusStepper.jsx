import PropTypes from 'prop-types';

import { STATUS_FLOW } from '../emergency-status.js';

// Línea de tiempo compacta del ciclo de una emergencia: los pasos ya recorridos
// quedan llenos y el actual se resalta. Si el estado no está en el ciclo
// (no debería pasar), no se marca ninguno como actual.
function EmergencyStatusStepper({ status }) {
  const currentIndex = STATUS_FLOW.findIndex((step) => step.value === status);

  return (
    <ol aria-label="Etapa del ciclo de la emergencia" className="flex items-start gap-1">
      {STATUS_FLOW.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li
            key={step.value}
            aria-current={current ? 'step' : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <span
              className={`h-1.5 w-full rounded-full ${
                done || current ? 'bg-brand' : 'bg-slate-200'
              } ${current ? 'ring-2 ring-brand/25' : ''}`}
            />
            <span
              className={`w-full truncate text-center text-[10px] leading-tight ${
                current ? 'font-bold text-brand' : 'text-slate-400'
              }`}
            >
              {step.shortLabel}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

EmergencyStatusStepper.propTypes = {
  status: PropTypes.string.isRequired,
};

export default EmergencyStatusStepper;
