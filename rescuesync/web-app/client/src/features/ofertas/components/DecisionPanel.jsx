/* Los handlers dependen del estado de la pantalla, así que se pasan como funciones. */
/* eslint-disable react/jsx-no-bind */
import { Send } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { decidirContinuacion } from '../../../services/ciclo-service.js';
import DuracionConvocatoriaField from '../../emergencies/components/DuracionConvocatoriaField.jsx';
import {
  DURACION_DEFAULT,
  formatDuracion,
  getDuracionError,
  parseDuracion,
} from '../../emergencies/duracion.js';

const OPTIONS = [
  {
    value: 'continuar',
    title: 'Continuar con las ofertas recibidas',
    detail: 'El municipio podrá adjudicar entre las ofertas validadas.',
  },
  {
    value: 'reabrir',
    title: 'Reabrir la convocatoria',
    detail:
      'Las ofertas vuelven a quedar editables y se abre una nueva ventana. La selección anterior se descarta.',
  },
  {
    value: 'reformular',
    title: 'Reformular los lotes',
    detail:
      'Se retiran todas las ofertas (cada ONG recibe un aviso) y la emergencia vuelve a "Por desglosar" para rearmar los lotes.',
  },
];

// Decisión del coordinador con las ofertas ya validadas: continuar, reabrir o
// reformular. `todosLosLotesCubiertos` solo orienta (marca la opción sugerida):
// el backend acepta cualquiera de las tres.
function DecisionPanel({ emergencyId, todosLosLotesCubiertos = null, onDone }) {
  const [camino, setCamino] = useState('');
  const [duracion, setDuracion] = useState(DURACION_DEFAULT);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const needsDuration = camino === 'reabrir';
  const needsConfirm = camino === 'reformular';
  const invalid =
    !camino ||
    (needsDuration && Boolean(getDuracionError(duracion))) ||
    (needsConfirm && !confirmed);

  function choose(value) {
    setCamino(value);
    setConfirmed(false);
    setError(null);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await decidirContinuacion(
        emergencyId,
        camino,
        needsDuration ? parseDuracion(duracion) : undefined,
      );
      const detail = needsDuration
        ? ` Nueva ventana: ${formatDuracion(parseDuracion(duracion))}.`
        : '';
      onDone(`Decisión registrada: ${OPTIONS.find((o) => o.value === camino).title}.${detail}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const recommended = todosLosLotesCubiertos ? 'continuar' : null;

  return (
    <section
      aria-labelledby="decision-title"
      className="rounded-2xl border border-line bg-white p-5 shadow-sm"
    >
      <h2 id="decision-title" className="text-lg font-bold text-ink">
        ¿Cómo seguimos?
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {todosLosLotesCubiertos
          ? 'Las ofertas validadas cubren todos los lotes.'
          : 'Las ofertas validadas no cubren todos los lotes.'}{' '}
        Elegí cómo continuar el proceso.
      </p>

      <fieldset className="mt-4 space-y-2.5" disabled={submitting}>
        <legend className="sr-only">Camino a seguir</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            htmlFor={`camino-${option.value}`}
            className={`grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-xl border p-3.5 ${
              camino === option.value
                ? 'border-brand bg-brand-soft/40 ring-2 ring-brand/20'
                : 'border-line hover:bg-paper-sunken'
            }`}
          >
            <input
              id={`camino-${option.value}`}
              type="radio"
              name="camino"
              value={option.value}
              checked={camino === option.value}
              onChange={() => choose(option.value)}
              className="row-span-2 mt-1 h-4 w-4 text-brand focus:ring-brand"
            />
            <span className="text-sm font-bold text-ink">
              {option.title}
              {recommended === option.value && (
                <span className="ml-2 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">
                  Sugerido
                </span>
              )}
            </span>
            <span className="text-sm text-ink-soft">{option.detail}</span>
          </label>
        ))}
      </fieldset>

      {needsDuration && (
        <div className="mt-4">
          <DuracionConvocatoriaField
            id="duracion-reapertura"
            value={duracion}
            onChange={setDuracion}
            disabled={submitting}
          />
        </div>
      )}

      {needsConfirm && (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={submitting}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span>Entiendo que se retiran todas las ofertas y que esto no se puede deshacer.</span>
        </label>
      )}

      {error && (
        <div className="mt-4">
          <Alert tone="error" title="No se pudo registrar la decisión">
            {error}
          </Alert>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button icon={Send} loading={submitting} disabled={invalid} onClick={submit}>
          Confirmar decisión
        </Button>
      </div>
    </section>
  );
}

DecisionPanel.propTypes = {
  emergencyId: PropTypes.string.isRequired,
  todosLosLotesCubiertos: PropTypes.bool,
  onDone: PropTypes.func.isRequired,
};

export default DecisionPanel;
