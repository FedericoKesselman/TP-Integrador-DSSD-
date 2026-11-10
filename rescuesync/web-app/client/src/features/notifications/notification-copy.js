// Texto y destino de cada tipo de aviso (los tipos válidos están en
// web-app/shared/workflow.js, NOTIFICATION_TYPES). Un tipo nuevo sin copy cae en
// FALLBACK y se nota en la bandeja.
const COPY = {
  CONVOCATORIA: {
    title: 'Nueva convocatoria abierta',
    detail: 'Podés cargar tu oferta mientras la ventana siga abierta.',
    to: (n) => `/emergencias/${n.emergencyId}/oferta`,
  },
  CIERRE_CONVOCATORIA: {
    title: 'Convocatoria cerrada',
    detail: 'Se cerró la recepción de ofertas y se están validando.',
    to: (n) => `/emergencias/${n.emergencyId}/oferta`,
  },
  OFERTA_RETIRADA: {
    title: 'Tu oferta fue retirada',
    detail: 'El centro coordinador reformuló la convocatoria; vas a poder ofertar de nuevo.',
    to: () => '/emergencias',
  },
  ADJUDICADA: {
    title: 'Tu oferta fue adjudicada',
    detail: 'Marcá la actividad como finalizada cuando termines.',
    to: () => '/mis-ofertas',
  },
  NO_SELECCIONADA: {
    title: 'Tu oferta no fue seleccionada',
    detail: 'Esta vez el municipio eligió otras ofertas.',
    to: () => '/mis-ofertas',
  },
};

const FALLBACK = {
  title: 'Aviso',
  detail: '',
  to: (n) => `/emergencias/${n.emergencyId}/oferta`,
};

export function getNotificationCopy(tipo) {
  return COPY[tipo] ?? FALLBACK;
}
