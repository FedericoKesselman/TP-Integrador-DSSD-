import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateCompromisoRequest } from '../src/compromisos/compromiso-input.js';
import { repartirOferta } from '../src/compromisos/reparto.js';
import { claveStock } from '../src/validaciones/competencia.js';

// Pruebas unitarias (sin base de datos) del reparto de /compromisos y de la
// validación de su body.

const OFERTA_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

// filas: [ongRef, recursoCodigo, id, disponible]
const crearStock = (filas) =>
  new Map(
    filas.map(([ref, recurso, id, disponible]) => [claveStock(ref, recurso), { id, disponible }]),
  );

const oferta = (ongs, items) => ({ ofertaId: OFERTA_ID, ongs, items });
const paramedicos = (cantidad) => ({ recursoCodigo: 'paramedicos', cantidad });

describe('repartirOferta', () => {
  it('toma primero de la principal y completa con las asociadas', () => {
    const stock = crearStock([
      ['a', 'paramedicos', 1, 3],
      ['b', 'paramedicos', 2, 4],
    ]);
    const reparto = repartirOferta(
      oferta(
        [
          { ref: 'a', rol: 'apoyo' },
          { ref: 'b', rol: 'principal' },
        ],
        [paramedicos(5)],
      ),
      stock,
    );
    assert.deepEqual(reparto, [
      { ongRecursoId: 2, ongRef: 'b', recursoCodigo: 'paramedicos', cantidad: 4 },
      { ongRecursoId: 1, ongRef: 'a', recursoCodigo: 'paramedicos', cantidad: 1 },
    ]);
    // El reparto descuenta del stock en memoria.
    assert.equal(stock.get(claveStock('b', 'paramedicos')).disponible, 0);
    assert.equal(stock.get(claveStock('a', 'paramedicos')).disponible, 2);
  });

  it('una ONG sin ese recurso no aporta y no rompe el reparto', () => {
    const stock = crearStock([['b', 'paramedicos', 2, 2]]);
    const reparto = repartirOferta(
      oferta(
        [
          { ref: 'a', rol: 'principal' },
          { ref: 'b', rol: 'apoyo' },
        ],
        [paramedicos(2)],
      ),
      stock,
    );
    assert.deepEqual(reparto, [
      { ongRecursoId: 2, ongRef: 'b', recursoCodigo: 'paramedicos', cantidad: 2 },
    ]);
  });

  it('dos ítems del mismo recurso se unen en una fila por ONG', () => {
    const stock = crearStock([['a', 'paramedicos', 1, 5]]);
    const reparto = repartirOferta(
      oferta([{ ref: 'a', rol: 'principal' }], [paramedicos(2), paramedicos(1)]),
      stock,
    );
    assert.deepEqual(reparto, [
      { ongRecursoId: 1, ongRef: 'a', recursoCodigo: 'paramedicos', cantidad: 3 },
    ]);
  });

  it('la oferta siguiente ve lo que dejó la anterior (el stock se comparte)', () => {
    const stock = crearStock([['a', 'paramedicos', 1, 4]]);
    const ongs = [{ ref: 'a', rol: 'principal' }];
    repartirOferta(oferta(ongs, [paramedicos(3)]), stock);

    assert.throws(
      () => repartirOferta(oferta(ongs, [paramedicos(3)]), stock),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.detalle.disponible, 1);
        assert.equal(error.detalle.faltante, 2);
        return true;
      },
    );
  });

  it('el 409 dice qué recurso falta y qué disponible tenía cada ONG', () => {
    const stock = crearStock([
      ['a', 'paramedicos', 1, 2],
      ['b', 'paramedicos', 2, 1],
    ]);
    assert.throws(
      () =>
        repartirOferta(
          oferta(
            [
              { ref: 'a', rol: 'principal' },
              { ref: 'b', rol: 'apoyo' },
              { ref: 'no-existe', rol: 'apoyo' },
            ],
            [paramedicos(5)],
          ),
          stock,
        ),
      (error) => {
        assert.equal(error.status, 409);
        assert.deepEqual(error.detalle, {
          ofertaId: OFERTA_ID,
          recursoCodigo: 'paramedicos',
          solicitado: 5,
          disponible: 3,
          faltante: 2,
          ongs: [
            { ongRef: 'a', disponible: 2 },
            { ongRef: 'b', disponible: 1 },
            { ongRef: 'no-existe', disponible: 0 },
          ],
        });
        return true;
      },
    );
  });
});

describe('validateCompromisoRequest', () => {
  const valido = () => ({
    emergenciaId: '3f2b8c1e-7a4d-4e2b-9c1a-5d6e7f8a9b0c',
    ofertas: [
      {
        ofertaId: OFERTA_ID,
        ongs: [{ ref: 'rescatistas-unidos', rol: 'principal' }],
        items: [{ recursoCodigo: 'paramedicos', cantidad: 3 }],
      },
    ],
  });

  it('acepta un pedido válido', () => {
    assert.deepEqual(validateCompromisoRequest(valido()), {});
  });

  it('rechaza un body que no es un objeto', () => {
    assert.ok(validateCompromisoRequest(null).body);
    assert.ok(validateCompromisoRequest([]).body);
  });

  it('marca la cabecera inválida y las ofertas vacías', () => {
    const errors = validateCompromisoRequest({ emergenciaId: 'x', ofertas: [] });
    assert.ok(errors.emergenciaId);
    assert.ok(errors.ofertas);
  });

  it('marca una oferta sin ongs ni ítems en vez de romper', () => {
    const pedido = valido();
    pedido.ofertas = [{ ofertaId: OFERTA_ID }];
    const errors = validateCompromisoRequest(pedido);
    assert.ok(errors['ofertas[0].ongs']);
    assert.ok(errors['ofertas[0].items']);
  });

  it('marca ofertas que no son objetos y ofertaId repetido o inválido', () => {
    const pedido = valido();
    pedido.ofertas.push({ ...pedido.ofertas[0] }, 'texto', { ...pedido.ofertas[0], ofertaId: 'x' });
    const errors = validateCompromisoRequest(pedido);
    assert.ok(errors['ofertas[1].ofertaId']);
    assert.ok(errors['ofertas[2]']);
    assert.ok(errors['ofertas[3].ofertaId']);
  });

  it('marca cantidades que no son enteros positivos y recursos sin código', () => {
    const pedido = valido();
    pedido.ofertas[0].items = [
      { recursoCodigo: 'paramedicos', cantidad: 0 },
      { recursoCodigo: 'botes', cantidad: 1.5 },
      { recursoCodigo: '', cantidad: 2 },
      'texto',
    ];
    const errors = validateCompromisoRequest(pedido);
    assert.ok(errors['ofertas[0].items[0].cantidad']);
    assert.ok(errors['ofertas[0].items[1].cantidad']);
    assert.ok(errors['ofertas[0].items[2].recursoCodigo']);
    assert.ok(errors['ofertas[0].items[3]']);
  });

  it('marca ONGs repetidas, con ref inválido o con un rol que no existe', () => {
    const pedido = valido();
    pedido.ofertas[0].ongs = [
      { ref: 'a', rol: 'principal' },
      { ref: 'a', rol: 'apoyo' },
      { ref: 'Con Mayúsculas', rol: 'principal' },
      { ref: 'b', rol: 'jefe' },
    ];
    const errors = validateCompromisoRequest(pedido);
    assert.ok(errors['ofertas[0].ongs[1].ref']);
    assert.ok(errors['ofertas[0].ongs[2].ref']);
    assert.ok(errors['ofertas[0].ongs[3].rol']);
  });
});
