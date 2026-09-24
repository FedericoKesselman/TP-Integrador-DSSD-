// Reglas y constantes de validación del dominio "emergencias", compartidas
// entre web-app/client y web-app/server para que no se dupliquen (ver
// CLAUDE.md, sección "Evitar código duplicado entre client y server").
// Fuente de la forma del payload: ../../docs/api-contracts.md.
//
// Estas funciones validan el PAYLOAD que viaja por la red
// (POST /api/emergencies), no el estado interno del formulario del
// cliente. El formulario tiene su propia forma de datos (objetos de
// provincia/municipio, inputs de texto para lat/lon, datetime-local) y
// vive en client/src/features/emergencies/validate-emergency.js, que
// reutiliza los helpers y constantes de este archivo para no repetir los
// números mágicos ni los patrones.

export const EMERGENCY_TYPE_VALUES = ['inundacion', 'incendio', 'terremoto', 'otro'];
export const SEVERITY_VALUES = ['baja', 'media', 'alta', 'critica'];
export const EMERGENCY_STATUS_VALUES = [
  'registrada',
  'convocatoria_abierta',
  'convocatoria_cerrada',
];
export const OFERTA_STATUS_VALUES = ['registrada', 'retirada'];

export const AFFECTED_ZONE_MIN_LENGTH = 3;
export const AFFECTED_ZONE_MAX_LENGTH = 200;
export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const LATITUDE_LIMIT = 90;
export const LONGITUDE_LIMIT = 180;
export const PHONE_PATTERN = /^\+?[\d\s()-]{6,20}$/;

export function isBlank(value) {
  return String(value ?? '').trim() === '';
}

// Mensaje de largo inválido, o undefined si el valor entra en el rango.
export function lengthError(value, min, max, subject) {
  const { length } = String(value ?? '').trim();
  if (length < min) return `${subject} tiene que tener al menos ${min} caracteres.`;
  if (length > max) return `${subject} tiene que tener como máximo ${max} caracteres.`;
  return undefined;
}

// Mensaje de coordenada inválida, o undefined si es null/undefined (opcional)
// o está en rango.
export function coordinateError(value, limit, subject) {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  if (Number.isNaN(number) || number < -limit || number > limit) {
    return `${subject} tiene que ser un número entre -${limit} y ${limit}.`;
  }
  return undefined;
}

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

// Valida el payload de POST /api/emergencies (ver docs/api-contracts.md).
// Devuelve un objeto { campo: mensaje } solo con los campos inválidos.
export function validateEmergencyPayload(payload, { now = new Date() } = {}) {
  const p = payload ?? {};
  const errors = {};

  if (!EMERGENCY_TYPE_VALUES.includes(p.type)) {
    errors.type = 'Elegí el tipo de emergencia.';
  }
  if (p.type === 'otro' && isBlank(p.typeOther)) {
    errors.typeOther = 'Contá qué tipo de emergencia es.';
  }
  if (!SEVERITY_VALUES.includes(p.severity)) {
    errors.severity = 'Elegí el nivel de gravedad.';
  }

  if (isBlank(p.provinceId)) errors.provinceId = 'Falta el id de la provincia.';
  if (isBlank(p.province)) errors.province = 'Falta el nombre de la provincia.';
  if (isBlank(p.municipality)) errors.municipality = 'Falta el nombre del municipio.';

  if (isBlank(p.affectedZone)) {
    errors.affectedZone = 'Describí la zona afectada.';
  } else {
    errors.affectedZone = lengthError(
      p.affectedZone,
      AFFECTED_ZONE_MIN_LENGTH,
      AFFECTED_ZONE_MAX_LENGTH,
      'La zona afectada',
    );
  }

  errors.latitude = coordinateError(p.latitude, LATITUDE_LIMIT, 'La latitud');
  errors.longitude = coordinateError(p.longitude, LONGITUDE_LIMIT, 'La longitud');
  if (isEmpty(p.latitude) !== isEmpty(p.longitude)) {
    const missing = isEmpty(p.latitude) ? 'latitude' : 'longitude';
    errors[missing] = 'Completá latitud y longitud, o dejá las dos vacías.';
  }

  if (isBlank(p.occurredAt)) {
    errors.occurredAt = 'Indicá cuándo empezó el evento.';
  } else {
    const occurredAt = new Date(p.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      errors.occurredAt = 'La fecha de inicio no es válida.';
    } else if (occurredAt > now) {
      errors.occurredAt = 'El inicio del evento no puede ser una fecha futura.';
    }
  }

  if (!isEmpty(p.estimatedAffectedPeople)) {
    const people = Number(p.estimatedAffectedPeople);
    if (!Number.isInteger(people) || people < 0) {
      errors.estimatedAffectedPeople = 'Las personas afectadas tienen que ser un número entero.';
    }
  }

  if (isBlank(p.description)) {
    errors.description = 'Agregá una descripción inicial.';
  } else {
    errors.description = lengthError(
      p.description,
      DESCRIPTION_MIN_LENGTH,
      DESCRIPTION_MAX_LENGTH,
      'La descripción',
    );
  }

  if (isBlank(p.contactName)) errors.contactName = 'Ingresá el nombre del responsable.';
  if (isBlank(p.contactPhone)) {
    errors.contactPhone = 'Ingresá un teléfono de contacto.';
  } else if (!PHONE_PATTERN.test(String(p.contactPhone).trim())) {
    errors.contactPhone = 'El teléfono solo puede tener números, espacios, guiones y paréntesis.';
  }

  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}
