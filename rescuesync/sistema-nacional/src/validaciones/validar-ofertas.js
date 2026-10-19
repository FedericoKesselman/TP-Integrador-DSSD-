import { withTransaction } from '../db.js';
import { claveStock, evaluarPedido } from './competencia.js';

const sinRepetidos = (valores) => [...new Set(valores)];

// POST /validaciones: lee el stock de las ONGs de las ofertas y devuelve el
// perfil de cada una. NO reserva nada: solo bloquea (FOR UPDATE) las filas de
// stock mientras lee, así el resultado es consistente aunque haya un
// /compromisos o un /cierre en curso (la validación espera a que terminen y
// ve el stock ya actualizado).
//
// Orden de locks del SN (ver docs/api-contracts-sistema-nacional.md): acá
// solo se tocan filas de `ong_recursos`, siempre ORDER BY id, igual que
// /compromisos y /cierre, así dos transacciones nunca se esperan en cruz.
export async function validarOfertas(pedido) {
  const refs = sinRepetidos(pedido.ofertas.flatMap((oferta) => oferta.ongs.map((ong) => ong.ref)));
  const codigos = sinRepetidos(
    pedido.ofertas.flatMap((oferta) => oferta.items.map((item) => item.recursoCodigo)),
  );

  // Sin ofertas no hay nada que leer ni que bloquear.
  if (refs.length === 0) {
    return evaluarPedido(pedido, new Map(), new Map());
  }

  return withTransaction(async (client) => {
    const { rows: ongs } = await client.query(
      'SELECT ref, nivel_operativo FROM ongs WHERE habilitada AND ref = ANY($1::text[])',
      [refs],
    );
    const { rows: stock } = await client.query(
      `SELECT o.ref, r.recurso_codigo, r.cantidad_total - r.cantidad_comprometida AS disponible
         FROM ong_recursos r
         JOIN ongs o ON o.id = r.ong_id
        WHERE o.habilitada AND o.ref = ANY($1::text[]) AND r.recurso_codigo = ANY($2::text[])
        ORDER BY r.id
          FOR UPDATE OF r`,
      [refs, codigos],
    );

    const ongsPorRef = new Map(
      ongs.map((ong) => [ong.ref, { nivelOperativo: ong.nivel_operativo }]),
    );
    const disponible = new Map(
      stock.map((fila) => [claveStock(fila.ref, fila.recurso_codigo), fila.disponible]),
    );
    return evaluarPedido(pedido, ongsPorRef, disponible);
  });
}
