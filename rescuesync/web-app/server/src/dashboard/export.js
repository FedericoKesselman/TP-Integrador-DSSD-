// Armado del export del dashboard (contrato: api-contracts.md, Dashboard → export).
export const DATASETS = ['suministros', 'estado-proyectos', 'tiempos-etapas', 'tiempos-por-tipo'];

// Campo CSV: null → vacío; con coma, comillas o salto de línea va entre comillas dobles.
const campo = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export const toCsv = (headers, rows) =>
  `${[headers, ...rows].map((fila) => fila.map(campo).join(',')).join('\n')}\n`;

const TIEMPOS = ['etapa', 'casos', 'promedioMinutos', 'minMinutos', 'maxMinutos'];
const filaTiempos = (e) => TIEMPOS.map((k) => e[k]);

// CSV de un dataset a partir de las respuestas de /indicadores y /tiempos-etapas.
export function datasetCsv(dataset, indicadores, tiempos) {
  if (dataset === 'suministros') {
    const headers = ['mes', 'recursoCodigo', 'cantidad'];
    return toCsv(
      headers,
      indicadores.suministrosMovilizados.map((s) => headers.map((k) => s[k])),
    );
  }
  if (dataset === 'estado-proyectos') {
    const cols = ['id', 'type', 'severity', 'province', 'municipality', 'createdAt'];
    return toCsv(
      ['estado', ...cols],
      indicadores.estadoProyectos.flatMap((s) =>
        s.emergencias.map((e) => [s.estado, ...cols.map((k) => e[k])]),
      ),
    );
  }
  if (dataset === 'tiempos-etapas') return toCsv(TIEMPOS, tiempos.etapas.map(filaTiempos));
  return toCsv(
    ['tipo', ...TIEMPOS],
    tiempos.porTipo.flatMap((t) => t.etapas.map((e) => [t.tipo, ...filaTiempos(e)])),
  );
}
