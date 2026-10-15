import bcrypt from 'bcryptjs';

import pool, { withTransaction } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';

const UNIQUE_VIOLATION = '23505';

const toOng = (row) => ({
  ref: row.ref,
  nombre: row.nombre,
  nivelOperativo: row.nivel_operativo,
  habilitada: row.habilitada,
});

const toRecursoOng = (row) => ({
  recursoCodigo: row.recurso_codigo,
  nombre: row.nombre,
  unidad: row.unidad,
  cantidadTotal: row.cantidad_total,
  cantidadComprometida: row.cantidad_comprometida,
  cantidadDisponible: row.cantidad_total - row.cantidad_comprometida,
});

// 400 si algún código no está en recursos_catalogo.
async function assertCodigosExisten(db, items) {
  const codigos = items.map((item) => item.recursoCodigo);
  if (codigos.length === 0) return;
  const { rows } = await db.query(
    'SELECT codigo FROM recursos_catalogo WHERE codigo = ANY($1::text[])',
    [codigos],
  );
  const conocidos = new Set(rows.map((row) => row.codigo));
  const desconocidos = codigos.filter((codigo) => !conocidos.has(codigo));
  if (desconocidos.length > 0) {
    throw badRequest('Hay códigos de recurso que no existen en el catálogo.', {
      recursosDesconocidos: desconocidos,
    });
  }
}

// Inserta o actualiza cantidad_total; no toca cantidad_comprometida.
async function upsertStockRows(db, ongId, items) {
  if (items.length === 0) return;
  await db.query(
    `INSERT INTO ong_recursos (ong_id, recurso_codigo, cantidad_total)
     SELECT $1, item.codigo, item.total
       FROM unnest($2::text[], $3::int[]) AS item (codigo, total)
     ON CONFLICT (ong_id, recurso_codigo)
     DO UPDATE SET cantidad_total = EXCLUDED.cantidad_total`,
    [ongId, items.map((item) => item.recursoCodigo), items.map((item) => item.cantidadTotal)],
  );
}

async function selectStock(db, ongId) {
  const { rows } = await db.query(
    `SELECT r.recurso_codigo, c.nombre, c.unidad, r.cantidad_total, r.cantidad_comprometida
       FROM ong_recursos r
       JOIN recursos_catalogo c ON c.codigo = r.recurso_codigo
      WHERE r.ong_id = $1
      ORDER BY c.categoria, c.codigo`,
    [ongId],
  );
  return rows.map(toRecursoOng);
}

async function findOngIdByRef(db, ref) {
  const { rows } = await db.query('SELECT id FROM ongs WHERE ref = $1', [ref]);
  if (rows.length === 0) throw notFound(`No existe la ONG "${ref}".`);
  return rows[0].id;
}

// POST /ongs: ONG habilitada + su cuenta (rol ong) + stock inicial, todo o nada.
export async function createOng({
  ref,
  nombre,
  nivelOperativo,
  username,
  password,
  recursos = [],
}) {
  const passwordHash = await bcrypt.hash(password, 10);
  return withTransaction(async (client) => {
    await assertCodigosExisten(client, recursos);
    try {
      const { rows } = await client.query(
        `INSERT INTO ongs (ref, nombre, nivel_operativo) VALUES ($1, $2, $3)
         RETURNING id, ref, nombre, nivel_operativo, habilitada`,
        [ref, nombre.trim(), nivelOperativo],
      );
      const ong = rows[0];
      await client.query(
        `INSERT INTO api_clients (username, password_hash, role, ong_id)
         VALUES ($1, $2, 'ong', $3)`,
        [username, passwordHash, ong.id],
      );
      await upsertStockRows(client, ong.id, recursos);
      return { ...toOng(ong), username, recursos: await selectStock(client, ong.id) };
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        const campo = error.constraint?.startsWith('api_clients') ? 'username' : 'ref';
        throw conflict(
          `Ya existe una ${campo === 'ref' ? 'ONG con ese ref' : 'cuenta con ese username'}.`,
          {
            campo,
          },
        );
      }
      throw error;
    }
  });
}

// GET /ongs: solo habilitadas.
export async function listOngsHabilitadas() {
  const { rows } = await pool.query(
    `SELECT ref, nombre, nivel_operativo, habilitada FROM ongs WHERE habilitada ORDER BY nombre`,
  );
  return rows.map(toOng);
}

// GET /ongs/:ref/recursos
export async function getStockByRef(ref) {
  const ongId = await findOngIdByRef(pool, ref);
  return selectStock(pool, ongId);
}

// PUT /ongs/:ref/recursos: alta/actualización de los recursos enviados (los
// no enviados quedan como estaban). Bloquea las filas existentes en orden
// por id para que una reserva concurrente (Pista B) no quede por encima del
// nuevo total; si quedaría, 409 y no se cambia nada.
export async function upsertStockByRef(ref, items) {
  return withTransaction(async (client) => {
    const ongId = await findOngIdByRef(client, ref);
    await assertCodigosExisten(client, items);
    const { rows: actuales } = await client.query(
      `SELECT recurso_codigo, cantidad_comprometida
         FROM ong_recursos
        WHERE ong_id = $1 AND recurso_codigo = ANY($2::text[])
        ORDER BY id
          FOR UPDATE`,
      [ongId, items.map((item) => item.recursoCodigo)],
    );
    const comprometido = new Map(
      actuales.map((row) => [row.recurso_codigo, row.cantidad_comprometida]),
    );
    const insuficientes = items
      .filter((item) => item.cantidadTotal < (comprometido.get(item.recursoCodigo) ?? 0))
      .map((item) => ({
        recursoCodigo: item.recursoCodigo,
        cantidadTotal: item.cantidadTotal,
        cantidadComprometida: comprometido.get(item.recursoCodigo),
      }));
    if (insuficientes.length > 0) {
      throw conflict('El nuevo total no puede ser menor a lo ya comprometido.', { insuficientes });
    }
    await upsertStockRows(client, ongId, items);
    return selectStock(client, ongId);
  });
}

// GET /recursos/disponibilidad: suma por recurso entre las ONGs habilitadas.
// Incluye todo el catálogo (con 0 si nadie lo tiene).
export async function getDisponibilidadGlobal() {
  const { rows } = await pool.query(
    `SELECT c.codigo AS recurso_codigo, c.nombre, c.unidad, c.categoria,
            COALESCE(SUM(r.cantidad_total), 0)::int AS cantidad_total,
            COALESCE(SUM(r.cantidad_comprometida), 0)::int AS cantidad_comprometida,
            COUNT(r.id) FILTER (WHERE r.cantidad_total > r.cantidad_comprometida)::int
              AS ongs_con_disponible
       FROM recursos_catalogo c
       LEFT JOIN ong_recursos r
              ON r.recurso_codigo = c.codigo
             AND r.ong_id IN (SELECT id FROM ongs WHERE habilitada)
      GROUP BY c.codigo
      ORDER BY c.categoria, c.codigo`,
  );
  return rows.map((row) => ({
    ...toRecursoOng(row),
    categoria: row.categoria,
    ongsConDisponible: row.ongs_con_disponible,
  }));
}
