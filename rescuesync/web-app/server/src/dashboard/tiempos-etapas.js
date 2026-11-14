// Cálculo puro de "tiempos por etapa" (contrato: api-contracts.md, Dashboard →
// tiempos-etapas). No toca red ni base: recibe casos y tareas ya leídos de Bonita.
//
// Casos: [{ id, start, end }] (`end` null si el caso sigue abierto).
// Tareas: [{ caseId, name, date }] (`date` = cuándo quedó completada).
// Las fechas de Bonita vienen como "YYYY-MM-DD HH:mm:ss.SSS" SIN zona horaria: se
// toman como hora local del servidor de Bonita. Se leen como reloj de pared (UTC
// artificial), así que las diferencias son exactas salvo que haya un cambio de horario
// de verano entre las dos puntas.

import { EMERGENCY_TYPE_VALUES } from '../../../shared/emergency-validation.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Etapas del contrato, siempre en este orden. `total` usa inicio y fin del caso.
const ETAPAS = [
  { etapa: 'registro_publicacion', desde: 'Registrar Emergencia', hasta: 'Publicar Convocatoria' },
  {
    etapa: 'ventana_ofertas',
    desde: 'Publicar Convocatoria',
    hasta: 'Notificar Cierre de Convocatoria a ONGS',
  },
  { etapa: 'validacion_adjudicacion', desde: 'Validar Ofertas', hasta: 'Adjudicar Ofertas' },
  { etapa: 'ejecucion', desde: 'Etapa Ejecución', hasta: 'Liberar recursos' },
  { etapa: 'total', desde: null, hasta: null },
];

function toMs(bonitaDate) {
  const [y, mo, d, h = 0, mi = 0, s = 0] = bonitaDate.match(/\d+(\.\d+)?/g).map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

const round1 = (n) => Math.round(n * 10) / 10;

// Rechaza días inexistentes (2026-02-30, mes 13): la fecha tiene que sobrevivir al ida y vuelta.
function esFechaReal(value) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Valida un query param YYYY-MM-DD (fecha real). Devuelve el valor o lanza 400.
export function parseFecha(value, nombre) {
  if (value === undefined) return null;
  const ok = typeof value === 'string' && DATE_PATTERN.test(value) && esFechaReal(value);
  if (!ok) {
    const error = new Error(`"${nombre}" debe tener formato YYYY-MM-DD.`);
    error.status = 400;
    throw error;
  }
  return value;
}

export function parsePeriodo(query) {
  const desde = parseFecha(query.desde, 'desde');
  const hasta = parseFecha(query.hasta, 'hasta');
  if (desde && hasta && desde > hasta) {
    const error = new Error('"desde" no puede ser posterior a "hasta".');
    error.status = 400;
    throw error;
  }
  return { desde, hasta };
}

// Casos cuya fecha de inicio (día, hora local de Bonita) cae en [desde, hasta].
export function filtrarCasos(casos, { desde, hasta }) {
  return casos.filter((c) => {
    const dia = c.start.slice(0, 10);
    return (!desde || dia >= desde) && (!hasta || dia <= hasta);
  });
}

// Minutos entre dos fechas, o null si falta una punta o quedan al revés.
function minutos(inicio, fin) {
  if (inicio === null || fin === null || fin < inicio) return null;
  return (fin - inicio) / 60000;
}

// Las 5 etapas para un conjunto de casos; `porCaso` = caso → (tarea → fechas).
function calcularEtapas(casos, porCaso) {
  return ETAPAS.map(({ etapa, desde: nombreIni, hasta: nombreFin }) => {
    const valores = casos
      .map((c) => {
        if (!nombreIni) return c.end ? minutos(toMs(c.start), toMs(c.end)) : null;
        const nombres = porCaso.get(String(c.id));
        const ini = nombres.get(nombreIni); // primera aparición del inicio
        const fin = nombres.get(nombreFin); // última aparición del fin
        return minutos(ini ? Math.min(...ini) : null, fin ? Math.max(...fin) : null);
      })
      .filter((v) => v !== null);

    if (valores.length === 0) {
      return { etapa, casos: 0, promedioMinutos: null, minMinutos: null, maxMinutos: null };
    }
    const suma = valores.reduce((a, b) => a + b, 0);
    return {
      etapa,
      casos: valores.length,
      promedioMinutos: round1(suma / valores.length),
      minMinutos: round1(Math.min(...valores)),
      maxMinutos: round1(Math.max(...valores)),
    };
  });
}

// `tipos`: Map caseId (string) → tipo de emergencia, para el cruce `porTipo`. Los casos que
// no están en el mapa no entran en `porTipo`.
export function calcularTiemposEtapas(casos, tareas, periodo = {}, tipos = new Map()) {
  const { desde = null, hasta = null } = periodo;
  const enPeriodo = filtrarCasos(casos, { desde, hasta });

  const porCaso = new Map(enPeriodo.map((c) => [String(c.id), new Map()]));
  tareas.forEach((t) => {
    const nombres = porCaso.get(String(t.caseId));
    if (!nombres) return;
    const fechas = nombres.get(t.name) ?? [];
    fechas.push(toMs(t.date));
    nombres.set(t.name, fechas);
  });

  const porTipo = EMERGENCY_TYPE_VALUES.map((tipo) => ({
    tipo,
    casos: enPeriodo.filter((c) => tipos.get(String(c.id)) === tipo),
  }))
    .filter(({ casos: delTipo }) => delTipo.length > 0)
    .map(({ tipo, casos: delTipo }) => ({
      tipo,
      casosAnalizados: delTipo.length,
      etapas: calcularEtapas(delTipo, porCaso),
    }));

  return {
    periodo: { desde, hasta },
    casosAnalizados: enPeriodo.length,
    etapas: calcularEtapas(enPeriodo, porCaso),
    porTipo,
  };
}
