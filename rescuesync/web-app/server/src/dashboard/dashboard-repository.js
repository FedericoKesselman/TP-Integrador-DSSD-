import pool from '../db.js';

// Ofertas que cuentan como "movilizadas": ya adjudicadas o con la emergencia finalizada. Lo
// movilizado es lo que el SN comprometió (`adjudicaciones.reparto`), no lo ofrecido.
const OFERTAS_VIGENTES = "('adjudicada', 'finalizada')";

// Emergencias dadas de alta en el período (día de Argentina, límites inclusivos). $1 = desde,
// $2 = hasta; null = sin límite. `col` es la columna con el id de la emergencia.
const EN_PERIODO = (col) => `${col} IN (
  SELECT pe.id FROM emergencies pe
  WHERE ($1::date IS NULL OR (pe.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= $1::date)
    AND ($2::date IS NULL OR (pe.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= $2::date))`;

// Emergencias con adjudicación lograda: solo ellas cuentan para la cobertura final y los caminos.
const ADJUDICADAS = "('adjudicada', 'en_ejecucion', 'finalizada')";

const round1 = (n) => Math.round(Number(n) * 10) / 10;

// Indicadores del dashboard con datos propios (roadmapfase5.md 5.5).
// El mes de un suministro es el de `adjudicaciones.created_at` (mes de Argentina). Una oferta
// adjudicada/finalizada tiene una sola fila (UNIQUE emergency_id+oferta_id) y ya no se borra
// tras confirmar el compromiso.
export async function getIndicadores({ desde = null, hasta = null } = {}) {
  const params = [desde, hasta];
  const [suministros, consorcios, recursos, estados, cobertura, caminos] = await Promise.all([
    pool.query(
      `SELECT to_char(date_trunc('month', a.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'YYYY-MM') AS mes,
              r->>'recursoCodigo' AS recurso_codigo,
              SUM((r->>'cantidad')::int)::int AS cantidad
       FROM adjudicaciones a
       JOIN ofertas o ON o.id = a.oferta_id
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a.reparto, '[]'::jsonb)) r
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
      `SELECT p.resource_code, p.pedido, COALESCE(m.movilizado, 0) AS movilizado
       FROM (
         SELECT l.emergency_id, l.resource_code, SUM(l.quantity_requested)::int AS pedido
         FROM lotes l JOIN emergencies e ON e.id = l.emergency_id
         WHERE e.status IN ${ADJUDICADAS} AND ${EN_PERIODO('l.emergency_id')}
         GROUP BY 1, 2
       ) p
       LEFT JOIN (
         SELECT a.emergency_id, r->>'recursoCodigo' AS resource_code,
                SUM((r->>'cantidad')::int) AS movilizado
         FROM adjudicaciones a
         JOIN ofertas o ON o.id = a.oferta_id
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a.reparto, '[]'::jsonb)) r
         WHERE o.status IN ${OFERTAS_VIGENTES}
         GROUP BY 1, 2
       ) m USING (emergency_id, resource_code)`,
      params,
    ),
    pool.query(
      `SELECT id, type, severity, province, municipality, status, created_at
       FROM emergencies e WHERE ${EN_PERIODO('e.id')} ORDER BY created_at DESC`,
      params,
    ),
    pool.query(
      `SELECT l.id, l.emergency_id, l.resource_code, l.quantity_requested,
              COALESCE(SUM(ol.quantity_offered) FILTER (
                WHERE o.status IN ${OFERTAS_VIGENTES}), 0) AS movilizado
       FROM lotes l
       LEFT JOIN oferta_lotes ol ON ol.lote_id = l.id
       LEFT JOIN ofertas o ON o.id = ol.oferta_id
       JOIN emergencies e ON e.id = l.emergency_id
       WHERE e.status IN ${ADJUDICADAS} AND ${EN_PERIODO('l.emergency_id')}
       GROUP BY l.id, l.emergency_id`,
      params,
    ),
    pool.query(
      `SELECT
         (SELECT count(*) FROM emergencies e WHERE e.status IN ${ADJUDICADAS} AND ${EN_PERIODO('e.id')}
            AND e.validacion_resumen->>'todosLosLotesCubiertos' = 'true')::int AS todos_cubiertos,
         (SELECT count(*) FROM emergency_decisiones d
          WHERE d.camino = 'continuar' AND ${EN_PERIODO('d.emergency_id')})::int AS continuar,
         (SELECT count(*) FROM emergency_decisiones d
          WHERE d.camino = 'reabrir' AND ${EN_PERIODO('d.emergency_id')})::int AS reabrir,
         (SELECT count(*) FROM emergency_decisiones d
          WHERE d.camino = 'reformular' AND ${EN_PERIODO('d.emergency_id')})::int AS reformular`,
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
  // Una fila por lote (sin fan-out); acá se topa lo cubierto y se agrupa por recurso.
  const ratios = cobertura.rows.map(
    (row) => Math.min(Number(row.movilizado), row.quantity_requested) / row.quantity_requested,
  );
  // Por emergencia y recurso (el reparto del SN no distingue lotes): lo movilizado se topa en lo
  // pedido y se suma por recurso.
  const porRecurso = new Map();
  recursos.rows.forEach((row) => {
    const r = porRecurso.get(row.resource_code) ?? { pedido: 0, movilizado: 0, cubierto: 0 };
    r.pedido += row.pedido;
    r.movilizado += Number(row.movilizado);
    r.cubierto += Math.min(Number(row.movilizado), row.pedido);
    porRecurso.set(row.resource_code, r);
  });

  return {
    periodo: { desde, hasta },
    suministrosMovilizados: suministros.rows.map((row) => ({
      mes: row.mes,
      recursoCodigo: row.recurso_codigo,
      cantidad: row.cantidad,
    })),
    suministrosPorRecurso: [...porRecurso]
      .map(([recursoCodigo, r]) => ({
        recursoCodigo,
        pedido: r.pedido,
        movilizado: r.movilizado,
        porcentajeCubierto: round1((r.cubierto / r.pedido) * 100),
      }))
      .sort(
        (x, y) =>
          x.porcentajeCubierto - y.porcentajeCubierto ||
          (x.recursoCodigo < y.recursoCodigo ? -1 : 1),
      ),
    resolucionConsorcios: {
      emergenciasFinalizadas: finalizadas,
      conConsorcio,
      porcentaje: finalizadas === 0 ? 0 : round1((conConsorcio / finalizadas) * 100),
    },
    estadoProyectos: [...porEstado.values()],
    coberturaLotes: {
      emergencias: new Set(cobertura.rows.map((row) => row.emergency_id)).size,
      lotes: ratios.length,
      promedioPorcentaje: ratios.length
        ? round1((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100)
        : null,
    },
    caminosDecision: {
      todosCubiertos: caminos.rows[0].todos_cubiertos,
      continuar: caminos.rows[0].continuar,
      reabrir: caminos.rows[0].reabrir,
      reformular: caminos.rows[0].reformular,
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
