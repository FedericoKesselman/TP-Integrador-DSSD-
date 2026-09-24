import { toLocalInputValue } from '../../lib/dates.js';

// Enums del dominio de emergencias. Contrato documentado en rescuesync/docs/api-contracts.md;
// si cambia algún valor, actualizar también ese documento.

export const EMERGENCY_TYPES = [
  { value: 'inundacion', label: 'Inundación' },
  { value: 'incendio', label: 'Incendio' },
  { value: 'terremoto', label: 'Terremoto' },
  { value: 'otro', label: 'Otro' },
];

export const SEVERITY_LEVELS = [
  {
    value: 'baja',
    label: 'Baja',
    description: 'Daños menores, sin riesgo para las personas',
    color: 'var(--color-sev-baja)',
  },
  {
    value: 'media',
    label: 'Media',
    description: 'Afecta viviendas o servicios básicos',
    color: 'var(--color-sev-media)',
  },
  {
    value: 'alta',
    label: 'Alta',
    description: 'Hay personas heridas o evacuadas',
    color: 'var(--color-sev-alta)',
  },
  {
    value: 'critica',
    label: 'Crítica',
    description: 'Riesgo de vida inminente',
    color: 'var(--color-sev-critica)',
  },
];

// Ids de Georef (códigos INDEC). El centroide de Tierra del Fuego se ajustó a la Isla Grande:
// el de Georef incluye la Antártida y cae a -82° de latitud.
export const CABA_ID = '02';
export const PROVINCES = [
  { id: '06', nombre: 'Buenos Aires', centroide: { lat: -36.6774, lon: -60.5585 } },
  { id: '10', nombre: 'Catamarca', centroide: { lat: -27.336, lon: -66.9479 } },
  { id: '22', nombre: 'Chaco', centroide: { lat: -26.387, lon: -60.7651 } },
  { id: '26', nombre: 'Chubut', centroide: { lat: -43.7886, lon: -68.5267 } },
  {
    id: CABA_ID,
    nombre: 'Ciudad Autónoma de Buenos Aires',
    centroide: { lat: -34.6144, lon: -58.4459 },
  },
  { id: '14', nombre: 'Córdoba', centroide: { lat: -32.1448, lon: -63.802 } },
  { id: '18', nombre: 'Corrientes', centroide: { lat: -28.7742, lon: -57.8011 } },
  { id: '30', nombre: 'Entre Ríos', centroide: { lat: -32.0589, lon: -59.2013 } },
  { id: '34', nombre: 'Formosa', centroide: { lat: -24.8951, lon: -59.9322 } },
  { id: '38', nombre: 'Jujuy', centroide: { lat: -23.32, lon: -65.7644 } },
  { id: '42', nombre: 'La Pampa', centroide: { lat: -37.1351, lon: -65.4476 } },
  { id: '46', nombre: 'La Rioja', centroide: { lat: -29.6849, lon: -67.1818 } },
  { id: '50', nombre: 'Mendoza', centroide: { lat: -34.6304, lon: -68.5829 } },
  { id: '54', nombre: 'Misiones', centroide: { lat: -26.8753, lon: -54.6516 } },
  { id: '58', nombre: 'Neuquén', centroide: { lat: -38.642, lon: -70.1199 } },
  { id: '62', nombre: 'Río Negro', centroide: { lat: -40.4051, lon: -67.2297 } },
  { id: '66', nombre: 'Salta', centroide: { lat: -24.2993, lon: -64.8142 } },
  { id: '70', nombre: 'San Juan', centroide: { lat: -30.8657, lon: -68.8882 } },
  { id: '74', nombre: 'San Luis', centroide: { lat: -33.7611, lon: -66.0252 } },
  { id: '78', nombre: 'Santa Cruz', centroide: { lat: -48.8155, lon: -69.9558 } },
  { id: '82', nombre: 'Santa Fe', centroide: { lat: -30.7088, lon: -60.9507 } },
  { id: '86', nombre: 'Santiago del Estero', centroide: { lat: -27.7834, lon: -63.2526 } },
  {
    id: '94',
    nombre: 'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
    centroide: { lat: -54.35, lon: -67.65 },
  },
  { id: '90', nombre: 'Tucumán', centroide: { lat: -26.9483, lon: -65.3648 } },
];

export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 2000;

// Secciones del formulario y sus campos obligatorios (typeOther solo si el tipo es "otro").
export const FORM_SECTIONS = [
  { id: 'seccion-tipo', title: 'Tipo y gravedad', fields: ['type', 'typeOther', 'severity'] },
  {
    id: 'seccion-ubicacion',
    title: 'Ubicación',
    fields: ['province', 'municipality', 'affectedZone'],
  },
  { id: 'seccion-detalle', title: 'Detalle', fields: ['occurredAt', 'description'] },
  { id: 'seccion-contacto', title: 'Contacto', fields: ['contactName', 'contactPhone'] },
];

export function createEmptyEmergency(now = new Date()) {
  return {
    type: '',
    typeOther: '',
    severity: '',
    province: null,
    municipality: null,
    affectedZone: '',
    latitude: '',
    longitude: '',
    occurredAt: toLocalInputValue(now),
    estimatedAffectedPeople: '',
    description: '',
    contactName: '',
    contactPhone: '',
  };
}
