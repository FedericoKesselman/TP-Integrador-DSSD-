/* Los handlers dependen del estado de la pantalla, así que se pasan como funciones. */
/* eslint-disable react/jsx-no-bind */
import { CheckCheck } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { confirmarCierreEjecucion } from '../../../services/ciclo-service.js';
import { ongNames } from '../ofertas-copy.js';

import Pill from './Pill.jsx';

// Cierre de la ejecución (coordinador): muestra qué ofertas adjudicadas ya
// finalizaron y habilita el cierre cuando terminaron todas. El backend vuelve a
// comprobarlo; el pase a "finalizada" lo hace Bonita después de este paso.
function EjecucionPanel({ emergencyId, ofertas, onDone }) {
  const [closing, setClosing] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [pendientes, setPendientes] = useState([]);

  const enEjecucion = ofertas.filter((o) => o.status === 'adjudicada' || o.status === 'finalizada');
  const finalizadas = enEjecucion.filter((o) => o.status === 'finalizada').length;
  const faltan = enEjecucion.length - finalizadas;
  const canClose = enEjecucion.length > 0 && faltan === 0 && !sent;

  async function close() {
    setClosing(true);
    setError(null);
    setPendientes([]);
    try {
      await confirmarCierreEjecucion(emergencyId);
      setSent(true);
      onDone('Cierre de ejecución confirmado. El caso se está finalizando en Bonita.');
    } catch (err) {
      setError(err.message);
      setPendientes(err.detalle?.pendientes ?? []);
    } finally {
      setClosing(false);
    }
  }

  return (
    <section
      aria-labelledby="ejecucion-title"
      className="rounded-2xl border border-line bg-white p-5 shadow-sm"
    >
      <h2 id="ejecucion-title" className="text-lg font-bold text-ink">
        Ejecución
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {finalizadas} de {enEjecucion.length} ofertas finalizadas. El cierre se habilita cuando
        todas las ONGs marcaron su actividad como finalizada.
      </p>

      <ul className="mt-3 divide-y divide-line">
        {enEjecucion.map((oferta) => (
          <li key={oferta.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="font-medium text-ink">{ongNames(oferta)}</span>
            {oferta.status === 'finalizada' ? (
              <Pill tone="green">Finalizada</Pill>
            ) : (
              <Pill tone="amber">Pendiente</Pill>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-4">
          <Alert tone="error" title="No se pudo confirmar el cierre">
            {error}
            {pendientes.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {pendientes.map((item) => (
                  <li key={item.ofertaId}>{(item.ongs ?? []).join(' + ')}</li>
                ))}
              </ul>
            )}
          </Alert>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button icon={CheckCheck} loading={closing} disabled={!canClose} onClick={close}>
          Confirmar cierre de ejecución
        </Button>
      </div>
    </section>
  );
}

EjecucionPanel.propTypes = {
  emergencyId: PropTypes.string.isRequired,
  ofertas: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    }),
  ).isRequired,
  onDone: PropTypes.func.isRequired,
};

export default EjecucionPanel;
