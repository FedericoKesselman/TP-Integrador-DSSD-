import PropTypes from 'prop-types';

import Button from '../../components/ui/Button.jsx';

import { toIsoDate } from './dashboard-format.js';

const INPUT_CLASS =
  'rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20';

function currentMonth() {
  const today = new Date();
  return {
    desde: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    hasta: toIsoDate(today),
  };
}

function lastThreeMonths() {
  const today = new Date();
  return {
    desde: toIsoDate(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())),
    hasta: toIsoDate(today),
  };
}

function DashboardFilters({ periodo, onPeriodoChange, recurso, onRecursoChange, recursoOptions }) {
  const invalid = Boolean(periodo.desde && periodo.hasta && periodo.desde > periodo.hasta);
  const isTodo = !periodo.desde && !periodo.hasta;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
          Desde
          <input
            type="date"
            value={periodo.desde}
            max={periodo.hasta || undefined}
            onChange={(event) => onPeriodoChange({ ...periodo, desde: event.target.value })}
            aria-invalid={invalid}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
          Hasta
          <input
            type="date"
            value={periodo.hasta}
            min={periodo.desde || undefined}
            onChange={(event) => onPeriodoChange({ ...periodo, hasta: event.target.value })}
            aria-invalid={invalid}
            className={INPUT_CLASS}
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Períodos rápidos">
          <Button variant="secondary" size="sm" onClick={() => onPeriodoChange(currentMonth())}>
            Este mes
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onPeriodoChange(lastThreeMonths())}>
            Últimos 3 meses
          </Button>
          <Button
            variant={isTodo ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onPeriodoChange({ desde: '', hasta: '' })}
          >
            Todo
          </Button>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink sm:ml-auto">
          Recurso
          <select
            value={recurso}
            onChange={(event) => onRecursoChange(event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Todos</option>
            {recursoOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {invalid && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          La fecha “Desde” no puede ser posterior a “Hasta”.
        </p>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        El período filtra las emergencias por su fecha de alta. El filtro de recurso solo afecta al
        gráfico de suministros.
      </p>
    </div>
  );
}

DashboardFilters.propTypes = {
  periodo: PropTypes.shape({ desde: PropTypes.string, hasta: PropTypes.string }).isRequired,
  onPeriodoChange: PropTypes.func.isRequired,
  recurso: PropTypes.string.isRequired,
  onRecursoChange: PropTypes.func.isRequired,
  recursoOptions: PropTypes.arrayOf(
    PropTypes.shape({ code: PropTypes.string, label: PropTypes.string }),
  ).isRequired,
};

export default DashboardFilters;
