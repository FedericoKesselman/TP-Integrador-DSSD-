import { getStatusCopy } from '../emergencies/emergency-status.js';
import { RESOURCE_CATEGORIES } from '../lotes/lote-constants.js';

// 42 min · 3 h 23 min · 2 d 4 h
export function formatMinutes(value) {
  if (value === null || value === undefined) return '—';
  const total = Math.round(value);
  if (total < 60) return `${total} min`;
  if (total < 1440) {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  const days = Math.floor(total / 1440);
  const hours = Math.round((total % 1440) / 60);
  return hours ? `${days} d ${hours} h` : `${days} d`;
}

export const ETAPA_LABELS = {
  registro_publicacion: 'Registro → publicación',
  ventana_ofertas: 'Ventana de ofertas',
  validacion_adjudicacion: 'Validación → adjudicación',
  ejecucion: 'Ejecución',
  total: 'Total',
};

// Mismos valores que los tokens de index.css (los gráficos no leen CSS variables).
export const TYPE_COLORS = {
  inundacion: '#0072bb', // brand
  incendio: '#e65100', // sev-alta
  terremoto: '#a86b00', // sev-media
  otro: '#64748b', // ink-muted
};

export const CHART_INK_MUTED = '#64748b';
export const CHART_LINE = '#e2e8f0';

// Hex de los tonos de STATUS_TONES (clases de Tailwind, que un gráfico no puede usar).
const TONE_HEX = {
  amber: '#f59e0b',
  green: '#10b981',
  blue: '#0ea5e9',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  slate: '#64748b',
};

export function getStatusColor(status) {
  return TONE_HEX[getStatusCopy(status).tone];
}

const RESOURCES = new Map(
  RESOURCE_CATEGORIES.flatMap((category) =>
    category.resources.map((resource, index) => [
      resource.id,
      {
        label: resource.label,
        unit: resource.unit,
        // Color de la categoría; dentro de ella baja la opacidad para distinguir recursos.
        color: category.color,
        opacity: Math.max(0.45, 1 - index * 0.14),
      },
    ]),
  ),
);

export function getResourceInfo(code) {
  return RESOURCES.get(code) ?? { label: code, unit: '', color: CHART_INK_MUTED, opacity: 1 };
}

const monthFormat = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' });

// '2026-11' -> 'nov 2026'
export function formatMonth(mes) {
  const [year, month] = mes.split('-').map(Number);
  return monthFormat.format(new Date(year, month - 1, 1)).replace('.', '');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
