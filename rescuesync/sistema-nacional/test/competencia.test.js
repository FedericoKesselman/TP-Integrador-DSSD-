import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { claveStock, evaluarPedido, nivelDeHabilitacion } from '../src/validaciones/competencia.js';
import { validateValidacionRequest } from '../src/validaciones/validacion-input.js';

// Tests unitarios de E3-21: el algoritmo de competencia y la validación del
// body. No necesitan Postgres (el algoritmo recibe el stock ya leído).

const EMERGENCIA = '3f2b8c1e-7a4d-4e2b-9c1a-5d6e7f8a9b0c';
const LOTE_A = '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const LOTE_B = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e';
const PARAMEDICOS = { id: LOTE_A, recursoCodigo: 'paramedicos', cantidadSolicitada: 5 };
const RACIONES = { id: LOTE_B, recursoCodigo: 'raciones', cantidadSolicitada: 10 };

const ofertaId = (n) => `a1b2c3d4-e5f6-4a7b-8c9d-${String(n).padStart(12, '0')}`;
const pedido = (ofertas, { lotes = [PARAMEDICOS], severidad = 'alta' } = {}) => ({
  emergenciaId: EMERGENCIA,
  severidad,
  lotes,
  ofertas,
});
const oferta = (n, ongs, items) => ({ ofertaId: ofertaId(n), ongs, items });
const principal = (ref) => ({ ref, rol: 'principal' });
const apoyo = (ref) => ({ ref, rol: 'apoyo' });
const item = (cantidadOfrecida, loteId = LOTE_A, recursoCodigo = 'paramedicos') => ({
  loteId,
  recursoCodigo,
  cantidadOfrecida,
});

// { ref: nivelOperativo } → Map que arma validar-ofertas.js desde la tabla ongs.
const ongs = (niveles) =>
  new Map(Object.entries(niveles).map(([ref, nivelOperativo]) => [ref, { nivelOperativo }]));
// [[ref, recurso, disponible], ...] → Map de stock disponible.
const stock = (filas) =>
  new Map(filas.map(([ref, codigo, cantidad]) => [claveStock(ref, codigo), cantidad]));
const evaluar = (unPedido, niveles, filas) => evaluarPedido(unPedido, ongs(niveles), stock(filas));

const mencionan = (observaciones, texto) =>
  observaciones.some((observacion) => observacion.includes(texto));

describe('nivelDeHabilitacion', () => {
  it('aplica los cortes del contrato', () => {
    assert.equal(nivelDeHabilitacion(1), 'PLENO');
    assert.equal(nivelDeHabilitacion(0.75), 'PARCIAL');
    assert.equal(nivelDeHabilitacion(0.5), 'PARCIAL');
    assert.equal(nivelDeHabilitacion(0.49), 'APOYO');
    assert.equal(nivelDeHabilitacion(0.01), 'APOYO');
    assert.equal(nivelDeHabilitacion(0), 'SIN_CAPACIDAD');
  });

  it('tolera el redondeo de los decimales en los cortes', () => {
    assert.equal(nivelDeHabilitacion(1 - 1e-12), 'PLENO');
    assert.equal(nivelDeHabilitacion(0.5 - 1e-12), 'PARCIAL');
  });
});

