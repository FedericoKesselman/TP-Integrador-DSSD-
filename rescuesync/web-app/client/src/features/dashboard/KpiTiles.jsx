import { Boxes, Handshake, Layers, Siren } from 'lucide-react';
import PropTypes from 'prop-types';

import { formatPercent } from './dashboard-format.js';

function Tile({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {label}
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </div>
  );
}

Tile.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  detail: PropTypes.string.isRequired,
};

// `tiempos` es null mientras carga o si Bonita falló.
function KpiTiles({ indicadores, tiempos = null }) {
  const totalEmergencias = indicadores.estadoProyectos.reduce(
    (sum, item) => sum + item.cantidad,
    0,
  );
  const { emergenciasFinalizadas, conConsorcio, porcentaje } = indicadores.resolucionConsorcios;
  const { emergencias, lotes, promedioPorcentaje } = indicadores.coberturaLotes;

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        icon={Siren}
        label="Emergencias en el período"
        value={String(totalEmergencias)}
        detail="Dadas de alta en el período"
      />
      <Tile
        icon={Handshake}
        label="Resueltas con consorcio"
        value={emergenciasFinalizadas > 0 ? formatPercent(porcentaje) : '—'}
        detail={`${conConsorcio} de ${emergenciasFinalizadas} finalizadas`}
      />
      <Tile
        icon={Boxes}
        label="Cobertura promedio de lotes"
        value={promedioPorcentaje === null ? '—' : formatPercent(promedioPorcentaje)}
        detail={
          promedioPorcentaje === null
            ? 'Sin emergencias adjudicadas en el período'
            : `${lotes} ${lotes === 1 ? 'lote' : 'lotes'} de ${emergencias} ${
                emergencias === 1 ? 'emergencia adjudicada' : 'emergencias adjudicadas'
              } (promedio por lote)`
        }
      />
      <Tile
        icon={Layers}
        label="Casos analizados en Bonita"
        value={tiempos ? String(tiempos.casosAnalizados) : '—'}
        detail={tiempos ? 'Casos iniciados en el período' : 'Sin datos de Bonita'}
      />
    </div>
  );
}

KpiTiles.propTypes = {
  indicadores: PropTypes.shape({
    estadoProyectos: PropTypes.arrayOf(PropTypes.shape({ cantidad: PropTypes.number })),
    resolucionConsorcios: PropTypes.shape({
      emergenciasFinalizadas: PropTypes.number,
      conConsorcio: PropTypes.number,
      porcentaje: PropTypes.number,
    }),
    coberturaLotes: PropTypes.shape({
      emergencias: PropTypes.number,
      lotes: PropTypes.number,
      promedioPorcentaje: PropTypes.number,
    }),
  }).isRequired,
  tiempos: PropTypes.shape({ casosAnalizados: PropTypes.number }),
};

export default KpiTiles;
