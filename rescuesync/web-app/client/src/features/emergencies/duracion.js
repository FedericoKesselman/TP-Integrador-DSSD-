import { CONVOCATORIA_DURACION, validateDuracionMinutos } from '../../../../shared/workflow.js';

// Duración de la ventana de ofertas: el valor (texto de un <input>) se valida con
// la misma regla que el backend (web-app/shared/workflow.js).

export const DURACION_DEFAULT = String(CONVOCATORIA_DURACION.defaultMin);

export function parseDuracion(text) {
  return String(text).trim() === '' ? Number.NaN : Number(text);
}

// Mensaje de error o null.
export function getDuracionError(text) {
  return validateDuracionMinutos(parseDuracion(text));
}

// 2 → "2 min", 90 → "1 h 30 min", 1440 → "1 día".
export function formatDuracion(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0) return '';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [];
  if (days) parts.push(days === 1 ? '1 día' : `${days} días`);
  if (hours) parts.push(`${hours} h`);
  if (mins || parts.length === 0) parts.push(`${mins} min`);
  return parts.join(' ');
}

export const DURACION_PRESETS = [
  { minutes: 2, label: '2 min (demo)' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: CONVOCATORIA_DURACION.defaultMin, label: '2 h (sugerido)' },
  { minutes: 1440, label: '1 día' },
];

export { CONVOCATORIA_DURACION };
