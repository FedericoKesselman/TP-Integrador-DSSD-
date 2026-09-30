export const ROLES = Object.freeze({
  OPERADOR_MUNICIPAL: 'operador_municipal',
  COORDINADOR_REGIONAL: 'coordinador_regional',
  REPRESENTANTE_ONG: 'representante_ong',
  AUDITOR: 'auditor',
}); // Freeze para poder referenciar de manera fija a los roles y cambiarlos más fácilmente en caso de ser necesario, una especie de diccionario para el código

const ROLE_LABELS = Object.freeze({
  [ROLES.OPERADOR_MUNICIPAL]: 'Operador Municipal',
  [ROLES.COORDINADOR_REGIONAL]: 'Centro Coordinador',
  [ROLES.REPRESENTANTE_ONG]: 'Representante ONG',
  [ROLES.AUDITOR]: 'Dirección / Auditor',
}); // Muy similar al otro freeze, pero los labes son utilizados para mostrar los nombres de los roles de manera más "linda" en el front

// El rol lo manda el server (sale de la organización de Bonita): el cliente no lo calcula ni lo deduce en base al nombre de usuaio
export function isMunicipalOperator(user) {
  return user?.role === ROLES.OPERADOR_MUNICIPAL;
}

export function isRegionalCoordinator(user) {
  return user?.role === ROLES.COORDINADOR_REGIONAL;
}

// Devuelve el nombre de rol de un usuario, en base al direccionaio ROLE_LABELS
export function getRoleLabel(user) {
  return ROLE_LABELS[user?.role] || 'Usuario';
}
