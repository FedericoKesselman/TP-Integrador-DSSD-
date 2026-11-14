// Datos de demo para el dashboard del Auditor. Se corre a mano:
//   npm run demo:cargar   (borra los datos demo anteriores y los vuelve a insertar)
//   npm run demo:borrar   (borra solo los datos demo)
// Las emergencias demo se reconocen por el prefijo "[DEMO] " en `description`.
import pool, { withTransaction } from '../src/db.js';

const PREFIJO = '[DEMO] ';
const ONG_REFS = ['rescatistas-unidos', 'manos-solidarias'];
const ESTADOS = [
  'registrada',
  'convocatoria_abierta',
  'convocatoria_cerrada',
  'validada',
  'adjudicada',
  'en_ejecucion',
  'finalizada',
];

// Cada emergencia: datos del alta, `horas` (horas desde el alta en que ocurre cada paso del ciclo
// después de `registrada`, en el orden de ESTADOS, hasta su estado actual), lotes y ofertas.
// Lote: [código del catálogo, nombre, unidad, cantidad pedida].
// Oferta: `items` = [índice de lote, cantidad ofrecida, cantidad habilitada por el SN];
// `horas` = cuántas horas después del alta se cargó.
const EMERGENCIAS = [
  {
    type: 'inundacion',
    severity: 'critica',
    municipality: 'La Plata',
    municipalityId: '060441',
    zone: 'Barrios Los Hornos y Tolosa, cuenca del arroyo El Gato',
    lat: -34.9215,
    lon: -57.9545,
    people: 3200,
    desc: 'Desborde del arroyo El Gato tras una tormenta de 180 mm en pocas horas. Hay familias evacuadas y calles anegadas.',
    contact: 'Marcela Ibarra',
    phone: '+54 221 555 0101',
    createdAt: '2026-09-01T10:00:00-03:00',
    estado: 'finalizada',
    duracionMin: 240,
    horas: [3, 8, 10, 31, 34, 270],
    lotes: [
      ['botes', 'Botes de rescate', 'unidades', 6],
      ['raciones', 'Raciones de comida seca', 'raciones', 1500],
      ['frazadas', 'Frazadas térmicas', 'unidades', 400],
    ],
    ofertas: [
      {
        ongs: ['rescatistas-unidos', 'manos-solidarias'],
        estado: 'finalizada',
        horas: 4,
        nivel: 'PLENO',
        rol: 'principal',
        riesgo: 'critica',
        obs: 'Consorcio: botes y raciones, traslado propio.',
        items: [
          [0, 4, 4],
          [1, 900, 900],
        ],
      },
      {
        ongs: ['manos-solidarias'],
        estado: 'finalizada',
        horas: 5,
        nivel: 'PARCIAL',
        rol: 'apoyo',
        riesgo: 'alta',
        obs: 'Frazadas disponibles en depósito de Berisso.',
        items: [[2, 250, 250]],
      },
      {
        ongs: ['rescatistas-unidos'],
        estado: 'no_seleccionada',
        horas: 6,
        nivel: 'APOYO',
        rol: 'apoyo',
        riesgo: 'media',
        obs: 'Raciones de reserva.',
        items: [[1, 300, 300]],
      },
    ],
  },
  {
    type: 'incendio',
    severity: 'alta',
    municipality: 'Tandil',
    municipalityId: '060826',
    zone: 'Sierras de Tandil, zona rural camino a Cerro Leones',
    lat: -37.3,
    lon: -59.15,
    people: 450,
    desc: 'Incendio forestal en pastizales y forestación en las sierras, con viento fuerte y avance hacia chacras vecinas.',
    contact: 'Gustavo Peralta',
    phone: '+54 249 555 0102',
    createdAt: '2026-09-28T15:30:00-03:00',
    estado: 'finalizada',
    duracionMin: 120,
    horas: [2, 5, 7, 80, 84, 200],
    lotes: [
      ['bomberos', 'Bomberos / Brigadistas', 'personas', 40],
      ['cisterna', 'Camiones cisterna de agua', 'vehículos', 4],
      ['kits-primeros-auxilios', 'Kits de primeros auxilios', 'kits', 30],
    ],
    ofertas: [
      {
        ongs: ['rescatistas-unidos', 'manos-solidarias'],
        estado: 'finalizada',
        horas: 3,
        nivel: 'PLENO',
        rol: 'principal',
        riesgo: 'alta',
        obs: 'Brigada conjunta con dos cisternas.',
        items: [
          [0, 25, 20],
          [1, 2, 2],
        ],
      },
      {
        ongs: ['manos-solidarias'],
        estado: 'no_seleccionada',
        horas: 4,
        nivel: 'PARCIAL',
        rol: 'apoyo',
        riesgo: 'media',
        obs: 'Solo kits sanitarios.',
        items: [[2, 30, 30]],
      },
    ],
  },
  {
    type: 'terremoto',
    severity: 'media',
    municipality: 'Luján',
    municipalityId: '060497',
    zone: 'Centro histórico y barrio Santa Marta',
    lat: -34.5703,
    lon: -59.105,
    people: 800,
    desc: 'Sismo moderado con daños en viviendas antiguas y desprendimientos de cornisas. Varias familias sin acceso a sus casas.',
    contact: 'Laura Benítez',
    phone: '+54 2323 55 0103',
    createdAt: '2026-10-10T08:15:00-03:00',
    estado: 'finalizada',
    duracionMin: 180,
    horas: [2, 6, 8, 52, 56, 150],
    lotes: [
      ['carpas', 'Carpas familiares (4-6 personas)', 'unidades', 40],
      ['colchones', 'Colchones', 'unidades', 120],
      ['generadores', 'Generadores eléctricos', 'unidades', 4],
    ],
    ofertas: [
      {
        ongs: ['manos-solidarias'],
        estado: 'finalizada',
        horas: 3,
        nivel: 'PLENO',
        rol: 'principal',
        riesgo: 'media',
        obs: 'Carpas y colchones para 30 familias.',
        items: [
          [0, 30, 30],
          [1, 90, 90],
        ],
      },
      {
        ongs: ['rescatistas-unidos'],
        estado: 'no_seleccionada',
        horas: 5,
        nivel: 'APOYO',
        rol: 'apoyo',
        riesgo: 'baja',
        obs: 'Generadores en préstamo.',
        items: [[2, 2, 2]],
      },
    ],
  },
  {
    type: 'otro',
    typeOther: 'Temporal de viento y granizo',
    severity: 'alta',
    municipality: 'Bahía Blanca',
    municipalityId: '060056',
    zone: 'Ingeniero White y General Cerri',
    lat: -38.7,
    lon: -62.27,
    people: 1900,
    desc: 'Temporal de viento y granizo con voladura de techos, árboles caídos y corte de energía en dos localidades.',
    contact: 'Federico Salas',
    phone: '+54 291 555 0104',
    createdAt: '2026-10-30T19:00:00-03:00',
    estado: 'en_ejecucion',
    duracionMin: 120,
    horas: [1, 4, 6, 85, 88],
    lotes: [
      ['lonas', 'Lonas impermeables', 'unidades', 300],
      ['generadores', 'Generadores eléctricos', 'unidades', 8],
      ['herramientas', 'Herramientas de trabajo', 'kits', 20],
      ['radios', 'Radios de comunicación', 'unidades', 15],
    ],
    ofertas: [
      {
        ongs: ['rescatistas-unidos'],
        estado: 'adjudicada',
        horas: 2,
        nivel: 'PLENO',
        rol: 'principal',
        riesgo: 'alta',
        obs: 'Lonas y herramientas con cuadrilla propia.',
        items: [
          [0, 200, 200],
          [2, 12, 12],
        ],
      },
      {
        ongs: ['manos-solidarias'],
        estado: 'adjudicada',
        horas: 3,
        nivel: 'PARCIAL',
        rol: 'apoyo',
        riesgo: 'media',
        obs: 'Generadores y radios.',
        items: [
          [1, 5, 4],
          [3, 10, 10],
        ],
      },
    ],
  },
  {
    type: 'inundacion',
    severity: 'media',
    municipality: 'Quilmes',
    municipalityId: '060658',
    zone: 'Barrio San Francisco Solano, cercanías del arroyo Las Piedras',
    lat: -34.7861,
    lon: -58.3109,
    people: 1100,
    desc: 'Anegamiento por lluvias sostenidas con casas inundadas hasta 40 cm y pérdida de enseres en la zona baja.',
    contact: 'Patricia Domínguez',
    phone: '+54 11 5555 0105',
    createdAt: '2026-11-04T07:45:00-03:00',
    estado: 'adjudicada',
    duracionMin: 90,
    horas: [1, 3, 5, 100],
    lotes: [
      ['motobombas', 'Motobombas de achique', 'unidades', 6],
      ['kits-higiene', 'Kits de higiene personal', 'kits', 200],
      ['agua-potable', 'Agua potable envasada', 'litros', 3000],
    ],
    ofertas: [
      {
        ongs: ['manos-solidarias'],
        estado: 'adjudicada',
        horas: 2,
        nivel: 'PLENO',
        rol: 'principal',
        riesgo: 'media',
        obs: 'Agua y kits de higiene.',
        items: [
          [1, 150, 150],
          [2, 1800, 1800],
        ],
      },
      {
        ongs: ['rescatistas-unidos'],
        estado: 'no_seleccionada',
        horas: 3,
        nivel: 'APOYO',
        rol: 'apoyo',
        riesgo: 'baja',
        obs: 'Motobombas sin operador.',
        items: [[0, 2, 2]],
      },
    ],
  },
  {
    type: 'incendio',
    severity: 'baja',
    municipality: 'Tigre',
    municipalityId: '060805',
    zone: 'Isla del Delta, sección Segunda',
    lat: -34.2,
    lon: -58.57,
    people: 60,
    desc: 'Foco de incendio en pajonales de las islas, controlado parcialmente. Se necesita refuerzo para evitar rebrotes.',
    contact: 'Daniel Rojas',
    phone: '+54 11 5555 0106',
    createdAt: '2026-11-08T12:20:00-03:00',
    estado: 'validada',
    duracionMin: 60,
    horas: [1, 2, 20],
    lotes: [
      ['bomberos', 'Bomberos / Brigadistas', 'personas', 12],
      ['botes', 'Botes de rescate', 'unidades', 3],
    ],
    ofertas: [
      {
        ongs: ['rescatistas-unidos'],
        estado: 'validada',
        horas: 1,
        nivel: 'PLENO',
        rol: 'principal',
        riesgo: 'media',
        obs: 'Brigadistas con botes propios.',
        items: [
          [0, 10, 8],
          [1, 2, 2],
        ],
      },
    ],
  },
  {
    type: 'terremoto',
    severity: 'alta',
    municipality: 'Lomas de Zamora',
    municipalityId: '060427',
    zone: 'Villa Fiorito y Ingeniero Budge',
    lat: -34.7,
    lon: -58.46,
    people: 2500,
    desc: 'Sismo con derrumbes parciales en construcciones precarias y varios heridos que requieren atención en el lugar.',
    contact: 'Silvia Acosta',
    phone: '+54 11 5555 0107',
    createdAt: '2026-11-11T09:10:00-03:00',
    estado: 'convocatoria_abierta',
    duracionMin: 10080,
    horas: [1],
    lotes: [
      ['paramedicos', 'Paramédicos', 'personas', 15],
      ['ambulancias', 'Ambulancias equipadas', 'vehículos', 4],
      ['camillas', 'Camillas y sillas de ruedas', 'unidades', 30],
    ],
    ofertas: [
      {
        ongs: ['manos-solidarias'],
        estado: 'registrada',
        horas: 3,
        obs: 'Paramédicos disponibles desde mañana.',
        items: [[0, 8, 8]],
      },
    ],
  },
  {
    type: 'inundacion',
    severity: 'media',
    municipality: 'General Pueyrredón',
    municipalityId: '060357',
    zone: 'Barrio Parque Camet y zona del arroyo Lobería',
    lat: -37.9833,
    lon: -57.5667,
    people: 700,
    desc: 'Crecida del arroyo Lobería por sudestada, con caminos cortados y familias aisladas en la zona rural.',
    contact: 'Ricardo Fernández',
    phone: '+54 223 555 0108',
    createdAt: '2026-11-12T11:40:00-03:00',
    estado: 'registrada',
    horas: [],
    lotes: [],
    ofertas: [],
  },
];

