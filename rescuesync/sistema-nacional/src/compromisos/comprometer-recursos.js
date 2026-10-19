// POST /compromisos: reserva el stock de las ofertas adjudicadas.
//
// Todo ocurre en UNA transacción (withTransaction) y con este orden de locks,
// el mismo que usa el cierre, para que dos transacciones nunca se esperen en cruz:
//   1) filas de `compromisos` (se insertan todas juntas, ordenadas por oferta_id);
//   2) filas de `ong_recursos` de todas las ONGs del pedido, en UN solo
//      `SELECT ... ORDER BY id FOR UPDATE` (nunca de a una ni en el orden del pedido).
// Con el stock bloqueado, el reparto se calcula en memoria (reparto.js) y se
// escribe de una vez. Si algo no alcanza, repartirOferta lanza un 409 y el
// ROLLBACK deshace todo: es todo o nada.
//
// Idempotente por (emergenciaId, ofertaId): una oferta ya comprometida no se
// reserva de nuevo y se devuelve con `yaExistia: true` y su reparto original.

import { withTransaction } from '../db.js';
import { claveStock } from '../validaciones/competencia.js';
import { repartirOferta } from './reparto.js';

// Postgres devuelve los UUID en minúsculas; el pedido puede traerlos en mayúsculas.
const claveOferta = (ofertaId) => ofertaId.toLowerCase();

const formatearReparto = (filas) =>
  filas
    .map(({ ongRef, recursoCodigo, cantidad }) => ({ ongRef, recursoCodigo, cantidad }))
    .sort(
      (a, b) => a.ongRef.localeCompare(b.ongRef) || a.recursoCodigo.localeCompare(b.recursoCodigo),
    );

// Crea los compromisos que no existían. Si otra transacción está creando la
// misma oferta, el INSERT espera a que termine (y, si commitea, no inserta).
// Devuelve Map claveOferta → compromisoId solo de los NUEVOS.
async function crearCompromisos(client, emergenciaId, ofertas) {
  const { rows } = await client.query(
    `INSERT INTO compromisos (emergencia_id, oferta_id)
     SELECT $1::uuid, t.oferta_id
       FROM unnest($2::uuid[]) AS t(oferta_id)
      ORDER BY t.oferta_id
     ON CONFLICT (emergencia_id, oferta_id) DO NOTHING
     RETURNING id, oferta_id`,
    [emergenciaId, ofertas.map((oferta) => oferta.ofertaId)],
  );
  return new Map(rows.map((row) => [claveOferta(row.oferta_id), row.id]));
}

// Lee y bloquea el stock de todas las ONGs y recursos de las ofertas nuevas.
async function bloquearStock(client, ofertas) {
  const refs = [...new Set(ofertas.flatMap((oferta) => oferta.ongs.map((ong) => ong.ref)))];
  const codigos = [
    ...new Set(ofertas.flatMap((oferta) => oferta.items.map((i) => i.recursoCodigo))),
  ];
  if (refs.length === 0) return new Map();

  const { rows } = await client.query(
    `SELECT r.id, o.ref, r.recurso_codigo,
            r.cantidad_total - r.cantidad_comprometida AS disponible
       FROM ong_recursos r
       JOIN ongs o ON o.id = r.ong_id
      WHERE o.habilitada AND o.ref = ANY($1::text[]) AND r.recurso_codigo = ANY($2::text[])
      ORDER BY r.id
        FOR UPDATE OF r`,
    [refs, codigos],
  );
  return new Map(
    rows.map((row) => [
      claveStock(row.ref, row.recurso_codigo),
      { id: row.id, disponible: row.disponible },
    ]),
  );
}

