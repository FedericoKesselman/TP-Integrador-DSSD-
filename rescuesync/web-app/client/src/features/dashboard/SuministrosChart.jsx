/* El Legend de Recharts recibe funciones que dependen del estado `hidden`. */
/* eslint-disable react/jsx-no-bind, react/no-unstable-nested-components */
import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import ChartCard, { EmptyChart } from './ChartCard.jsx';
import { CHART_INK_MUTED, CHART_LINE, formatMonth, getResourceInfo } from './dashboard-format.js';

// `suministros` ya viene filtrado por recurso (si corresponde).
function SuministrosChart({ suministros }) {
  const [hidden, setHidden] = useState(() => new Set());

  const { rows, codes } = useMemo(() => {
    const byMonth = new Map();
    const seen = new Set();
    suministros.forEach(({ mes, recursoCodigo, cantidad }) => {
      seen.add(recursoCodigo);
      byMonth.set(mes, { ...byMonth.get(mes), mes, [recursoCodigo]: cantidad });
    });
    return {
      rows: [...byMonth.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
      codes: [...seen].sort(),
    };
  }, [suministros]);

  function toggle(entry) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(entry.dataKey)) next.delete(entry.dataKey);
      else next.add(entry.dataKey);
      return next;
    });
  }

  const total = suministros.reduce((sum, item) => sum + item.cantidad, 0);
  const summary = `${total} unidades en ${rows.length} ${rows.length === 1 ? 'mes' : 'meses'}, ${codes.length} ${codes.length === 1 ? 'recurso' : 'recursos'}.`;

  return (
    <ChartCard
      id="chart-suministros"
      title="Suministros movilizados por mes"
      summary={`Por mes de adjudicación. Clic en la leyenda para ocultar o mostrar un recurso. ${rows.length ? summary : ''}`}
    >
      {rows.length === 0 ? (
        <EmptyChart>No hay suministros movilizados en este período.</EmptyChart>
      ) : (
        <div
          role="img"
          aria-label={`Gráfico de barras apiladas. ${summary}`}
          className="h-80 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_LINE} vertical={false} />
              <XAxis
                dataKey="mes"
                tickFormatter={formatMonth}
                tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                stroke={CHART_LINE}
              />
              <YAxis
                tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                stroke={CHART_LINE}
                allowDecimals={false}
              />
              <Tooltip
                labelFormatter={formatMonth}
                formatter={(value, name, item) => [
                  `${value} ${getResourceInfo(item.dataKey).unit}`.trim(),
                  name,
                ]}
              />
              <Legend
                onClick={toggle}
                wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
                formatter={(value, entry) => (
                  <span style={{ color: hidden.has(entry.dataKey) ? '#94a3b8' : '#334155' }}>
                    {value}
                  </span>
                )}
              />
              {codes.map((code) => {
                const info = getResourceInfo(code);
                return (
                  <Bar
                    key={code}
                    dataKey={code}
                    name={info.label}
                    stackId="suministros"
                    fill={info.color}
                    fillOpacity={info.opacity}
                    stroke="#fff"
                    hide={hidden.has(code)}
                  />
                );
              })}
            </BarChart>
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
};

export default SuministrosChart;
