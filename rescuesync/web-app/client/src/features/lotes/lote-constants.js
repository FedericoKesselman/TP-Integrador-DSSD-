// Categorías de recursos humanitarios y sus items predefinidos.
// El coordinador selecciona categorías y dentro elige qué recursos necesita.

export const RESOURCE_CATEGORIES = [
  {
    id: 'salud',
    label: 'Salud y Primeros Auxilios',
    shortLabel: 'Salud',
    icon: 'Heart',
    color: '#dc2626',
    colorSoft: '#fef2f2',
    colorRing: '#fecaca',
    resources: [
      { id: 'paramedicos', label: 'Paramédicos', unit: 'personas', defaultQty: 5 },
      { id: 'medicos', label: 'Médicos de emergencia', unit: 'personas', defaultQty: 3 },
      { id: 'ambulancias', label: 'Ambulancias equipadas', unit: 'vehículos', defaultQty: 2 },
      { id: 'kits-primeros-auxilios', label: 'Kits de primeros auxilios', unit: 'kits', defaultQty: 20 },
      { id: 'medicamentos', label: 'Medicamentos básicos', unit: 'lotes', defaultQty: 10 },
      { id: 'camillas', label: 'Camillas y sillas de ruedas', unit: 'unidades', defaultQty: 8 },
    ],
  },
  {
    id: 'alimentos',
    label: 'Alimentos y Agua',
    shortLabel: 'Alimentos',
    icon: 'UtensilsCrossed',
    color: '#d97706',
    colorSoft: '#fffbeb',
    colorRing: '#fde68a',
    resources: [
      { id: 'raciones', label: 'Raciones de comida seca', unit: 'raciones', defaultQty: 500 },
      { id: 'modulos-familiares', label: 'Módulos alimentarios familiares', unit: 'módulos', defaultQty: 100 },
      { id: 'agua-potable', label: 'Agua potable envasada', unit: 'litros', defaultQty: 2000 },
      { id: 'leche-formula', label: 'Leche en polvo / fórmula', unit: 'kg', defaultQty: 50 },
      { id: 'cocina-campo', label: 'Cocinas de campaña', unit: 'unidades', defaultQty: 3 },
    ],
  },
  {
    id: 'refugio',
    label: 'Refugio y Abrigo',
    shortLabel: 'Refugio',
    icon: 'Tent',
    color: '#7c3aed',
    colorSoft: '#f5f3ff',
    colorRing: '#ddd6fe',
    resources: [
      { id: 'carpas', label: 'Carpas familiares (4-6 personas)', unit: 'unidades', defaultQty: 30 },
      { id: 'colchones', label: 'Colchones', unit: 'unidades', defaultQty: 100 },
      { id: 'frazadas', label: 'Frazadas térmicas', unit: 'unidades', defaultQty: 200 },
      { id: 'lonas', label: 'Lonas impermeables', unit: 'unidades', defaultQty: 40 },
      { id: 'kits-higiene', label: 'Kits de higiene personal', unit: 'kits', defaultQty: 150 },
    ],
  },
  {
    id: 'rescate',
    label: 'Rescate y Seguridad',
    shortLabel: 'Rescate',
    icon: 'Shield',
    color: '#0284c7',
    colorSoft: '#f0f9ff',
    colorRing: '#bae6fd',
    resources: [
      { id: 'bomberos', label: 'Bomberos / Brigadistas', unit: 'personas', defaultQty: 15 },
      { id: 'rescatistas', label: 'Rescatistas especializados', unit: 'personas', defaultQty: 10 },
      { id: 'botes', label: 'Botes de rescate', unit: 'unidades', defaultQty: 4 },
      { id: 'motobombas', label: 'Motobombas de achique', unit: 'unidades', defaultQty: 3 },
      { id: 'chalecos', label: 'Chalecos salvavidas', unit: 'unidades', defaultQty: 30 },
      { id: 'cisterna', label: 'Camiones cisterna de agua', unit: 'vehículos', defaultQty: 2 },
    ],
  },
  {
    id: 'logistica',
    label: 'Logística y Equipamiento',
    shortLabel: 'Logística',
    icon: 'Truck',
    color: '#059669',
    colorSoft: '#ecfdf5',
    colorRing: '#a7f3d0',
    resources: [
      { id: 'generadores', label: 'Generadores eléctricos', unit: 'unidades', defaultQty: 4 },
      { id: 'camiones', label: 'Camiones de transporte', unit: 'vehículos', defaultQty: 3 },
      { id: 'combustible', label: 'Combustible', unit: 'litros', defaultQty: 500 },
      { id: 'radios', label: 'Radios de comunicación', unit: 'unidades', defaultQty: 10 },
      { id: 'iluminacion', label: 'Torres de iluminación', unit: 'unidades', defaultQty: 4 },
      { id: 'herramientas', label: 'Herramientas de trabajo', unit: 'kits', defaultQty: 8 },
    ],
  },
];

// Qué categorías se sugieren destacar primero según el tipo de catástrofe
export const SUGGESTED_CATEGORIES_BY_TYPE = {
  inundacion: ['rescate', 'alimentos', 'refugio', 'salud', 'logistica'],
  incendio: ['rescate', 'salud', 'alimentos', 'logistica', 'refugio'],
  terremoto: ['rescate', 'refugio', 'salud', 'alimentos', 'logistica'],
  otro: ['salud', 'alimentos', 'refugio', 'rescate', 'logistica'],
};

export const COMMON_UNITS = [
  'unidades',
  'personas',
  'raciones',
  'litros',
  'kits',
  'vehículos',
  'kg',
  'módulos',
  'lotes',
];
