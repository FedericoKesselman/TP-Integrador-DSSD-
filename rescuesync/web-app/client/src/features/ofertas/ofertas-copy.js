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
  PLENO: { label: 'Cobertura plena', tone: 'green' },
  PARCIAL: { label: 'Cobertura parcial', tone: 'amber' },
  APOYO: { label: 'Solo apoyo', tone: 'blue' },
  SIN_CAPACIDAD: { label: 'Sin capacidad', tone: 'red' },
};

export const ROL_SUGERIDO = { principal: 'Principal', apoyo: 'Apoyo' };

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
