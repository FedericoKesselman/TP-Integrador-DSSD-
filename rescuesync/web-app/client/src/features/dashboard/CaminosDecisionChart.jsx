import PropTypes from 'prop-types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useMediaQuery } from '../../hooks/use-media-query.js';

import ChartCard, { EmptyChart } from './ChartCard.jsx';
import { BRAND_COLOR, CHART_INK_MUTED, CHART_LINE } from './dashboard-format.js';

const CAMINOS = [
  { key: 'todosCubiertos', label: 'Cubrió todos los lotes' },
  { key: 'continuar', label: 'Continuar con cobertura parcial' },
  { key: 'reabrir', label: 'Reabrir convocatoria' },
  { key: 'reformular', label: 'Reformular lotes' },
];

const SUBTITLE = 'Estado tras validación: adjudicación directa o camino alternativo de Bonita.';

function CaminosTooltip({ active = false, payload = [] }) {
  if (!active || !payload.length) return null;
  const { label, value } = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-bold text-ink">{label}</p>
      <p className="text-ink-soft">{value}</p>
    </div>
  );
}

CaminosTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({ payload: PropTypes.shape({}) })),
};

function CaminosDecisionChart({ caminos }) {
  const narrow = useMediaQuery('(max-width: 640px)');
  const rows = CAMINOS.map(({ key, label }) => ({ label, value: caminos[key] ?? 0 }));
  const empty = rows.every((row) => row.value === 0);
  const summary = rows.map((row) => `${row.label}: ${row.value}`).join('. ');

  const renderTick = ({ x, y, payload }) => {
    const words = payload.value.split(' ');
    const half = Math.ceil(words.length / 2);
    const lines = narrow
      ? [words.slice(0, half).join(' '), words.slice(half).join(' ')]
      : [payload.value];
    return (
      <text x={x} y={y} textAnchor="end" fontSize={narrow ? 11 : 12} fill="#334155">
        {lines.filter(Boolean).map((line, i, all) => (
          <tspan key={line} x={x} dy={i === 0 ? `${0.35 - (all.length - 1) * 0.6}em` : '1.2em'}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  const renderValue = ({ x = 0, y = 0, width = 0, height = 0, index }) => (
    <text x={x + width + 6} y={y + height / 2} dy="0.35em" fontSize={11} fill="#334155">
      {rows[index]?.value}
    </text>
  );

  return (
    <ChartCard id="chart-caminos" title="Caminos tras la validación" summary={SUBTITLE}>
      {empty ? (
        <EmptyChart>No hay decisiones tras la validación en este período.</EmptyChart>
      ) : (
        <div
          role="img"
          aria-label={`Gráfico de barras. ${SUBTITLE} ${summary}.`}
          className="h-[240px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: narrow ? 32 : 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={CHART_LINE} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                stroke={CHART_LINE}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={narrow ? 110 : 200}
                tick={renderTick}
                interval={0}
                stroke={CHART_LINE}
              />
              <Tooltip content={<CaminosTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28}>
                <LabelList dataKey="value" content={renderValue} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        Cubrió todos los lotes cuenta emergencias adjudicadas; continuar, reabrir y reformular
        cuentan decisiones del coordinador.
      </p>
    </ChartCard>
  );
}

CaminosDecisionChart.propTypes = {
  caminos: PropTypes.shape({
    todosCubiertos: PropTypes.number,
    continuar: PropTypes.number,
    reabrir: PropTypes.number,
    reformular: PropTypes.number,
  }).isRequired,
};

export default CaminosDecisionChart;
