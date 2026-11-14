import pool from '../db.js';

// Ofertas que cuentan como "movilizadas": ya adjudicadas o con la emergencia finalizada.
const OFERTAS_VIGENTES = "('adjudicada', 'finalizada')";

// Emergencias dadas de alta en el período (día de Argentina, límites inclusivos). $1 = desde,
// $2 = hasta; null = sin límite. `col` es la columna con el id de la emergencia.
const EN_PERIODO = (col) => `${col} IN (
  SELECT pe.id FROM emergencies pe
  WHERE ($1::date IS NULL OR (pe.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= $1::date)
    AND ($2::date IS NULL OR (pe.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= $2::date))`;

const round1 = (n) => Math.round(Number(n) * 10) / 10;

// Indicadores del dashboard con datos propios (roadmapfase5.md 5.5).
// El mes de un suministro es el de `adjudicaciones.created_at`. Una oferta adjudicada/finalizada
// tiene una sola fila (UNIQUE emergency_id+oferta_id) y ya no se borra tras confirmar el compromiso;
// si hubiera varias, se usaría la más reciente (MAX).
export async function getIndicadores({ desde = null, hasta = null } = {}) {
  const params = [desde, hasta];
  const [suministros, consorcios, estados, cobertura] = await Promise.all([
    pool.query(
      `SELECT to_char(date_trunc('month', a.adjudicada_at), 'YYYY-MM') AS mes,
              l.resource_code AS recurso_codigo,
              SUM(ol.quantity_offered)::int AS cantidad
       FROM oferta_lotes ol
       JOIN ofertas o ON o.id = ol.oferta_id
       JOIN (
         SELECT oferta_id, MAX(created_at) AS adjudicada_at FROM adjudicaciones GROUP BY oferta_id
       ) a ON a.oferta_id = o.id
       JOIN lotes l ON l.id = ol.lote_id
       WHERE o.status IN ${OFERTAS_VIGENTES} AND ${EN_PERIODO('o.emergency_id')}
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS finalizadas,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM ofertas o
                WHERE o.emergency_id = e.id AND o.status IN ${OFERTAS_VIGENTES}
                  AND (SELECT count(*) FROM oferta_ongs oo WHERE oo.oferta_id = o.id) >= 2
              ))::int AS con_consorcio
       FROM emergencies e WHERE e.status = 'finalizada' AND ${EN_PERIODO('e.id')}`,
      params,
    ),
    pool.query(
      `SELECT id, type, severity, province, municipality, status, created_at
       FROM emergencies e WHERE ${EN_PERIODO('e.id')} ORDER BY created_at DESC`,
      params,
    ),
    pool.query(
      `SELECT l.id, l.quantity_requested,
              LEAST(COALESCE(SUM(ol.quantity_offered) FILTER (
                WHERE o.status IN ${OFERTAS_VIGENTES}), 0), l.quantity_requested) AS cubierta
       FROM lotes l
       LEFT JOIN oferta_lotes ol ON ol.lote_id = l.id
       LEFT JOIN ofertas o ON o.id = ol.oferta_id
       WHERE ${EN_PERIODO('l.emergency_id')}
       GROUP BY l.id`,
      params,
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
    periodo: { desde, hasta },
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

// Tipo de emergencia de cada caso de Bonita: Map caseId (string) → type. Los casos sin
// emergencia en la base no aparecen.
export async function getTiposPorCaso(caseIds) {
  const { rows } = await pool.query(
    'SELECT bonita_case_id, type FROM emergencies WHERE bonita_case_id = ANY($1)',
    [caseIds.map(String)],
  );
  return new Map(rows.map((row) => [row.bonita_case_id, row.type]));
}
