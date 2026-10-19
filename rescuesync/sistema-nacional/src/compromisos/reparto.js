// Reparto de una oferta entre las ONGs que la componen. Funciones puras: no
// tocan la base, trabajan sobre el stock que ya se leyó y bloqueó.
//
// `stock` es un Map de claveStock(ongRef, recursoCodigo) → { id, disponible }.
// repartirOferta DESCUENTA de ese Map lo que reparte, así la oferta siguiente
// del mismo pedido ve lo que dejó la anterior (el stock se comparte entre
// ofertas: si no alcanza, es un 409 y no se reserva nada).

import { conflict } from '../errors.js';
import { claveStock } from '../validaciones/competencia.js';

const sumar = (valores) => valores.reduce((total, valor) => total + valor, 0);

// La ONG principal primero; después las demás, en el orden recibido.
function ordenarOngs(ongs) {
  return [
    ...ongs.filter((ong) => ong.rol === 'principal'),
    ...ongs.filter((ong) => ong.rol !== 'principal'),
  ];
}

function repartirItem(oferta, item, ongsEnOrden, stock) {
  // Lo que tenía cada ONG antes de repartir: va al detalle del 409.
  const ongs = ongsEnOrden.map((ong) => ({
    ongRef: ong.ref,
    disponible: stock.get(claveStock(ong.ref, item.recursoCodigo))?.disponible ?? 0,
  }));

  const { tomas, falta } = ongsEnOrden.reduce(
    (acumulado, ong) => {
      const entrada = stock.get(claveStock(ong.ref, item.recursoCodigo));
      const toma = Math.min(entrada?.disponible ?? 0, acumulado.falta);
      if (toma === 0) return acumulado;
      entrada.disponible -= toma;
      return {
        tomas: [
          ...acumulado.tomas,
          {
            ongRecursoId: entrada.id,
            ongRef: ong.ref,
            recursoCodigo: item.recursoCodigo,
            cantidad: toma,
          },
        ],
        falta: acumulado.falta - toma,
      };
    },
    { tomas: [], falta: item.cantidad },
  );

  if (falta > 0) {
    throw conflict('No hay stock suficiente para comprometer las ofertas.', {
      ofertaId: oferta.ofertaId,
      recursoCodigo: item.recursoCodigo,
      solicitado: item.cantidad,
      disponible: sumar(ongs.map((ong) => ong.disponible)),
      faltante: falta,
      ongs,
    });
  }
  return tomas;
}

// Devuelve una fila por (ONG, recurso): [{ ongRecursoId, ongRef, recursoCodigo, cantidad }].
// Lanza un 409 (con el detalle de qué recurso y qué ONGs) si algún ítem no alcanza.
export function repartirOferta(oferta, stock) {
  const ongsEnOrden = ordenarOngs(oferta.ongs);
  const tomas = oferta.items.flatMap((item) => repartirItem(oferta, item, ongsEnOrden, stock));

  // Si dos ítems piden el mismo recurso, se unen en una sola fila por ONG.
  const porStock = tomas.reduce((mapa, toma) => {
    const previa = mapa.get(toma.ongRecursoId);
    mapa.set(
      toma.ongRecursoId,
      previa ? { ...previa, cantidad: previa.cantidad + toma.cantidad } : toma,
    );
    return mapa;
  }, new Map());
  return [...porStock.values()];
}
