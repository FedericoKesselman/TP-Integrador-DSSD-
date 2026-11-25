// Copy de UI del perfil que devuelve el Sistema Nacional y de los estados de una oferta.

export const TONE_CLASSES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  red: 'bg-rose-50 text-rose-800 ring-rose-600/20',
  violet: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

export const NIVEL_HABILITACION = {
  PLENO: { label: 'Total', tone: 'green' },
  PARCIAL: { label: 'Parcial', tone: 'amber' },
  APOYO: { label: 'Bajo', tone: 'blue' },
  SIN_CAPACIDAD: { label: 'Sin stock', tone: 'red' },
};

// Aporte al lote (habilitado ÷ pedido), calculado en el cliente: cuánto de lo pedido cubre la oferta.
const EPS = 1e-9;
export function aporteNivel(ratio) {
  if (ratio >= 1 - EPS) return { label: 'Pleno', tone: 'green' };
  if (ratio >= 0.5 - EPS) return { label: 'Principal', tone: 'blue' };
  if (ratio > EPS) return { label: 'Apoyo', tone: 'amber' };
  return { label: 'Sin aporte', tone: 'red' };
}

export const percent = (ratio) => `${Math.round(ratio * 100)} %`;

const safeRatio = (num, den) => (den > 0 ? num / den : 0);
const average = (values) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

// Fracciones 0..1 por ítem y promedio de la oferta. `habilitadaPorLote`: Map loteId -> cantidad.
export function calcularMedidas(items, habilitadaPorLote) {
  const filas = items.map((item) => {
    const habilitado = habilitadaPorLote.get(item.loteId) ?? 0;
    return {
      respaldo: safeRatio(habilitado, item.quantityOffered),
      aporte: safeRatio(Math.min(habilitado, item.quantityRequested), item.quantityRequested),
    };
  });
  return {
    filas,
    respaldo: average(filas.map((f) => f.respaldo)),
    aporte: average(filas.map((f) => f.aporte)),
  };
}

export const RIESGO_PERMITIDO = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };

export const OFERTA_STATUS = {
  registrada: { label: 'Registrada', tone: 'slate' },
  retirada: { label: 'Retirada', tone: 'slate' },
  validada: { label: 'Validada', tone: 'blue' },
  adjudicada: { label: 'Adjudicada', tone: 'violet' },
  no_seleccionada: { label: 'No seleccionada', tone: 'amber' },
  finalizada: { label: 'Finalizada', tone: 'green' },
};

// "Rescatistas Unidos + Manos Solidarias" (la principal va primero).
export function ongNames(oferta) {
  return (oferta.ongs ?? []).map((ong) => ong.name).join(' + ') || 'ONG sin identificar';
}
