import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useMediaQuery } from '../../hooks/use-media-query.js';
import { formatDateTime } from '../../lib/dates.js';
import { EMERGENCY_TYPES, SEVERITY_LEVELS } from '../emergencies/emergency-constants.js';
import { getStatusCopy, STATUS_FLOW } from '../emergencies/emergency-status.js';

import ChartCard, { EmptyChart } from './ChartCard.jsx';
import { CHART_INK_MUTED, CHART_LINE, getStatusColor } from './dashboard-format.js';

const typeLabel = (value) => EMERGENCY_TYPES.find((type) => type.value === value)?.label ?? value;
const severityLabel = (value) =>
  SEVERITY_LEVELS.find((level) => level.value === value)?.label ?? value;

function EstadoProyectosChart({ estadoProyectos }) {
  const [selected, setSelected] = useState(null);
  // En móvil los rótulos del eje no entran: los botones de abajo hacen de leyenda.
  const narrow = useMediaQuery('(max-width: 640px)');

  // Orden del ciclo; los estados desconocidos van al final.
  const data = useMemo(() => {
    const rank = (estado) => {
      const index = STATUS_FLOW.findIndex((s) => s.value === estado);
      return index === -1 ? STATUS_FLOW.length : index;
    };
    return [...estadoProyectos]
      .sort((a, b) => rank(a.estado) - rank(b.estado))
      .map((item) => ({ ...item, label: getStatusCopy(item.estado).shortLabel }));
  }, [estadoProyectos]);

  const current = data.find((item) => item.estado === selected) ?? null;
  const total = data.reduce((sum, item) => sum + item.cantidad, 0);
  const summary = data.map((item) => `${item.label}: ${item.cantidad}`).join(', ');

  return (
    <ChartCard
      id="chart-estados"
      title="Estado de proyectos"
      summary="Elegí un estado para ver sus emergencias."
    >
      {data.length === 0 ? (
        <EmptyChart>No hay emergencias en este período.</EmptyChart>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Gráfico de barras de ${total} emergencias por estado. ${summary}.`}
            className="h-64 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_LINE} vertical={false} />
                <XAxis
                  hide={narrow}
                  dataKey="label"
                  tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                  stroke={CHART_LINE}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: CHART_INK_MUTED, fontSize: 12 }}
                  stroke={CHART_LINE}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value) => [value, 'Emergencias']}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar
                  dataKey="cantidad"
                  name="Emergencias"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(item) => setSelected(item.estado)}
                >
                  {data.map((item) => (
                    <Cell
                      key={item.estado}
                      fill={getStatusColor(item.estado)}
                      fillOpacity={selected && selected !== item.estado ? 0.4 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Elegir estado">
            {data.map((item) => (
              <button
                key={item.estado}
                type="button"
                aria-pressed={selected === item.estado}
                onClick={() => setSelected(selected === item.estado ? null : item.estado)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 ${
                  selected === item.estado
                    ? 'bg-brand-soft text-brand ring-brand'
                    : 'bg-white text-ink-soft ring-line hover:ring-ink-muted'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: getStatusColor(item.estado) }}
                  aria-hidden="true"
                />
                {item.label} · {item.cantidad}
              </button>
            ))}
          </div>

          {current && (
            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <p className="border-b border-line bg-paper-sunken px-3 py-2 text-sm font-bold text-ink">
                {getStatusCopy(current.estado).label} ({current.cantidad})
              </p>
              <ul className="divide-y divide-line text-sm">
                {current.emergencias.map((emergency) => (
                  <li
                    key={emergency.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2"
                  >
                    <span className="font-semibold text-ink">{typeLabel(emergency.type)}</span>
                    <span className="text-ink-soft">
                      Gravedad {severityLabel(emergency.severity).toLowerCase()}
                    </span>
                    <span className="text-ink-soft">
                      {emergency.municipality}, {emergency.province}
                    </span>
                    <span className="text-xs text-ink-muted sm:ml-auto">
                      {formatDateTime(new Date(emergency.createdAt))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </ChartCard>
  );
}

EstadoProyectosChart.propTypes = {
  estadoProyectos: PropTypes.arrayOf(
    PropTypes.shape({
      estado: PropTypes.string,
      cantidad: PropTypes.number,
      emergencias: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          type: PropTypes.string,
          severity: PropTypes.string,
          province: PropTypes.string,
          municipality: PropTypes.string,
          createdAt: PropTypes.string,
        }),
      ),
    }),
  ).isRequired,
};

export default EstadoProyectosChart;
