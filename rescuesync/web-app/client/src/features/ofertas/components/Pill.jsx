import PropTypes from 'prop-types';

import { TONE_CLASSES } from '../ofertas-copy.js';

// Etiqueta redondeada con un tono (verde, ámbar, azul, rojo, violeta, gris).
function Pill({ tone = 'slate', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

Pill.propTypes = {
  tone: PropTypes.oneOf(Object.keys(TONE_CLASSES)),
  children: PropTypes.node.isRequired,
};

export default Pill;
