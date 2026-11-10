import pool from '../db.js';

// Ofertas que cuentan como "movilizadas": ya adjudicadas o con la emergencia finalizada.
const OFERTAS_VIGENTES = "('adjudicada', 'finalizada')";

const round1 = (n) => Math.round(Number(n) * 10) / 10;

// Indicadores del dashboard con datos propios (roadmapfase5.md 5.5).
// El mes de un suministro es el de `ofertas.updated_at` (último cambio: la adjudicación).
export async function getIndicadores() {
  const [suministros, consorcios, estados, cobertura] = await Promise.all([
    pool.query(
      `SELECT to_char(date_trunc('month', o.updated_at), 'YYYY-MM') AS mes,
              l.resource_code AS recurso_codigo,
              SUM(ol.quantity_offered)::int AS cantidad
       FROM oferta_lotes ol
       JOIN ofertas o ON o.id = ol.oferta_id
       JOIN lotes l ON l.id = ol.lote_id
       WHERE o.status IN ${OFERTAS_VIGENTES}
       GROUP BY 1, 2
       ORDER BY 1, 2`,
    ),
    pool.query(
      `SELECT count(*)::int AS finalizadas,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM ofertas o
                WHERE o.emergency_id = e.id AND o.status IN ${OFERTAS_VIGENTES}
                  AND (SELECT count(*) FROM oferta_ongs oo WHERE oo.oferta_id = o.id) >= 2
              ))::int AS con_consorcio
       FROM emergencies e WHERE e.status = 'finalizada'`,
    ),
    pool.query(
      `SELECT id, type, severity, province, municipality, status, created_at
       FROM emergencies ORDER BY created_at DESC`,
    ),
    pool.query(
      `SELECT l.id, l.quantity_requested,
              LEAST(COALESCE(SUM(ol.quantity_offered) FILTER (
                WHERE o.status IN ${OFERTAS_VIGENTES}), 0), l.quantity_requested) AS cubierta
       FROM lotes l
       LEFT JOIN oferta_lotes ol ON ol.lote_id = l.id
       LEFT JOIN ofertas o ON o.id = ol.oferta_id
       GROUP BY l.id`,
    ),
  ]);

  const { finalizadas, con_consorcio: conConsorcio } = consorcios.rows[0];
  const porEstado = new Map();
  estados.rows.forEach((row) => {
    const entry = porEstado.get(row.status) ?? { estado: row.status, cantidad: 0, emergencias: [] };
    entry.cantidad += 1;
    entry.emergencias.push({
      id: row.id,
      type: row.type,
      severity: row.severity,
      province: row.province,
      municipality: row.municipality,
      createdAt: row.created_at.toISOString(),
    });
    porEstado.set(row.status, entry);
  });
  const ratios = cobertura.rows.map((row) => Number(row.cubierta) / row.quantity_requested);

  return {
    suministrosMovilizados: suministros.rows.map((row) => ({
      mes: row.mes,
      recursoCodigo: row.recurso_codigo,
      cantidad: row.cantidad,
    })),
    resolucionConsorcios: {
      emergenciasFinalizadas: finalizadas,
      conConsorcio,
      porcentaje: finalizadas === 0 ? 0 : round1((conConsorcio / finalizadas) * 100),
    },
    estadoProyectos: [...porEstado.values()],
    coberturaLotes: {
      lotes: ratios.length,
      promedioPorcentaje: ratios.length
        ? round1((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100)
        : 0,
    },
  };
}
