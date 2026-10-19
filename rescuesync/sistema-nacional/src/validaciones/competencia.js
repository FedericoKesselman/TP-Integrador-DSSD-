// Algoritmo de validación por niveles de competencia (POST /validaciones).
//
// Son funciones puras: reciben el pedido y el stock que ya se leyó de la base
// (ver validar-ofertas.js) y devuelven el perfil de cada oferta. No tocan la
// base, así que se prueban sin Postgres. Las reglas están en el contrato
// (docs/api-contracts-sistema-nacional.md, "POST /validaciones").

export const NIVELES_RIESGO = ['baja', 'media', 'alta', 'critica'];

// Tope de riesgo que habilita cada nivel de cobertura.
const TOPE_RIESGO = {
  PLENO: 'critica',
  PARCIAL: 'alta',
  APOYO: 'media',
  SIN_CAPACIDAD: 'baja',
};

// Tolerancia para comparar proporciones: evita que el redondeo de los
// decimales deje, por ejemplo, un 0,5 exacto en 0,4999999.
const EPSILON = 1e-9;

// Clave del mapa de stock disponible: una entrada por (ONG, recurso).
export const claveStock = (ongRef, recursoCodigo) => `${ongRef}|${recursoCodigo}`;

// cobertura: número entre 0 y 1 (habilitado / ofrecido).
export function nivelDeHabilitacion(cobertura) {
  if (cobertura >= 1 - EPSILON) return 'PLENO';
  if (cobertura >= 0.5 - EPSILON) return 'PARCIAL';
  if (cobertura > EPSILON) return 'APOYO';
  return 'SIN_CAPACIDAD';
}

// nivel_operativo de la ONG (1 a 4) → riesgo máximo que puede asumir.
export const riesgoDeNivelOperativo = (nivel) => NIVELES_RIESGO[nivel - 1];

const indiceRiesgo = (riesgo) => NIVELES_RIESGO.indexOf(riesgo);
const menorRiesgo = (a, b) => NIVELES_RIESGO[Math.min(indiceRiesgo(a), indiceRiesgo(b))];

// Perfil de una oferta.
//   ongsPorRef: Map ref → { nivelOperativo } (solo ONGs que existen y están habilitadas)
//   disponible: Map claveStock(ref, recurso) → cantidad libre (total - comprometida)
function evaluarOferta(oferta, { ongsPorRef, disponible, severidad }) {
  const ongsValidas = oferta.ongs.filter((ong) => ongsPorRef.has(ong.ref));
  const ongsDesconocidas = oferta.ongs.filter((ong) => !ongsPorRef.has(ong.ref));

  // Por cada ítem: lo ofrecido, limitado por el stock que suman las ONGs de la oferta.
  const capacidadesHabilitadas = oferta.items.map((item) => {
    const stock = ongsValidas.reduce(
      (total, ong) => total + (disponible.get(claveStock(ong.ref, item.recursoCodigo)) ?? 0),
      0,
    );
    return {
      loteId: item.loteId,
      recursoCodigo: item.recursoCodigo,
      cantidadHabilitada: Math.min(item.cantidadOfrecida, stock),
      cantidadOfrecida: item.cantidadOfrecida,
    };
  });

  // Cobertura de la oferta: promedio de la cobertura de cada ítem. Así PLENO
  // significa "todos los ítems completos" y SIN_CAPACIDAD "ninguno", sin sumar
  // unidades distintas (personas con litros, por ejemplo).
  const cobertura =
    capacidadesHabilitadas.length === 0
      ? 0
      : capacidadesHabilitadas.reduce(
          (suma, capacidad) => suma + capacidad.cantidadHabilitada / capacidad.cantidadOfrecida,
          0,
        ) / capacidadesHabilitadas.length;

  const nivelHabilitacion = nivelDeHabilitacion(cobertura);
  const rolSugerido =
    nivelHabilitacion === 'PLENO' || nivelHabilitacion === 'PARCIAL' ? 'principal' : 'apoyo';

  // Riesgo permitido: el menor entre lo que soporta la ONG menos preparada de
  // la oferta y el tope que da la cobertura.
  const nivelesOperativos = ongsValidas.map((ong) => ongsPorRef.get(ong.ref).nivelOperativo);
  const riesgoOperativo =
    nivelesOperativos.length > 0 ? riesgoDeNivelOperativo(Math.min(...nivelesOperativos)) : 'baja';
  const nivelRiesgoPermitido = menorRiesgo(riesgoOperativo, TOPE_RIESGO[nivelHabilitacion]);

  const observaciones = [`Cobertura habilitada: ${Math.round(cobertura * 100)} %.`];
  ongsDesconocidas.forEach((ong) => {
    observaciones.push(
      `La ONG "${ong.ref}" no existe o no está habilitada; no se cuenta su stock.`,
    );
  });
  capacidadesHabilitadas
    .filter((capacidad) => capacidad.cantidadHabilitada < capacidad.cantidadOfrecida)
    .forEach((capacidad) => {
      observaciones.push(
        capacidad.cantidadHabilitada === 0
          ? `Ninguna ONG de la oferta tiene stock disponible de "${capacidad.recursoCodigo}".`
          : `Solo se habilitan ${capacidad.cantidadHabilitada} de ${capacidad.cantidadOfrecida} ofrecidos de "${capacidad.recursoCodigo}" (stock disponible de las ONGs de la oferta).`,
      );
    });
  if (
    nivelHabilitacion !== 'SIN_CAPACIDAD' &&
    indiceRiesgo(nivelRiesgoPermitido) < indiceRiesgo(severidad)
  ) {
    observaciones.push(
      `El riesgo permitido (${nivelRiesgoPermitido}) es menor que la severidad de la emergencia (${severidad}).`,
    );
  }

  return {
    ofertaId: oferta.ofertaId,
    nivelHabilitacion,
    rolSugerido,
    nivelRiesgoPermitido,
    capacidadesHabilitadas,
    observaciones,
  };
}

// Evalúa todo el pedido: el perfil de cada oferta y el resumen de cobertura
// por lote. Nunca rechaza una oferta: toda oferta recibe un perfil.
export function evaluarPedido(pedido, ongsPorRef, disponible) {
  const resultados = pedido.ofertas.map((oferta) =>
    evaluarOferta(oferta, { ongsPorRef, disponible, severidad: pedido.severidad }),
  );

  const capacidades = resultados.flatMap((resultado) => resultado.capacidadesHabilitadas);
  const cobertura = pedido.lotes.map((lote) => {
    const habilitado = capacidades
      .filter((capacidad) => capacidad.loteId === lote.id)
      .reduce((total, capacidad) => total + capacidad.cantidadHabilitada, 0);
    return {
      loteId: lote.id,
      solicitada: lote.cantidadSolicitada,
      cubierta: Math.min(lote.cantidadSolicitada, habilitado),
    };
  });

  return {
    emergenciaId: pedido.emergenciaId,
    resultados,
    resumen: {
      // Sin ofertas no hay nada cubierto, aunque no haya lotes que revisar.
      todosLosLotesCubiertos:
        pedido.ofertas.length > 0 &&
        cobertura.length > 0 &&
        cobertura.every((lote) => lote.cubierta >= lote.solicitada),
      cobertura,
    },
  };
}
