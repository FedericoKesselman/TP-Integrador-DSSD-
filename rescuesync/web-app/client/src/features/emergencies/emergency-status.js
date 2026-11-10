import { EMERGENCY_STATES } from '../../../../shared/workflow.js';
import { ROLES } from '../../lib/auth-roles.js';

// Copy de UI de cada estado de una emergencia. El *conjunto* y el orden de los
// estados salen de web-app/shared/workflow.js (fuente única); acá solo se define
// cómo se ve cada uno. Si se agrega un estado allá y falta acá, getStatusCopy()
// lo muestra con el valor crudo para que se note en la UI.
const STATUS_COPY = {
  registrada: { label: 'Por desglosar', shortLabel: 'Registrada', tone: 'amber' },
  convocatoria_abierta: {
    label: 'Convocatoria abierta',
    shortLabel: 'Convocatoria',
    tone: 'green',
  },
  convocatoria_cerrada: { label: 'Validando ofertas', shortLabel: 'Validación', tone: 'blue' },
  validada: { label: 'Ofertas validadas', shortLabel: 'Validada', tone: 'indigo' },
  adjudicada: { label: 'Adjudicada', shortLabel: 'Adjudicada', tone: 'violet' },
  en_ejecucion: { label: 'En ejecución', shortLabel: 'Ejecución', tone: 'cyan' },
  finalizada: { label: 'Finalizada', shortLabel: 'Finalizada', tone: 'slate' },
};

// Clases de Tailwind por tono (listadas completas para que Tailwind las detecte).
export const STATUS_TONES = {
  amber: { badge: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  green: { badge: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20', dot: 'bg-emerald-500' },
  blue: { badge: 'bg-sky-50 text-sky-800 ring-sky-600/20', dot: 'bg-sky-500' },
  indigo: { badge: 'bg-indigo-50 text-indigo-800 ring-indigo-600/20', dot: 'bg-indigo-500' },
  violet: { badge: 'bg-violet-50 text-violet-800 ring-violet-600/20', dot: 'bg-violet-500' },
  cyan: { badge: 'bg-cyan-50 text-cyan-800 ring-cyan-600/20', dot: 'bg-cyan-500' },
  slate: { badge: 'bg-slate-100 text-slate-700 ring-slate-500/20', dot: 'bg-slate-500' },
};

export function getStatusCopy(status) {
  return STATUS_COPY[status] ?? { label: status, shortLabel: status, tone: 'slate' };
}

// Los estados en orden de ciclo, con su copy (alimenta el stepper y los filtros).
export const STATUS_FLOW = EMERGENCY_STATES.map((value) => ({ value, ...getStatusCopy(value) }));

// Qué está pasando en cada estado, dicho para cada rol. Es lo que se muestra
// cuando el rol no tiene una acción disponible en esa pantalla.
const HINTS_BY_ROLE = {
  [ROLES.OPERADOR_MUNICIPAL]: {
    registrada: 'Esperando que el centro coordinador arme los lotes.',
    convocatoria_abierta: 'Las ONGs están cargando sus ofertas.',
    convocatoria_cerrada: 'La convocatoria cerró y se están validando las ofertas.',
    validada: 'Hay ofertas validadas para adjudicar.',
    adjudicada: 'Ofertas adjudicadas; la ejecución está por comenzar.',
    en_ejecucion: 'Las ONGs están ejecutando la actividad.',
    finalizada: 'Ciclo completo.',
  },
  [ROLES.COORDINADOR_REGIONAL]: {
    convocatoria_abierta: 'Las ONGs están cargando sus ofertas.',
    convocatoria_cerrada: 'La convocatoria cerró y se están validando las ofertas.',
    validada: 'Hay ofertas validadas: falta decidir cómo continuar.',
    adjudicada: 'Ofertas adjudicadas; la ejecución está por comenzar.',
    en_ejecucion: 'En ejecución: confirmá el cierre cuando todas las ONGs terminen.',
    finalizada: 'Ciclo completo.',
  },
  [ROLES.REPRESENTANTE_ONG]: {
    registrada: 'Todavía no hay una convocatoria abierta.',
    convocatoria_cerrada: 'La convocatoria cerró y las ofertas se están validando.',
    validada: 'Ofertas validadas; el municipio está por adjudicar.',
    adjudicada: 'Ofertas adjudicadas: revisá tus avisos.',
    en_ejecucion: 'En ejecución: marcá tu actividad como finalizada al terminar.',
    finalizada: 'Ciclo completo.',
  },
  [ROLES.AUDITOR]: {
    registrada: 'Emergencia registrada, sin convocatoria todavía.',
    convocatoria_abierta: 'Convocatoria abierta a ONGs.',
    convocatoria_cerrada: 'Ofertas en validación.',
    validada: 'Ofertas validadas, pendientes de adjudicación.',
    adjudicada: 'Ofertas adjudicadas.',
    en_ejecucion: 'En ejecución.',
    finalizada: 'Ciclo completo.',
  },
};

// Pantalla del ciclo a la que lleva la tarjeta según el estado y el rol (los botones de
// lotes y de oferta, que ya existían, se resuelven aparte en EmergenciesListPage).
// Devuelve { to, label } o null.
export function getCicloAction(emergency, user) {
  const { id, status } = emergency;
  const role = user?.role;

  if (role === ROLES.COORDINADOR_REGIONAL) {
    if (status === 'validada')
      return { to: `/emergencias/${id}/ofertas`, label: 'Ver ofertas y decidir' };
    if (status === 'en_ejecucion') {
      return { to: `/emergencias/${id}/ofertas`, label: 'Ver ejecución y cerrar' };
    }
    if (['convocatoria_cerrada', 'adjudicada', 'finalizada'].includes(status)) {
      return { to: `/emergencias/${id}/ofertas`, label: 'Ver ofertas' };
    }
  }
  if (role === ROLES.OPERADOR_MUNICIPAL && status === 'validada') {
    return { to: `/emergencias/${id}/adjudicacion`, label: 'Adjudicar ofertas' };
  }
  if (
    role === ROLES.REPRESENTANTE_ONG &&
    ['adjudicada', 'en_ejecucion', 'finalizada'].includes(status)
  ) {
    return { to: '/mis-ofertas', label: 'Ver mis ofertas' };
  }
  return null;
}

// Texto de ayuda para el rol del usuario, o null si no hay nada que decir.
export function getRoleHint(status, user) {
  return HINTS_BY_ROLE[user?.role]?.[status] ?? null;
}
