import PropTypes from 'prop-types';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useMediaQuery } from '../../hooks/use-media-query.js';

import ChartCard, { EmptyChart } from './ChartCard.jsx';
import {
  CHART_INK_MUTED,
  CHART_LINE,
  formatMonth,
  formatPercent,
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
  const { label, unit, value, mes, category, pedido, movilizado, porcentaje } = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-bold text-ink">{label}</p>
      <p className="text-ink-soft">{category}</p>
      {mes && <p className="text-ink-soft">{formatMonth(mes)}</p>}
      {mes ? (
        <p className="text-ink-soft">{formatQuantity(value, unit)}</p>
      ) : (
        <>
          <p className="text-ink-soft">{formatPercent(porcentaje)} cubierto</p>
          <p className="text-ink-soft">Movilizado: {formatQuantity(movilizado, unit)}</p>
          <p className="text-ink-soft">Pedido: {formatQuantity(pedido, unit)}</p>
        </>
      )}
    </div>
  );
}

SuministrosTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({ payload: PropTypes.shape({}) })),
};

// Detalle bajo el nombre: "3.000 de 4.000 litros" (+ aviso si se superó lo pedido).
function coverageDetail({ movilizado, pedido, unit }) {
  const base = `${formatQuantity(movilizado)} de ${formatQuantity(pedido, unit)}`;
  return movilizado > pedido ? `${base} (más de lo pedido)` : base;
}

// "Todos": % cubierto por recurso (`porRecurso`, ya ordenado por la API).
// Un recurso: cantidad por mes desde `suministros`.
function SuministrosChart({ suministros, porRecurso, recurso = '' }) {
  const narrow = useMediaQuery('(max-width: 640px)');
  const info = getResourceInfo(recurso);

  const rows = useMemo(() => {
    if (recurso) {
      return suministros
        .filter((item) => item.recursoCodigo === recurso)
        .map((item) => ({
          mes: item.mes,
          value: item.cantidad,
          label: info.label,
          unit: info.unit,
          category: info.category,
          color: info.color,
        }))
        .sort((a, b) => a.mes.localeCompare(b.mes));
    }
    return porRecurso.map((item) => ({
      code: item.recursoCodigo,
      value: item.porcentajeCubierto,
      porcentaje: item.porcentajeCubierto,
      pedido: item.pedido,
      movilizado: item.movilizado,
      ...getResourceInfo(item.recursoCodigo),
    }));
  }, [suministros, porRecurso, recurso, info]);

  const subtitle = recurso
    ? `${info.label}${info.unit ? ` (${info.unit})` : ''} por mes de adjudicación, de las emergencias dadas de alta en el período`
    : 'Qué parte de lo pedido comprometió el Sistema Nacional, por recurso (emergencias adjudicadas). Elegí un recurso para ver su evolución por mes.';
  const title = recurso ? `Suministros por mes: ${info.label}` : 'Cobertura por recurso';
  const summary = rows
    .map((row) =>
      recurso
        ? `${formatMonth(row.mes)}: ${formatQuantity(row.value, row.unit)}`
        : `${row.label} (${row.category}): ${formatPercent(row.porcentaje)} cubierto, ${coverageDetail(row)}`,
    )
    .join('. ');

  // Leyenda: solo las categorías presentes en los datos actuales.
  const legend = [...new Map(rows.map((row) => [row.category, row.color]))];

  // Nombre (oscuro) y, debajo, el detalle movilizado/pedido (gris).
  const renderTick = ({ x, y, payload, index }) => {
    const names = wrapLabel(payload.value, narrow ? 16 : 26);
    const details = wrapLabel(coverageDetail(rows[index]), narrow ? 18 : 30);
    const total = names.length + details.length;
    return (
      <text x={x} y={y} textAnchor="end" fontSize={narrow ? 11 : 12}>
        {[...names, ...details].map((line, i) => (
          <tspan
            key={line}
            x={x}
            dy={i === 0 ? `${0.35 - (total - 1) * 0.6}em` : '1.2em'}
            fill={i < names.length ? '#334155' : CHART_INK_MUTED}
            fontSize={i < names.length ? undefined : 11}
          >
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
    const text = recurso ? formatQuantity(row.value, row.unit) : formatPercent(row.value);
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
    <ChartCard id="chart-suministros" title={title} summary={subtitle}>
      {rows.length === 0 ? (
        <EmptyChart>
          {recurso
            ? 'No hay suministros movilizados en este período.'
            : 'Sin emergencias adjudicadas en el período'}
        </EmptyChart>
      ) : (
        <div
          role="img"
          aria-label={`Gráfico de barras. ${subtitle}. ${summary}.`}
          className="w-full"
          style={{ height: recurso ? 320 : Math.max(240, rows.length * (narrow ? 76 : 64) + 40) }}
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
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                  {rows.map((row) => (
                    <Cell key={row.mes} fill={row.color} />
                  ))}
                  <LabelList dataKey="value" content={renderValue} />
                </Bar>
              </BarChart>
            ) : (
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={CHART_LINE} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={formatPercent}
                  tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                  stroke={CHART_LINE}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={narrow ? 130 : 210}
                  tick={renderTick}
                  interval={0}
                  stroke={CHART_LINE}
                />
                <Tooltip content={<SuministrosTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {rows.map((row) => (
                    <Cell key={row.code} fill={row.color} />
                  ))}
                  <LabelList dataKey="value" content={renderValue} />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {legend.map(([name, color]) => (
            <li key={name} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {name}
            </li>
          ))}
        </ul>
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
  porRecurso: PropTypes.arrayOf(
    PropTypes.shape({
      recursoCodigo: PropTypes.string,
      pedido: PropTypes.number,
      movilizado: PropTypes.number,
      porcentajeCubierto: PropTypes.number,
    }),
  ).isRequired,
  recurso: PropTypes.string,
};

export default SuministrosChart;
