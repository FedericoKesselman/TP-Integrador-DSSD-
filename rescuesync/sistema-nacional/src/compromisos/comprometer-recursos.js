// POST /compromisos: reserva los recursos de las ofertas adjudicadas.


// Todo pasa dentro de una transacción (withTransaction):

import { withTransaction } from '../db.js';
import { conflict } from '../errors.js';

/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
// (el linter del proyecto prohíbe `for` con `await` y `continue`; acá los usamos
//  a propósito porque cada paso tiene que esperar al anterior y se lee más fácil)

export async function comprometerRecursos(emergenciaId, ofertas) {
  return withTransaction(async (client) => {
    const compromisos = [];

    for (const oferta of ofertas) {
      // 1) Si esta oferta ya se comprometió antes (Bonita reintentó), no reservar de nuevo.
      const yaExiste = await client.query(
        'SELECT id FROM compromisos WHERE emergencia_id = $1 AND oferta_id = $2',
        [emergenciaId, oferta.ofertaId],
      );
      if (yaExiste.rows.length > 0) {
        compromisos.push({
          compromisoId: yaExiste.rows[0].id,
          ofertaId: oferta.ofertaId,
          yaExistia: true,
        });
        continue;
      }

      // 2) Crear el compromiso de la oferta.
      const nuevo = await client.query(
        'INSERT INTO compromisos (emergencia_id, oferta_id) VALUES ($1, $2) RETURNING id',
        [emergenciaId, oferta.ofertaId],
      );
      const compromisoId = nuevo.rows[0].id;
      const reparto = [];

      // La ONG principal primero, después las asociadas (consorcio).
      const principal = oferta.ongs.filter((ong) => ong.rol === 'principal');
      const asociadas = oferta.ongs.filter((ong) => ong.rol !== 'principal');
      const ongsEnOrden = [...principal, ...asociadas];

      // 3) Para cada recurso pedido, sacarlo del stock de las ONGs hasta completar.
      for (const item of oferta.items) {
        let falta = item.cantidad;

        for (const ong of ongsEnOrden) {
          if (falta === 0) break;

          // Leer cuánto le queda libre a esta ONG de este recurso y BLOQUEAR la fila
          // (FOR UPDATE): si otra emergencia quiere esta misma fila, espera a que terminemos.
          const stock = await client.query(
            `SELECT r.id, r.cantidad_total - r.cantidad_comprometida AS disponible
               FROM ong_recursos r
               JOIN ongs o ON o.id = r.ong_id
              WHERE o.ref = $1 AND r.recurso_codigo = $2 AND o.habilitada
                FOR UPDATE OF r`,
            [ong.ref, item.recursoCodigo],
          );
          if (stock.rows.length === 0) continue; // esta ONG no tiene ese recurso

          const { id, disponible } = stock.rows[0];
          const toma = Math.min(disponible, falta);
          if (toma === 0) continue; // no le queda nada libre

          // Reservar: sumar a lo comprometido y anotar qué ONG puso cuánto.
          await client.query(
            'UPDATE ong_recursos SET cantidad_comprometida = cantidad_comprometida + $1 WHERE id = $2',
            [toma, id],
          );
          await client.query(
            'INSERT INTO compromiso_items (compromiso_id, ong_recurso_id, cantidad) VALUES ($1, $2, $3)',
            [compromisoId, id, toma],
          );
          reparto.push({ ongRef: ong.ref, recursoCodigo: item.recursoCodigo, cantidad: toma });
          falta -= toma;
        }

        // 4) Si con todas las ONGs no alcanzó: error 409.
        //    Esto corta la transacción y se deshace TODO lo reservado hasta acá.
        if (falta > 0) {
          throw conflict('No hay stock suficiente para comprometer las ofertas.', {
            ofertaId: oferta.ofertaId,
            recursoCodigo: item.recursoCodigo,
            faltante: falta,
          });
        }
      }

      compromisos.push({ compromisoId, ofertaId: oferta.ofertaId, reparto });
    }

    return { emergenciaId, compromisos };
  });
}
