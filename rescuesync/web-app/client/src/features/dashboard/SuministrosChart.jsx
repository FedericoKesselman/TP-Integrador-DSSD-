import PropTypes from 'prop-types';
import { useMemo } from 'react';
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
import {
  BRAND_COLOR,
  CHART_INK_MUTED,
  CHART_LINE,
  formatMonth,
  formatQuantity,
  getResourceInfo,
} from './dashboard-format.js';

// Parte un rótulo largo en renglones de hasta `max` caracteres (sin cortar palabras).
function wrapLabel(text, max) {
  const lines = [];
  text.split(' ').forEach((word) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= max)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  });
  return lines;
}

function SuministrosTooltip({ active = false, payload = [] }) {
  if (!active || !payload.length) return null;
  const { label, unit, value, mes } = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-bold text-ink">{label}</p>
      {mes && <p className="text-ink-soft">{formatMonth(mes)}</p>}
      <p className="text-ink-soft">{formatQuantity(value, unit)}</p>
    </div>
  );
}

SuministrosTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({ payload: PropTypes.shape({}) })),
};

// `suministros` viene sin filtrar; `recurso` ('' = todos) elige la vista.
function SuministrosChart({ suministros, recurso = '' }) {
  const narrow = useMediaQuery('(max-width: 640px)');
  const info = getResourceInfo(recurso);

  // Vista "Todos": total por recurso (nunca se suman recursos distintos entre sí).
  // Vista de un recurso: cantidad por mes.
  const rows = useMemo(() => {
    if (recurso) {
      return suministros
        .filter((item) => item.recursoCodigo === recurso)
        .map((item) => ({
          mes: item.mes,
          value: item.cantidad,
          label: info.label,
          unit: info.unit,
        }))
        .sort((a, b) => a.mes.localeCompare(b.mes));
    }
    const totals = new Map();
    suministros.forEach(({ recursoCodigo, cantidad }) =>
      totals.set(recursoCodigo, (totals.get(recursoCodigo) ?? 0) + cantidad),
    );
    return [...totals]
      .map(([code, value]) => ({ code, value, ...getResourceInfo(code) }))
      .sort((a, b) => b.value - a.value);
  }, [suministros, recurso, info.label, info.unit]);

  const subtitle = recurso
    ? `${info.label} por mes de adjudicación${info.unit ? ` (${info.unit})` : ''}`
    : 'Total por recurso en el período. Elegí un recurso para ver su evolución por mes.';
  const summary = rows
    .map((row) =>
      recurso
        ? `${formatMonth(row.mes)}: ${formatQuantity(row.value, row.unit)}`
        : `${row.label}: ${formatQuantity(row.value, row.unit)}`,
    )
    .join('. ');

  const renderTick = ({ x, y, payload }) => {
    const lines = wrapLabel(payload.value, narrow ? 16 : 26);
    return (
      <text x={x} y={y} textAnchor="end" fontSize={narrow ? 11 : 12} fill="#334155">
        {lines.map((line, i) => (
          <tspan key={line} x={x} dy={i === 0 ? `${0.35 - (lines.length - 1) * 0.6}em` : '1.2em'}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  // Etiqueta con cantidad + unidad, al final de la barra (horizontal) o encima (vertical).
  const renderValue = ({ x = 0, y = 0, width = 0, height = 0, index }) => {
    const row = rows[index];
    if (!row) return null;
    const text = formatQuantity(row.value, row.unit);
    return recurso ? (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="#334155">
        {text}
      </text>
    ) : (
      <text x={x + width + 6} y={y + height / 2} dy="0.35em" fontSize={11} fill="#334155">
        {text}
      </text>
    );
  };

  return (
    <ChartCard id="chart-suministros" title="Suministros movilizados" summary={subtitle}>
      {rows.length === 0 ? (
        <EmptyChart>No hay suministros movilizados en este período.</EmptyChart>
      ) : (
        <div
          role="img"
          aria-label={`Gráfico de barras. ${subtitle}. ${summary}.`}
          className="w-full"
          style={{ height: recurso ? 320 : Math.max(240, rows.length * 44 + 40) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {recurso ? (
              <BarChart data={rows} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_LINE} vertical={false} />
                <XAxis
                  dataKey="mes"
                  tickFormatter={formatMonth}
                  tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                  stroke={CHART_LINE}
                />
                <YAxis
                  tickFormatter={(value) => formatQuantity(value)}
                  tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                  stroke={CHART_LINE}
                  allowDecimals={false}
                  width={56}
                />
                <Tooltip content={<SuministrosTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" fill={BRAND_COLOR} radius={[4, 4, 0, 0]} maxBarSize={56}>
                  <LabelList dataKey="value" content={renderValue} />
                </Bar>
              </BarChart>
            ) : (
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: narrow ? 84 : 96, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={CHART_LINE} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => formatQuantity(value)}
                  tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                  stroke={CHART_LINE}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={narrow ? 118 : 190}
                  tick={renderTick}
                  interval={0}
                  stroke={CHART_LINE}
                />
                <Tooltip content={<SuministrosTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" fill={BRAND_COLOR} radius={[0, 4, 4, 0]} maxBarSize={28}>
                  <LabelList dataKey="value" content={renderValue} />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

SuministrosChart.propTypes = {
  suministros: PropTypes.arrayOf(
    PropTypes.shape({
      mes: PropTypes.string,
      recursoCodigo: PropTypes.string,
      cantidad: PropTypes.number,
    }),
  ).isRequired,
  recurso: PropTypes.string,
};

export default SuministrosChart;