describe('evaluarPedido — perfil de cada oferta', () => {
  it('PLENO: todo lo ofrecido está disponible', () => {
    const resultado = evaluar(pedido([oferta(1, [principal('ru')], [item(3)])]), { ru: 4 }, [
      ['ru', 'paramedicos', 5],
    ]);
    const [perfil] = resultado.resultados;
    assert.equal(perfil.ofertaId, ofertaId(1));
    assert.equal(perfil.nivelHabilitacion, 'PLENO');
    assert.equal(perfil.rolSugerido, 'principal');
    assert.equal(perfil.nivelRiesgoPermitido, 'critica');
    assert.deepEqual(perfil.capacidadesHabilitadas, [
      { loteId: LOTE_A, recursoCodigo: 'paramedicos', cantidadHabilitada: 3, cantidadOfrecida: 3 },
    ]);
    assert.deepEqual(resultado.resumen.cobertura, [{ loteId: LOTE_A, solicitada: 5, cubierta: 3 }]);
    assert.equal(resultado.resumen.todosLosLotesCubiertos, false);
  });

  it('PARCIAL: la mitad o más (riesgo tope: alta)', () => {
    const [perfil] = evaluar(pedido([oferta(1, [principal('ru')], [item(4)])]), { ru: 4 }, [
      ['ru', 'paramedicos', 2],
    ]).resultados;
    assert.equal(perfil.nivelHabilitacion, 'PARCIAL');
    assert.equal(perfil.rolSugerido, 'principal');
    assert.equal(perfil.nivelRiesgoPermitido, 'alta');
    assert.equal(perfil.capacidadesHabilitadas[0].cantidadHabilitada, 2);
    assert.ok(mencionan(perfil.observaciones, 'Solo se habilitan 2 de 4'));
  });

  it('APOYO: menos de la mitad (riesgo tope: media) y avisa si no alcanza la severidad', () => {
    const [perfil] = evaluar(pedido([oferta(1, [principal('ru')], [item(10)])]), { ru: 4 }, [
      ['ru', 'paramedicos', 2],
    ]).resultados;
    assert.equal(perfil.nivelHabilitacion, 'APOYO');
    assert.equal(perfil.rolSugerido, 'apoyo');
    assert.equal(perfil.nivelRiesgoPermitido, 'media');
    assert.ok(mencionan(perfil.observaciones, 'severidad'));
  });

  it('SIN_CAPACIDAD: sin stock no se rechaza, se devuelve el perfil', () => {
    const [perfil] = evaluar(
      pedido([oferta(1, [principal('ru')], [item(3)])]),
      { ru: 4 },
      [],
    ).resultados;
    assert.equal(perfil.nivelHabilitacion, 'SIN_CAPACIDAD');
    assert.equal(perfil.rolSugerido, 'apoyo');
    assert.equal(perfil.nivelRiesgoPermitido, 'baja');
    assert.equal(perfil.capacidadesHabilitadas[0].cantidadHabilitada, 0);
    assert.ok(mencionan(perfil.observaciones, 'Ninguna ONG'));
    assert.ok(!mencionan(perfil.observaciones, 'severidad'));
  });

  it('el nivel operativo de la ONG limita el riesgo aunque la cobertura sea plena', () => {
    const conSeveridadAlta = evaluar(pedido([oferta(1, [principal('ru')], [item(3)])]), { ru: 2 }, [
      ['ru', 'paramedicos', 5],
    ]).resultados[0];
    assert.equal(conSeveridadAlta.nivelHabilitacion, 'PLENO');
    assert.equal(conSeveridadAlta.nivelRiesgoPermitido, 'media');
    assert.ok(mencionan(conSeveridadAlta.observaciones, 'severidad'));

    const conSeveridadBaja = evaluar(
      pedido([oferta(1, [principal('ru')], [item(3)])], { severidad: 'baja' }),
      { ru: 2 },
      [['ru', 'paramedicos', 5]],
    ).resultados[0];
    assert.ok(!mencionan(conSeveridadBaja.observaciones, 'severidad'));
  });

  it('consorcio: suma el stock de las ONGs y usa el menor nivel operativo', () => {
    const [perfil] = evaluar(
      pedido([oferta(1, [principal('ru'), apoyo('ms')], [item(6)])]),
      { ru: 4, ms: 2 },
      [
        ['ru', 'paramedicos', 2],
        ['ms', 'paramedicos', 3],
      ],
    ).resultados;
    assert.equal(perfil.capacidadesHabilitadas[0].cantidadHabilitada, 5); // min(6, 2 + 3)
    assert.equal(perfil.nivelHabilitacion, 'PARCIAL'); // 5 / 6
    assert.equal(perfil.nivelRiesgoPermitido, 'media'); // min(nivel 2 = media, tope alta)
  });

  it('varios ítems: la cobertura es el promedio de la de cada ítem', () => {
    const resultado = evaluar(
      pedido([oferta(1, [principal('ru')], [item(4), item(10, LOTE_B, 'raciones')])], {
        lotes: [PARAMEDICOS, RACIONES],
      }),
      { ru: 4 },
      [['ru', 'paramedicos', 4]],
    );
    // paramedicos al 100 %, raciones al 0 % → 50 %
    assert.equal(resultado.resultados[0].nivelHabilitacion, 'PARCIAL');
    assert.deepEqual(resultado.resumen.cobertura, [
      { loteId: LOTE_A, solicitada: 5, cubierta: 4 },
      { loteId: LOTE_B, solicitada: 10, cubierta: 0 },
    ]);
    assert.equal(resultado.resumen.todosLosLotesCubiertos, false);
  });

  it('una ONG que no existe no cuenta, pero no rompe la oferta', () => {
    const soloFantasma = evaluar(pedido([oferta(1, [principal('fantasma')], [item(3)])]), {}, [])
      .resultados[0];
    assert.equal(soloFantasma.nivelHabilitacion, 'SIN_CAPACIDAD');
    assert.equal(soloFantasma.nivelRiesgoPermitido, 'baja');
    assert.ok(mencionan(soloFantasma.observaciones, '"fantasma"'));

    const mixta = evaluar(
      pedido([oferta(1, [principal('ru'), apoyo('fantasma')], [item(3)])]),
      { ru: 3 },
      [['ru', 'paramedicos', 3]],
    ).resultados[0];
    assert.equal(mixta.nivelHabilitacion, 'PLENO');
    assert.equal(mixta.nivelRiesgoPermitido, 'alta'); // solo cuenta el nivel de "ru"
    assert.ok(mencionan(mixta.observaciones, '"fantasma"'));
  });
});

