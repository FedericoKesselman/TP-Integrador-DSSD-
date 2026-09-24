import PropTypes from 'prop-types';

// Forma de los valores del formulario de emergencia (ver createEmptyEmergency).
export const emergencyValuesShape = PropTypes.shape({
  type: PropTypes.string.isRequired,
  typeOther: PropTypes.string.isRequired,
  severity: PropTypes.string.isRequired,
  province: PropTypes.shape({ nombre: PropTypes.string }),
  municipality: PropTypes.shape({ nombre: PropTypes.string }),
  affectedZone: PropTypes.string.isRequired,
  occurredAt: PropTypes.string.isRequired,
  estimatedAffectedPeople: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  contactName: PropTypes.string.isRequired,
  contactPhone: PropTypes.string.isRequired,
});
