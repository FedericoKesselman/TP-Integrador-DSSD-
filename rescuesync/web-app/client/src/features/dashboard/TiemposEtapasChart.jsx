import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useMediaQuery } from '../../hooks/use-media-query.js';
import { EMERGENCY_TYPES } from '../emergencies/emergency-constants.js';

import ChartCard, { EmptyChart } from './ChartCard.jsx';
import {
  CHART_INK_MUTED,
  CHART_LINE,
  ETAPA_LABELS,
  formatMinutes,
  TYPE_COLORS,
} from './dashboard-format.js';

const GENERAL_COLOR = '#0072bb';

// Etiqueta al final de la barra (sin el ajuste de línea de LabelList, que corta "1 h 35 min").
function BarEndLabel({ x = 0, y = 0, width = 0, height = 0, value = null }) {
  if (value === null || value === undefined) return null;
  return (
    <text x={x + width + 6} y={y + height / 2} dy="0.35em" fontSize={11} fill="#334155">
      {formatMinutes(value)}
    </text>
  );
}

BarEndLabel.propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  value: PropTypes.number,
};

const typeLabel = (value) => EMERGENCY_TYPES.find((type) => type.value === value)?.label ?? value;

// Un renglón por etapa. `stats[serie]` guarda lo que muestra el tooltip; el valor de la
// barra (`serie`) queda en null cuando no hay casos, así no se dibuja un cero engañoso.
function buildRows(etapas, series) {
  return etapas.map((etapa, index) => {
    const row = { etapa: etapa.etapa, label: ETAPA_LABELS[etapa.etapa] ?? etapa.etapa, stats: {} };
    series.forEach(({ key, etapas: serieEtapas }) => {
      const stats = (serieEtapas ?? etapas)[index];
      row.stats[key] = stats;
      row[key] = stats.casos > 0 ? stats.promedioMinutos : null;
    });
    row.sinDatos = Object.values(row.stats).every((stats) => stats.casos === 0);
    return row;
  });
}

function TiemposTooltip({ active = false, payload = [], label = '', names }) {
  if (!active || !payload.length) return null;
  const { stats } = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="mb-1 font-bold text-ink">{label}</p>
      {Object.entries(stats).map(([key, value]) => (
        <p key={key} className="text-ink-soft">
          {names[key] && <span className="font-semibold">{names[key]}: </span>}
          {value.casos === 0
            ? 'sin datos todavía'
            : `promedio ${formatMinutes(value.promedioMinutos)} · mín ${formatMinutes(value.minMinutos)} · máx ${formatMinutes(value.maxMinutos)} · ${value.casos} ${value.casos === 1 ? 'caso' : 'casos'}`}
        </p>
      ))}
    </div>
  );
}

TiemposTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(
    PropTypes.shape({ payload: PropTypes.shape({ stats: PropTypes.shape({}) }) }),
  ),
  label: PropTypes.string,
  names: PropTypes.shape({}).isRequired,
};

function TiemposEtapasChart({ tiempos }) {
  const [mode, setMode] = useState('general');
  const narrow = useMediaQuery('(max-width: 640px)');

  const porTipo = useMemo(() => tiempos.porTipo ?? [], [tiempos.porTipo]);
  const { rows, series } = useMemo(() => {
    const list =
      mode === 'general'
        ? [{ key: 'general', name: 'Promedio general', color: GENERAL_COLOR }]
        : porTipo.map((item) => ({
            key: item.tipo,
            name: typeLabel(item.tipo),
            color: TYPE_COLORS[item.tipo] ?? CHART_INK_MUTED,
            etapas: item.etapas,
          }));
    return { rows: buildRows(tiempos.etapas, list), series: list };
  }, [mode, porTipo, tiempos.etapas]);

  const names = Object.fromEntries(
    series.map((item) => [item.key, mode === 'general' ? '' : item.name]),
  );
  const sinCasos = tiempos.etapas.every((etapa) => etapa.casos === 0);
  const empty = sinCasos || (mode === 'porTipo' && porTipo.length === 0);
  const summary = rows
    .map((row) =>
      row.sinDatos
        ? `${row.label}: sin datos todavía`
        : `${row.label}: ${series
            .filter((item) => row.stats[item.key].casos > 0)
            .map(
              (item) =>
                `${mode === 'general' ? '' : `${item.name} `}${formatMinutes(row.stats[item.key].promedioMinutos)}`,
            )
            .join(', ')}`,
    )
    .join('. ');

  const renderTick = ({ x, y, payload }) => {
    const row = rows.find((item) => item.label === payload.value);
    // En pantallas angostas el rótulo se parte en el "→" para que entre en el eje.
    const lines = narrow
      ? payload.value.split(' → ').map((part, i) => (i ? `→ ${part}` : part))
      : [payload.value];
    if (row?.sinDatos) lines.push(null);
    const offset = -((lines.length - 1) * 0.65) + 0.35;
    return (
      <text x={x} y={y} textAnchor="end" fontSize={narrow ? 11 : 12} fill="#334155">
        {lines.map((line, i) => (
          <tspan
            key={line ?? 'sin-datos'}
            x={x}
            dy={`${i === 0 ? offset : 1.3}em`}
            fill={line ? undefined : CHART_INK_MUTED}
            fontSize={line ? undefined : 11}
          >
            {line ?? 'sin datos todavía'}
          </tspan>
        ))}
      </text>
    );
  };

  const toggle = (
    <div
      className="inline-flex rounded-lg bg-paper-sunken p-0.5 ring-1 ring-line"
      role="group"
      aria-label="Agrupación"
    >
      {[
        ['general', 'General'],
        ['porTipo', 'Por tipo de emergencia'],
      ].map(([value, text]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
          className={`rounded-md px-3 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 ${
            mode === value ? 'bg-white text-brand shadow-sm' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard
      id="chart-tiempos"
      title="Tiempo promedio por etapa"
      summary="Calculado con los tiempos de los casos de Bonita."
      actions={toggle}
    >
      {empty ? (
        <EmptyChart>
          {sinCasos
            ? 'Todavía no hay casos con tiempos medidos en este período.'
            : 'Todavía no hay casos cruzados con un tipo de emergencia.'}
        </EmptyChart>
      ) : (
        <div
          role="img"
          aria-label={`Gráfico de barras horizontales con el tiempo promedio por etapa. ${summary}.`}
          className={mode === 'porTipo' ? 'h-[28rem] w-full' : 'h-80 w-full'}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 56, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={CHART_LINE} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={formatMinutes}
                tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                stroke={CHART_LINE}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={narrow ? 112 : 160}
                tick={renderTick}
                interval={0}
                stroke={CHART_LINE}
              />
              <Tooltip content={<TiemposTooltip names={names} />} cursor={{ fill: '#f1f5f9' }} />
              {mode === 'porTipo' && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {series.map((item) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  name={item.name}
                  fill={item.color}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={28}
                >
                  <LabelList dataKey={item.key} content={BarEndLabel} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Este indicador cruza los tiempos de Bonita con el tipo de emergencia de la base local; los
        casos sin emergencia en la base solo cuentan en el promedio general.
      </p>
    </ChartCard>
  );
}

TiemposEtapasChart.propTypes = {
  tiempos: PropTypes.shape({
    etapas: PropTypes.arrayOf(PropTypes.shape({ casos: PropTypes.number })).isRequired,
    porTipo: PropTypes.arrayOf(PropTypes.shape({ tipo: PropTypes.string })),
  }).isRequired,
};

export default TiemposEtapasChart;
