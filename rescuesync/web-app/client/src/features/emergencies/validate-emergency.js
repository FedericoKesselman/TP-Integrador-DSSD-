import {
  CABA_ID,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  EMERGENCY_TYPES,
  FORM_SECTIONS,
  SEVERITY_LEVELS,
} from './emergency-constants.js';

const PHONE_PATTERN = /^\+?[\d\s()-]{6,20}$/;

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

// Los mensajes nombran el campo porque también se listan en el resumen de errores.
function lengthError(value, min, max, subject) {
  const { length } = value.trim();
  if (length < min) return `${subject} tiene que tener al menos ${min} caracteres.`;
  if (length > max) return `${subject} tiene que tener como máximo ${max} caracteres.`;
  return undefined;
}

function coordinateError(value, limit, subject) {
  if (isBlank(value)) return undefined;
  const number = Number(value);
  if (Number.isNaN(number) || number < -limit || number > limit) {
    return `${subject} tiene que ser un número entre -${limit} y ${limit}.`;
  }
  return undefined;
}

export function isFieldRequired(field, values) {
  return field !== 'typeOther' || values.type === 'otro';
}

// Devuelve un objeto { campo: mensaje } solo con los campos inválidos, en el orden del formulario.
export function validateEmergency(values, now = new Date()) {
  const errors = {};

  if (!EMERGENCY_TYPES.some((type) => type.value === values.type)) {
    errors.type = 'Elegí el tipo de emergencia.';
  }
  if (values.type === 'otro' && isBlank(values.typeOther)) {
    errors.typeOther = 'Contá qué tipo de emergencia es.';
  }
  if (!SEVERITY_LEVELS.some((level) => level.value === values.severity)) {
    errors.severity = 'Elegí el nivel de gravedad.';
  }

  if (!values.province) errors.province = 'Elegí la provincia.';
  if (!values.municipality || isBlank(values.municipality.nombre)) {
    errors.municipality =
      values.province?.id === CABA_ID ? 'Elegí la comuna.' : 'Elegí el municipio.';
  }
  if (isBlank(values.affectedZone)) {
    errors.affectedZone = 'Describí la zona afectada.';
  } else {
    errors.affectedZone = lengthError(values.affectedZone, 3, 200, 'La zona afectada');
  }
  errors.latitude = coordinateError(values.latitude, 90, 'La latitud');
  errors.longitude = coordinateError(values.longitude, 180, 'La longitud');
  if (isBlank(values.latitude) !== isBlank(values.longitude)) {
    const missing = isBlank(values.latitude) ? 'latitude' : 'longitude';
    errors[missing] = 'Completá latitud y longitud, o dejá las dos vacías.';
  }

  if (isBlank(values.occurredAt)) {
    errors.occurredAt = 'Indicá cuándo empezó el evento.';
  } else if (new Date(values.occurredAt) > now) {
    errors.occurredAt = 'El inicio del evento no puede ser una fecha futura.';
  }
  if (!isBlank(values.estimatedAffectedPeople)) {
    const people = Number(values.estimatedAffectedPeople);
    if (!Number.isInteger(people) || people < 0) {
      errors.estimatedAffectedPeople = 'Las personas afectadas tienen que ser un número entero.';
    }
  }
  if (isBlank(values.description)) {
    errors.description = 'Agregá una descripción inicial.';
  } else {
    errors.description = lengthError(
      values.description,
      DESCRIPTION_MIN_LENGTH,
      DESCRIPTION_MAX_LENGTH,
      'La descripción',
    );
  }

  if (isBlank(values.contactName)) errors.contactName = 'Ingresá el nombre del responsable.';
  if (isBlank(values.contactPhone)) {
    errors.contactPhone = 'Ingresá un teléfono de contacto.';
  } else if (!PHONE_PATTERN.test(values.contactPhone.trim())) {
    errors.contactPhone = 'El teléfono solo puede tener números, espacios, guiones y paréntesis.';
  }

  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

// Avance por sección: cuántos campos obligatorios ya son válidos.
export function getSectionProgress(values, errors) {
  return FORM_SECTIONS.map((section) => {
    const required = section.fields.filter((field) => isFieldRequired(field, values));
    const done = required.filter((field) => !errors[field]).length;
    return { ...section, done, total: required.length, complete: done === required.length };
  });
}

// Convierte los valores del formulario al payload que espera la API.
export function toEmergencyPayload(values) {
  const optionalNumber = (value) => (isBlank(value) ? null : Number(value));

  return {
    type: values.type,
    typeOther: values.type === 'otro' ? values.typeOther.trim() : null,
    severity: values.severity,
    provinceId: values.province.id,
    province: values.province.nombre,
    municipalityId: values.municipality.id,
    municipality: values.municipality.nombre.trim(),
    affectedZone: values.affectedZone.trim(),
    latitude: optionalNumber(values.latitude),
    longitude: optionalNumber(values.longitude),
    occurredAt: new Date(values.occurredAt).toISOString(),
    estimatedAffectedPeople: optionalNumber(values.estimatedAffectedPeople),
    description: values.description.trim(),
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
  };
}