const hs = (iso, horas) => new Date(new Date(iso).getTime() + horas * 3600e3).toISOString();

async function borrar(client) {
  const demo = `(SELECT id FROM emergencies WHERE description LIKE '${PREFIJO}%')`;
  // notifications.emergency_id no tiene cascade. Las ofertas se borran antes que las
  // emergencias para que oferta_lotes (RESTRICT sobre lotes) no bloquee el cascade.
  const n = await client.query(`DELETE FROM notifications WHERE emergency_id IN ${demo}`);
  const o = await client.query(`DELETE FROM ofertas WHERE emergency_id IN ${demo}`);
  const l = await client.query(`DELETE FROM lotes WHERE emergency_id IN ${demo}`);
  const e = await client.query(`DELETE FROM emergencies WHERE description LIKE '${PREFIJO}%'`);
  return {
    notificaciones: n.rowCount,
    ofertas: o.rowCount,
    lotes: l.rowCount,
    emergencias: e.rowCount,
  };
}

async function insertarEmergencia(client, em, ongIds) {
  const pasos = ESTADOS.slice(0, ESTADOS.indexOf(em.estado) + 1); // registrada ... estado actual
  const momento = { registrada: em.createdAt };
  pasos.slice(1).forEach((estado, i) => {
    momento[estado] = hs(em.createdAt, em.horas[i]);
  });

  const { rows } = await client.query(
    `INSERT INTO emergencies
       (type, type_other, severity, province_id, province, municipality_id, municipality,
        affected_zone, latitude, longitude, occurred_at, estimated_affected_people, description,
        contact_name, contact_phone, status, duracion_convocatoria_min, convocatoria_ronda,
        created_at, updated_at)
     VALUES ($1,$2,$3,'06','Buenos Aires',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
     RETURNING id`,
    [
      em.type,
      em.typeOther ?? null,
      em.severity,
      em.municipalityId,
      em.municipality,
      em.zone,
      em.lat,
      em.lon,
      hs(em.createdAt, -6),
      em.people,
      PREFIJO + em.desc,
      em.contact,
      em.phone,
      em.estado,
      pasos.length > 1 ? em.duracionMin : null,
      pasos.length > 1 ? 1 : 0,
      em.createdAt,
    ],
  );
  const emergencyId = rows[0].id;

  // Historial: el alta y una fila por cada transición hasta el estado actual.
  // eslint-disable-next-line no-restricted-syntax
  for (const [i, estado] of pasos.entries()) {
    // eslint-disable-next-line no-await-in-loop
    await client.query(
      `INSERT INTO emergency_status_history (emergency_id, from_status, to_status, changed_by, changed_at)
       VALUES ($1, $2, $3, 'demo', $4)`,
      [emergencyId, i === 0 ? null : pasos[i - 1], estado, momento[estado]],
    );
  }

  const loteIds = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const [code, label, unit, qty] of em.lotes) {
    // eslint-disable-next-line no-await-in-loop
    const r = await client.query(
      `INSERT INTO lotes (emergency_id, resource_type, resource_code, unit, quantity_requested, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
      [emergencyId, label, code, unit, qty, hs(em.createdAt, 0.5)],
    );
    loteIds.push(r.rows[0].id);
  }

  const ofertaIds = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const of of em.ofertas) {
    const creada = hs(em.createdAt, of.horas);
    // eslint-disable-next-line no-await-in-loop
    const r = await client.query(
      `INSERT INTO ofertas (emergency_id, status, observations, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$4) RETURNING id`,
      [emergencyId, of.estado, of.obs, creada],
    );
    const ofertaId = r.rows[0].id;
    ofertaIds.push(ofertaId);
    // eslint-disable-next-line no-restricted-syntax
    for (const ref of of.ongs) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        'INSERT INTO oferta_ongs (oferta_id, ong_id, role, created_at) VALUES ($1,$2,$3,$4)',
        [ofertaId, ongIds[ref], ref === of.ongs[0] ? 'principal' : 'apoyo', creada],
      );
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const [lote, ofrecida] of of.items) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO oferta_lotes (oferta_id, lote_id, quantity_offered, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$4)`,
        [ofertaId, loteIds[lote], ofrecida, creada],
      );
    }
    if (of.nivel) {
      const capacidades = of.items.map(([lote, , habilitada]) => ({
        loteId: loteIds[lote],
        cantidadHabilitada: habilitada,
      }));
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO oferta_validaciones
           (oferta_id, nivel_habilitacion, rol_sugerido, nivel_riesgo_permitido, capacidades, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$6)`,
        [ofertaId, of.nivel, of.rol, of.riesgo, JSON.stringify(capacidades), momento.validada],
      );
    }
  }

  // Resumen de la validación del SN: lo habilitado por lote (con tope en lo pedido).
  if (momento.validada) {
    const cobertura = em.lotes.map(([, , , pedida], i) => {
      const suma = em.ofertas
        .filter((of) => of.nivel)
        .flatMap((of) => of.items.filter(([lote]) => lote === i))
        .reduce((acc, [, , habilitada]) => acc + habilitada, 0);
      return { loteId: loteIds[i], pedida, cubierta: Math.min(suma, pedida) };
    });
    await client.query(
      'UPDATE emergencies SET validacion_resumen = $2::jsonb, updated_at = $3 WHERE id = $1',
      [
        emergencyId,
        JSON.stringify({
          todosLosLotesCubiertos: cobertura.every((c) => c.cubierta >= c.pedida),
          cobertura,
        }),
        momento[em.estado],
      ],
    );
  }

  // Adjudicación (con la fecha del paso "adjudicada") y finalización de cada oferta elegida.
  // eslint-disable-next-line no-restricted-syntax
  for (const [i, of] of em.ofertas.entries()) {
    if (['adjudicada', 'finalizada'].includes(of.estado)) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO adjudicaciones (emergency_id, oferta_id, compromiso_id, reparto, created_at)
         VALUES ($1,$2,$3,$4::jsonb,$5)`,
        [
          emergencyId,
          ofertaIds[i],
          `demo-${ofertaIds[i].slice(0, 8)}`,
          JSON.stringify(
            of.items.map(([lote, ofrecida, habilitada]) => ({
              recursoCodigo: em.lotes[lote][0],
              cantidad: Math.min(ofrecida, habilitada),
            })),
          ),
          momento.adjudicada,
        ],
      );
    }
    if (of.estado === 'finalizada') {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO oferta_finalizaciones (oferta_id, ong_id, finalizada_by, finalizada_at)
         VALUES ($1,$2,$3,$4)`,
        [ofertaIds[i], ongIds[of.ongs[0]], of.ongs[0], hs(momento.finalizada, -2)],
      );
    }
  }

  return { lotes: loteIds.length, ofertas: ofertaIds.length };
}

async function cargar(client) {
  const ongs = await client.query(
    'SELECT id, bonita_org_ref FROM ongs WHERE bonita_org_ref = ANY($1)',
    [ONG_REFS],
  );
  if (ongs.rowCount !== ONG_REFS.length) {
    throw new Error(
      `Faltan las ONGs demo (${ONG_REFS.join(', ')}). Corré las migraciones; este script no las crea.`,
    );
  }
  const ongIds = Object.fromEntries(ongs.rows.map((r) => [r.bonita_org_ref, r.id]));
  const borrados = await borrar(client);
  const total = { emergencias: 0, lotes: 0, ofertas: 0 };
  // eslint-disable-next-line no-restricted-syntax
  for (const em of EMERGENCIAS) {
    // eslint-disable-next-line no-await-in-loop
    const r = await insertarEmergencia(client, em, ongIds);
    total.emergencias += 1;
    total.lotes += r.lotes;
    total.ofertas += r.ofertas;
  }
  return { borrados, total };
}

async function main() {
  const comando = process.argv[2];
  if (comando === 'cargar') {
    const { borrados, total } = await withTransaction(cargar);
    console.log(`Datos demo anteriores borrados: ${borrados.emergencias} emergencias.`);
    console.log(
      `Insertados: ${total.emergencias} emergencias, ${total.lotes} lotes, ${total.ofertas} ofertas.`,
    );
  } else if (comando === 'borrar') {
    const b = await withTransaction(borrar);
    console.log(
      `Borrados: ${b.emergencias} emergencias, ${b.lotes} lotes, ${b.ofertas} ofertas, ${b.notificaciones} avisos.`,
    );
  } else {
    throw new Error('Uso: node scripts/demo.js cargar|borrar');
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
