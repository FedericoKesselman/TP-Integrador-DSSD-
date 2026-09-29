/**
 * Motor de Cálculo Humanitario Dinámico (RescueSync)
 * Basado en las directrices técnicas del Proyecto Esfera (Normas Mínimas de Respuesta Humanitaria),
 * Cascos Blancos y Cruz Roja Internacional.
 */

// Variable de entorno para habilitar/deshabilitar el cálculo per cápita (Normas Esfera).
// Si está en 'false' o no está seteada, la pantalla opera en el modo clásico estándar.
export const IS_HUMANITARIAN_CALC_ENABLED =
  import.meta.env.VITE_ENABLE_HUMANITARIAN_CALC === 'true' ||
  import.meta.env.VITE_ENABLE_CALCULO_HUMANITARIO === 'true';

// Multiplicador de contingencia y reserva operativa según nivel de gravedad
export const SEVERITY_FACTORS = Object.freeze({
  baja: 0.8,
  media: 1.0,
  alta: 1.3,
  critica: 1.8,
});

/**
 * Opciones rápidas clásicas estáticas (cuando el modo per cápita está desactivado)
 */
export function getClassicPresetsAndRange(res) {
  const d = res.defaultQty || 5;

  let basePresets = [1, 2, 5, 10, 20];
  let baseMax = 30;
  let baseStep = 1;

  if (d <= 5) {
    basePresets = [1, 2, 3, 5, 10, 20];
    baseMax = 30;
  } else if (d <= 15) {
    basePresets = [3, 5, 10, 15, 25, 50];
    baseMax = 60;
  } else if (d <= 50) {
    basePresets = [5, 10, 20, 30, 50, 100];
    baseMax = 100;
    baseStep = 5;
  } else if (d <= 150) {
    basePresets = [25, 50, 100, 150, 250, 500];
    baseMax = 500;
    baseStep = 10;
  } else if (d <= 500) {
    basePresets = [50, 100, 250, 500, 1000, 2000];
    baseMax = 2000;
    baseStep = 25;
  } else {
    basePresets = [250, 500, 1000, 2500, 5000, 10000];
    baseMax = 10000;
    baseStep = 50;
  }

  return {
    presets: basePresets,
    min: 1,
    max: baseMax,
    step: baseStep,
    suggested: d,
    isDynamic: false,
  };
}

/**
 * Redondeo técnico para facilitar logística y empaque en emergencias:
 * - Cantidades grandes (>500) en múltiplos de 50 o 100
 * - Cantidades medianas (50..500) en múltiplos de 10 o 25
 * - Cantidades pequeñas (<50) en números enteros
 */
function roundHumanitarianQty(val) {
  if (val <= 0) return 1;
  if (val < 15) return Math.ceil(val);
  if (val < 50) return Math.ceil(val / 5) * 5;
  if (val < 200) return Math.ceil(val / 10) * 10;
  if (val < 1000) return Math.ceil(val / 25) * 25;
  if (val < 5000) return Math.ceil(val / 50) * 50;
  return Math.ceil(val / 100) * 100;
}

/**
 * Calcula la cantidad sugerida de un recurso específico en base a la población
 * damnificada, nivel de gravedad y tipo de evento.
 */