describe('evaluarPedido — resumen de cobertura', () => {
  it('varias ofertas completan el lote', () => {
    const resultado = evaluar(
      pedido([oferta(1, [principal('ru')], [item(3)]), oferta(2, [principal('ms')], [item(2)])]),
      { ru: 3, ms: 3 },
      [
        ['ru', 'paramedicos', 3],
        ['ms', 'paramedicos', 5],
      ],
    );
    assert.deepEqual(resultado.resumen.cobertura, [{ loteId: LOTE_A, solicitada: 5, cubierta: 5 }]);
    assert.equal(resultado.resumen.todosLosLotesCubiertos, true);
  });

  it('lo cubierto no supera lo solicitado', () => {
    const resultado = evaluar(
      pedido([oferta(1, [principal('ru')], [item(4)]), oferta(2, [principal('ms')], [item(4)])]),
      { ru: 3, ms: 3 },
      [
        ['ru', 'paramedicos', 4],
        ['ms', 'paramedicos', 4],
      ],
    );
    assert.equal(resultado.resumen.cobertura[0].cubierta, 5);
    assert.equal(resultado.resumen.todosLosLotesCubiertos, true);
  });

  it('con 0 ofertas: resultados vacíos y nada cubierto', () => {
    const resultado = evaluarPedido(pedido([]), new Map(), new Map());
    assert.deepEqual(resultado.resultados, []);
    assert.deepEqual(resultado.resumen, {
      todosLosLotesCubiertos: false,
      cobertura: [{ loteId: LOTE_A, solicitada: 5, cubierta: 0 }],
    });
  });

  it('no reserva: dos ofertas de la misma ONG ven el mismo stock (lo frena /compromisos con 409)', () => {
    const resultado = evaluar(
      pedido([oferta(1, [principal('ru')], [item(3)]), oferta(2, [principal('ru')], [item(3)])]),
      { ru: 3 },
      [['ru', 'paramedicos', 3]],
    );
    assert.deepEqual(
      resultado.resultados.map((perfil) => perfil.nivelHabilitacion),
      ['PLENO', 'PLENO'],
    );
  });
});

