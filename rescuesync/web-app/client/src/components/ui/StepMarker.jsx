import { Check } from 'lucide-react';
import PropTypes from 'prop-types';

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
};

// Ícono del paso; se convierte en un tilde cuando la sección está completa.
function StepMarker({ step, icon: Icon, complete = false, active = false, size = 'md' }) {
  let tone = 'bg-white text-ink-soft ring-1 ring-line';
  if (active) tone = 'bg-brand-soft text-brand ring-2 ring-brand';
  if (complete) tone = 'bg-brand text-white ring-0 shadow-[0_0_0_4px_rgb(0_114_187/0.15)]';

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow,color] duration-300 ${SIZES[size]} ${tone}`}
    >
      {complete ? (
        <Check className="h-1/2 w-1/2" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Icon className="h-1/2 w-1/2" aria-hidden="true" />
      )}
      <span className="sr-only">
        Paso {step}
        {complete ? ', completo' : ''}:{' '}
      </span>
    </span>
  );
}

StepMarker.propTypes = {
  step: PropTypes.number.isRequired,
  icon: PropTypes.elementType.isRequired,
  complete: PropTypes.bool,
  active: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md']),
};

export default StepMarker;
