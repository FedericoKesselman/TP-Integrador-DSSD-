import { CircleCheck, Plus } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';

import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { emergencyValuesShape } from '../emergency-prop-types.js';
import EmergencyPreview from './EmergencyPreview.jsx';

function EmergencyConfirmation({ emergency, values, onRegisterAnother }) {
  const headingRef = useRef(null);

  // Lleva el foco al título para que los lectores de pantalla anuncien el resultado.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="grid items-start gap-4 px-3 py-5 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)] lg:px-6 lg:py-8 xl:gap-6">
      <section className="rounded-2xl bg-paper p-5 shadow-paper ring-1 ring-ink/5 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-ping rounded-full bg-ok/20 [animation-iteration-count:2] motion-reduce:hidden"
            />
            <CircleCheck className="relative h-8 w-8" aria-hidden="true" />
          </span>
          <div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-3xl leading-tight font-bold text-ink outline-none font-stretch-semi-condensed"
            >
              Emergencia registrada
            </h1>
            <p className="mt-1 max-w-[60ch] text-ink-soft">
              El Centro Coordinador Regional ya recibió la alerta. El próximo paso es que la revise
              y arme los lotes de necesidades.
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 rounded-xl bg-paper-sunken p-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-sm text-ink-muted">Código de seguimiento</dt>
            <dd className="mt-0.5 truncate font-semibold text-ink" title={emergency.id}>
              {emergency.id.slice(0, 8).toUpperCase()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Estado</dt>
            <dd className="mt-0.5 font-semibold text-ink capitalize">{emergency.status}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Proceso en Bonita</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              {emergency.bonitaCaseId ? `Caso ${emergency.bonitaCaseId}` : 'Pendiente de inicio'}
            </dd>
          </div>
        </dl>

        {emergency.bonitaWarning && (
          <div className="mt-4">
            <Alert tone="warning">{emergency.bonitaWarning}</Alert>
          </div>
        )}

        <div className="mt-6">
          <Button size="lg" icon={Plus} onClick={onRegisterAnother}>
            Registrar otra emergencia
          </Button>
        </div>
      </section>

      <EmergencyPreview values={values} title="Datos enviados" />
    </div>
  );
}

EmergencyConfirmation.propTypes = {
  emergency: PropTypes.shape({
    id: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    bonitaCaseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    bonitaWarning: PropTypes.string,
  }).isRequired,
  values: emergencyValuesShape.isRequired,
  onRegisterAnother: PropTypes.func.isRequired,
};

export default EmergencyConfirmation;