// Anota el reparto de cada compromiso y suma lo comprometido en el stock.
async function guardarReservas(client, filas) {
  if (filas.length === 0) return;
  await client.query(
    `INSERT INTO compromiso_items (compromiso_id, ong_recurso_id, cantidad)
     SELECT * FROM unnest($1::uuid[], $2::bigint[], $3::int[])`,
    [
      filas.map((fila) => fila.compromisoId),
      filas.map((fila) => fila.ongRecursoId),
      filas.map((fila) => fila.cantidad),
    ],
  );
  await client.query(
    `WITH toma AS (
       SELECT t.ong_recurso_id, SUM(t.cantidad)::int AS cantidad
         FROM unnest($1::bigint[], $2::int[]) AS t(ong_recurso_id, cantidad)
        GROUP BY t.ong_recurso_id)
     UPDATE ong_recursos r
        SET cantidad_comprometida = r.cantidad_comprometida + toma.cantidad
       FROM toma
      WHERE r.id = toma.ong_recurso_id`,
    [filas.map((fila) => fila.ongRecursoId), filas.map((fila) => fila.cantidad)],
  );
}

// Compromisos que ya estaban: su id, su estado y el reparto con el que se hicieron.
async function leerExistentes(client, emergenciaId, ofertas) {
  if (ofertas.length === 0) return new Map();
  const { rows } = await client.query(
    `SELECT c.id, c.oferta_id, c.estado, o.ref AS ong_ref, r.recurso_codigo,
            SUM(i.cantidad)::int AS cantidad
       FROM compromisos c
       LEFT JOIN compromiso_items i ON i.compromiso_id = c.id
       LEFT JOIN ong_recursos r ON r.id = i.ong_recurso_id
       LEFT JOIN ongs o ON o.id = r.ong_id
      WHERE c.emergencia_id = $1::uuid AND c.oferta_id = ANY($2::uuid[])
      GROUP BY c.id, c.oferta_id, c.estado, o.ref, r.recurso_codigo`,
    [emergenciaId, ofertas.map((oferta) => oferta.ofertaId)],
  );
  return rows.reduce((mapa, row) => {
    const clave = claveOferta(row.oferta_id);
    const actual = mapa.get(clave) ?? { compromisoId: row.id, estado: row.estado, reparto: [] };
    if (row.ong_ref) {
      actual.reparto.push({
        ongRef: row.ong_ref,
        recursoCodigo: row.recurso_codigo,
        cantidad: row.cantidad,
      });
    }
    mapa.set(clave, actual);
    return mapa;
  }, new Map());
}

export async function comprometerRecursos(emergenciaId, ofertas) {
  return withTransaction(async (client) => {
    const idsNuevos = await crearCompromisos(client, emergenciaId, ofertas);
    const nuevas = ofertas.filter((oferta) => idsNuevos.has(claveOferta(oferta.ofertaId)));
    const previas = ofertas.filter((oferta) => !idsNuevos.has(claveOferta(oferta.ofertaId)));

    const stock = await bloquearStock(client, nuevas);
    const repartos = new Map(
      nuevas.map((oferta) => [claveOferta(oferta.ofertaId), repartirOferta(oferta, stock)]),
    );
    await guardarReservas(
      client,
      nuevas.flatMap((oferta) => {
        const clave = claveOferta(oferta.ofertaId);
        return repartos.get(clave).map((toma) => ({
          compromisoId: idsNuevos.get(clave),
          ongRecursoId: toma.ongRecursoId,
          cantidad: toma.cantidad,
        }));
      }),
    );
    const existentes = await leerExistentes(client, emergenciaId, previas);

    const compromisos = ofertas.map((oferta) => {
      const clave = claveOferta(oferta.ofertaId);
      if (idsNuevos.has(clave)) {
        return {
          compromisoId: idsNuevos.get(clave),
          ofertaId: oferta.ofertaId,
          reparto: formatearReparto(repartos.get(clave)),
          estado: 'activo',
          yaExistia: false,
        };
      }
      const previo = existentes.get(clave);
      return {
        compromisoId: previo.compromisoId,
        ofertaId: oferta.ofertaId,
        reparto: formatearReparto(previo.reparto),
        estado: previo.estado,
        yaExistia: true,
      };
    });
    return { emergenciaId, compromisos };
  });
}
