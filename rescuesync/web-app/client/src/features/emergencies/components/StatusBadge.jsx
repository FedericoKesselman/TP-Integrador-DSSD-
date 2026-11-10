import PropTypes from 'prop-types';

import { getStatusCopy, STATUS_TONES } from '../emergency-status.js';

// Etiqueta con el estado actual de una emergencia.
function StatusBadge({ status }) {
  const { label, tone } = getStatusCopy(status);
  const { badge, dot } = STATUS_TONES[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${badge}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};

export default StatusBadge;