export function calculateSuggestedQuantity(resourceId, people, severity, emergencyType = 'otro') {
  const p = Math.max(1, Number(people) || 50);
  const factor = SEVERITY_FACTORS[severity] || 1.0;

  switch (resourceId) {
    // ─── ALIMENTOS Y AGUA ───
    case 'agua-potable':
      // 3 litros por persona por día de agua segura
      return roundHumanitarianQty(p * 3 * factor);

    case 'raciones':
      // 2 raciones de comida caliente/seca por persona por día
      return roundHumanitarianQty(p * 2 * factor);

    case 'modulos-familiares':
      // 1 módulo familiar semanal cada 4 personas
      return roundHumanitarianQty(Math.ceil(p / 4) * factor);

    case 'leche-formula':
      // Proporción infantil estimada (~10% de la población afectada)
      return roundHumanitarianQty(Math.max(10, Math.ceil(p * 0.12 * factor)));

    case 'cocina-campo':
      // Capacidad de 400-500 personas por unidad de campaña
      return Math.max(1, Math.ceil((p / 450) * factor));

    // ─── REFUGIO Y ABRIGO ───
    case 'colchones':
      return roundHumanitarianQty(p * 1 * factor);

    case 'frazadas':
      // Cobertura térmica 1.5 frazadas por persona en clima templado/frío
      return roundHumanitarianQty(p * 1.5 * factor);

    case 'carpas':
      // Carpas estructurales familiares para 5 personas promedio
      return Math.max(2, roundHumanitarianQty(Math.ceil(p / 5) * factor));

    case 'lonas':
      // Lonas impermeables para techos de emergencia y cerramientos
      return Math.max(5, roundHumanitarianQty(Math.ceil(p / 15) * factor));

    case 'kits-higiene':
      // 1 kit familiar cada 4 personas
      return Math.max(5, roundHumanitarianQty(Math.ceil(p / 4) * factor));

    // ─── SALUD Y PRIMEROS AUXILIOS ───
    case 'paramedicos':
      // ~1 paramédico cada 50-70 personas en zona crítica
      return Math.max(2, Math.ceil((p / 60) * factor));

    case 'medicos':
      // ~1 médico cada 150 personas
      return Math.max(1, Math.ceil((p / 150) * factor));

    case 'ambulancias':
      return Math.max(1, Math.ceil((p / 350) * factor));

    case 'kits-primeros-auxilios':
      return Math.max(5, roundHumanitarianQty(Math.ceil(p / 30) * factor));

    case 'medicamentos':
      return Math.max(2, roundHumanitarianQty(Math.ceil(p / 100) * factor));

    case 'camillas':
      return Math.max(2, Math.ceil((p / 100) * factor));

    // ─── RESCATE Y SEGURIDAD (depende del tipo de desastre) ───
    case 'bomberos':
      if (emergencyType === 'incendio') {
        return Math.max(15, roundHumanitarianQty(Math.ceil(p / 25) * factor));
      }
      return Math.max(5, Math.ceil((p / 80) * factor));

    case 'rescatistas':
      if (emergencyType === 'terremoto') {
        return Math.max(12, roundHumanitarianQty(Math.ceil(p / 30) * factor));
      }
      return Math.max(4, Math.ceil((p / 60) * factor));

    case 'botes':
      if (emergencyType === 'inundacion') {
        return Math.max(3, Math.ceil((p / 100) * factor));
      }
      return 2;

    case 'motobombas':
      if (emergencyType === 'inundacion') {
        return Math.max(3, Math.ceil((p / 120) * factor));
      }
      return 1;

    case 'chalecos':
      if (emergencyType === 'inundacion') {
        return Math.max(15, roundHumanitarianQty(Math.ceil(p / 2.5) * factor));
      }
      return 15;

    case 'cisterna':
      return Math.max(1, Math.ceil((p / 500) * factor));

    // ─── LOGÍSTICA Y EQUIPAMIENTO ───
    case 'generadores':
      return Math.max(2, Math.ceil((p / 250) * factor));

    case 'camiones':
      return Math.max(2, Math.ceil((p / 300) * factor));

    case 'combustible':
      // Litros de gasoil/nafta para maquinaria y grupos electrógenos
      return Math.max(150, roundHumanitarianQty(p * 1.8 * factor));

    case 'radios':
      return Math.max(6, Math.ceil(12 * factor));

    case 'iluminacion':
      return Math.max(2, Math.ceil((p / 300) * factor));

    case 'herramientas':
      return Math.max(4, Math.ceil((p / 180) * factor));

    default:
      return 10;
  }
}

/**
 * Genera presets rápidos adaptativos alrededor de la cantidad sugerida calculada (Q).
 * En vez de números fijos arbitrarios, ofrece múltiplos y submúltiplos coherentes.
 */
