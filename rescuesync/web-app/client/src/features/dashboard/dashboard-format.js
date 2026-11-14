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
  total: 'Total (solo casos terminados)',
};

// Mismos valores que los tokens de index.css (los gráficos no leen CSS variables).
export const TYPE_COLORS = {
  inundacion: '#0072bb', // brand
  incendio: '#e65100', // sev-alta
  terremoto: '#a86b00', // sev-media
  otro: '#64748b', // ink-muted
};

export const BRAND_COLOR = '#0072bb';
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

// Color fijo por categoría de recurso (sin rojo puro: queda para errores/severidad).
export const CATEGORY_COLORS = {
  salud: '#be185d', // magenta
  alimentos: '#d97706', // ámbar
  refugio: '#7c3aed', // violeta
  rescate: '#0072bb', // brand
  logistica: '#059669', // verde
};
const OTHER_CATEGORY = { category: 'Otros', color: '#64748b' };

const RESOURCES = new Map(
  RESOURCE_CATEGORIES.flatMap((category) =>
    category.resources.map((resource) => ({ category, resource })),
  ).map(({ category, resource }, index) => [
    resource.id,
    {
      label: resource.label,
      unit: resource.unit,
      orden: index,
      category: category.label,
      color: CATEGORY_COLORS[category.id] ?? OTHER_CATEGORY.color,
    },
  ]),
);

export function getResourceInfo(code) {
  return RESOURCES.get(code) ?? { label: code, unit: '', orden: Infinity, ...OTHER_CATEGORY };
}

const numberFormat = new Intl.NumberFormat('es-AR');

// 1800, 'litros' -> '1.800 litros' (sin unidad: solo el número)
export function formatQuantity(value, unit = '') {
  return `${numberFormat.format(value)} ${unit}`.trim();
}

const percentFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

// 66.7 -> '66,7 %'
export function formatPercent(value) {
  return `${percentFormat.format(value)} %`;
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