describe('validateValidacionRequest', () => {
  const valido = () => pedido([oferta(1, [principal('ru')], [item(3)])]);

  it('acepta un pedido válido, también sin ofertas', () => {
    assert.deepEqual(validateValidacionRequest(valido()), {});
    assert.deepEqual(validateValidacionRequest(pedido([])), {});
  });

  it('rechaza un body que no es un objeto', () => {
    assert.deepEqual(Object.keys(validateValidacionRequest(null)), ['body']);
    assert.deepEqual(Object.keys(validateValidacionRequest([])), ['body']);
  });

  it('marca la cabecera inválida', () => {
    const errors = validateValidacionRequest({
      emergenciaId: 'no-es-uuid',
      severidad: 'extrema',
      lotes: [],
      ofertas: 'nada',
    });
    assert.deepEqual(Object.keys(errors).sort(), ['emergenciaId', 'lotes', 'ofertas', 'severidad']);
  });

  it('marca los lotes con datos inválidos o repetidos', () => {
    const errors = validateValidacionRequest(
      pedido([], {
        lotes: [
          { id: LOTE_A, recursoCodigo: 'paramedicos', cantidadSolicitada: 0 },
          { id: LOTE_A, recursoCodigo: '', cantidadSolicitada: 5 },
        ],
      }),
    );
    assert.deepEqual(Object.keys(errors).sort(), [
      'lotes[0].cantidadSolicitada',
      'lotes[1].id',
      'lotes[1].recursoCodigo',
    ]);
  });

  it('marca oferta repetida, sin ONGs e ítem de un lote que no existe', () => {
    const errors = validateValidacionRequest(
      pedido([oferta(1, [principal('ru')], [item(3)]), oferta(1, [], [item(3, 'no-es-un-lote')])]),
    );
    assert.deepEqual(Object.keys(errors).sort(), [
      'ofertas[1].items[0].loteId',
      'ofertas[1].ofertaId',
      'ofertas[1].ongs',
    ]);
  });

  it('marca un ítem cuyo recurso no coincide con el del lote', () => {
    const errors = validateValidacionRequest(
      pedido([oferta(1, [principal('ru')], [item(3, LOTE_A, 'raciones')])]),
    );
    assert.deepEqual(Object.keys(errors), ['ofertas[0].items[0].recursoCodigo']);
  });

  it('marca cantidades que no son enteros positivos y lotes repetidos en una oferta', () => {
    const cantidades = validateValidacionRequest(
      pedido([oferta(1, [principal('ru')], [item(0), item(2.5, LOTE_B, 'raciones')])], {
        lotes: [PARAMEDICOS, RACIONES],
      }),
    );
    assert.deepEqual(Object.keys(cantidades).sort(), [
      'ofertas[0].items[0].cantidadOfrecida',
      'ofertas[0].items[1].cantidadOfrecida',
    ]);

    const repetido = validateValidacionRequest(
      pedido([oferta(1, [principal('ru')], [item(1), item(2)])]),
    );
    assert.deepEqual(Object.keys(repetido), ['ofertas[0].items[1].loteId']);
  });

  it('marca ONGs repetidas, con ref inválido o con un rol que no existe', () => {
    const errors = validateValidacionRequest(
      pedido([
        oferta(1, [principal('ru'), { ref: 'ru', rol: 'jefe' }, apoyo('Con Espacios')], [item(3)]),
      ]),
    );
    assert.deepEqual(Object.keys(errors).sort(), [
      'ofertas[0].ongs[1].ref',
      'ofertas[0].ongs[1].rol',
      'ofertas[0].ongs[2].ref',
    ]);
  });
});