export function generateAdaptivePresets(suggestedQty) {
  const q = Math.max(1, Number(suggestedQty) || 10);

  let rawMultipliers = [0.4, 0.7, 1.0, 1.4, 2.0];
  if (q <= 5) {
    rawMultipliers = [1, 2, 3, 5, 8, 12];
  } else if (q <= 15) {
    rawMultipliers = [0.5, 0.75, 1.0, 1.5, 2.0];
  }

  const rawValues = Array.isArray(rawMultipliers) && q > 5
    ? rawMultipliers.map((m) => roundHumanitarianQty(q * m))
    : rawMultipliers;

  // Garantizar valores únicos ordenados ascendentemente
  const uniquePresets = Array.from(new Set(rawValues)).filter((v) => v >= 1).sort((a, b) => a - b);

  // Asegurar que la cantidad sugerida exacta siempre esté presente en los presets
  if (!uniquePresets.includes(q)) {
    uniquePresets.push(q);
    uniquePresets.sort((a, b) => a - b);
  }

  // Determinación de rango de slider elástico
  let step = 1;
  if (q >= 1000) step = 100;
  else if (q >= 250) step = 25;
  else if (q >= 50) step = 5;

  const max = Math.max(
    Math.ceil(q * 2.2),
    uniquePresets[uniquePresets.length - 1] * 1.2,
    50
  );

  return {
    suggested: q,
    presets: uniquePresets,
    min: 1,
    max: roundHumanitarianQty(max),
    step,
  };
}

/**
 * Recursos esenciales recomendados para auto-seleccionar según la naturaleza del evento.
 */
export const CRITICAL_RESOURCES_BY_TYPE = Object.freeze({
  inundacion: [
    { categoryId: 'rescate', resourceId: 'botes' },
    { categoryId: 'rescate', resourceId: 'motobombas' },
    { categoryId: 'rescate', resourceId: 'chalecos' },
    { categoryId: 'rescate', resourceId: 'rescatistas' },
    { categoryId: 'alimentos', resourceId: 'agua-potable' },
    { categoryId: 'alimentos', resourceId: 'raciones' },
    { categoryId: 'refugio', resourceId: 'colchones' },
    { categoryId: 'refugio', resourceId: 'frazadas' },
    { categoryId: 'refugio', resourceId: 'kits-higiene' },
    { categoryId: 'salud', resourceId: 'paramedicos' },
    { categoryId: 'salud', resourceId: 'kits-primeros-auxilios' },
    { categoryId: 'logistica', resourceId: 'generadores' },
  ],
  incendio: [
    { categoryId: 'rescate', resourceId: 'bomberos' },
    { categoryId: 'rescate', resourceId: 'cisterna' },
    { categoryId: 'rescate', resourceId: 'rescatistas' },
    { categoryId: 'salud', resourceId: 'paramedicos' },
    { categoryId: 'salud', resourceId: 'ambulancias' },
    { categoryId: 'salud', resourceId: 'kits-primeros-auxilios' },
    { categoryId: 'salud', resourceId: 'medicamentos' },
    { categoryId: 'alimentos', resourceId: 'agua-potable' },
    { categoryId: 'alimentos', resourceId: 'raciones' },
    { categoryId: 'refugio', resourceId: 'carpas' },
    { categoryId: 'refugio', resourceId: 'frazadas' },
    { categoryId: 'logistica', resourceId: 'camiones' },
  ],
  terremoto: [
    { categoryId: 'rescate', resourceId: 'rescatistas' },
    { categoryId: 'rescate', resourceId: 'bomberos' },
    { categoryId: 'salud', resourceId: 'medicos' },
    { categoryId: 'salud', resourceId: 'paramedicos' },
    { categoryId: 'salud', resourceId: 'ambulancias' },
    { categoryId: 'salud', resourceId: 'camillas' },
    { categoryId: 'refugio', resourceId: 'carpas' },
    { categoryId: 'refugio', resourceId: 'colchones' },
    { categoryId: 'refugio', resourceId: 'frazadas' },
    { categoryId: 'alimentos', resourceId: 'agua-potable' },
    { categoryId: 'alimentos', resourceId: 'modulos-familiares' },
    { categoryId: 'logistica', resourceId: 'generadores' },
    { categoryId: 'logistica', resourceId: 'herramientas' },
  ],
  otro: [
    { categoryId: 'salud', resourceId: 'paramedicos' },
    { categoryId: 'salud', resourceId: 'kits-primeros-auxilios' },
    { categoryId: 'alimentos', resourceId: 'agua-potable' },
    { categoryId: 'alimentos', resourceId: 'raciones' },
    { categoryId: 'refugio', resourceId: 'colchones' },
    { categoryId: 'refugio', resourceId: 'frazadas' },
    { categoryId: 'logistica', resourceId: 'generadores' },
  ],
});
