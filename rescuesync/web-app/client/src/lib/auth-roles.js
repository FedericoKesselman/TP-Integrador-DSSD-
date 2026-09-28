export const ROLES = Object.freeze({
  OPERADOR_MUNICIPAL: 'operador_municipal',
  COORDINADOR_REGIONAL: 'coordinador_regional',
  REPRESENTANTE_ONG: 'representante_ong',
  AUDITOR: 'auditor',
});

const ROLE_LABELS = Object.freeze({
  [ROLES.OPERADOR_MUNICIPAL]: 'Operador Municipal',
  [ROLES.COORDINADOR_REGIONAL]: 'Centro Coordinador',
  [ROLES.REPRESENTANTE_ONG]: 'Representante ONG',
  [ROLES.AUDITOR]: 'Dirección / Auditor',
});

/**
 * Deduce el rol del usuario a partir del objeto user o de su username.
 * Compatible con la organización de Bonita (ver bonita/README.md).
 */
export function resolveUserRole(userOrUsername) {
  if (!userOrUsername) return null;

  if (typeof userOrUsername === 'object' && userOrUsername.role) {
    return userOrUsername.role;
  }

  const rawUsername =
    typeof userOrUsername === 'string'
      ? userOrUsername
      : userOrUsername.username || '';

  const normalized = rawUsername.trim().toLowerCase();

  if (
    normalized.startsWith('operador') ||
    normalized.includes('municip') ||
    normalized.includes('la-plata')
  ) {
    return ROLES.OPERADOR_MUNICIPAL;
  }

  if (
    normalized.startsWith('coordinador') ||
    normalized.includes('centro') ||
    normalized.includes('regional')
  ) {
    return ROLES.COORDINADOR_REGIONAL;
  }

  if (
    normalized.includes('ong') ||
    normalized.includes('rescatistas') ||
    normalized.includes('solidarias')
  ) {
    return ROLES.REPRESENTANTE_ONG;
  }

  if (
    normalized.includes('direccion') ||
    normalized.includes('dirección') ||
    normalized.includes('auditor')
  ) {
    return ROLES.AUDITOR;
  }

  return ROLES.COORDINADOR_REGIONAL;
}

export function isMunicipalOperator(userOrUsername) {
  return resolveUserRole(userOrUsername) === ROLES.OPERADOR_MUNICIPAL;
}

export function getRoleLabel(userOrUsername) {
  const role = resolveUserRole(userOrUsername);
  return ROLE_LABELS[role] || 'Usuario';
}
