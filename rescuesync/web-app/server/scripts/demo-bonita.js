// Crea casos REALES de punta a punta por la API de la web-app (como lo haría la UI), con esperas,
// para que Bonita registre tiempos de tareas realistas para el dashboard.
//   DEMO_CLAVE=... npm run demo:bonita                 (corrida larga, ~1.5-2 h, 8 emergencias)
//   DEMO_CLAVE=... npm run demo:bonita -- --rapido     (solo la primera, esperas de segundos)
//   --api=http://127.0.0.1:4000/api                    (otra base de la API)
// Solo habla con la web-app; nunca con Bonita ni con la base. La clave sale de DEMO_CLAVE.
// Flujo por emergencia (igual que la UI):
//   OperadorM   POST /emergencies                  -> "Registrar Emergencia"
//   CoordinadorR POST /emergencies/:id/lotes       -> (guarda lotes, sin tarea)
//   CoordinadorR POST /emergencies/:id/convocatoria -> "Revisar Emergencia", "Generar Lotes de
//                                                     Necesidades" y "Publicar Convocatoria"
//   ONGs        POST /emergencies/:id/ofertas, PUT /ofertas/:id
const args = process.argv.slice(2);
const RAPIDO = args.includes('--rapido');
const API = (
  args.find((a) => a.startsWith('--api='))?.slice(6) ?? 'http://localhost:4000/api'
).replace(/\/$/, '');
const CLAVE = process.env.DEMO_CLAVE;
const PREFIJO = '[DEMO-BONITA] ';

const USUARIOS = {
  municipio: 'OperadorM',
  coordinador: 'CoordinadorR',
  ongA: 'RescatistasUnidos',
  ongB: 'Manos Solidarias',
};

// Lote: [código del catálogo, nombre, unidad, cantidad pedida]
const BA = { provinceId: '06', province: 'Buenos Aires' };
const EMERGENCIAS = [
  {
    label: 'Inundación La Plata',
    type: 'inundacion',
    severity: 'critica',
    ...BA,
    municipalityId: '060441',
    municipality: 'La Plata',
    affectedZone: 'Los Hornos y Tolosa, cuenca del arroyo El Gato',
    latitude: -34.9215,
    longitude: -57.9545,
    people: 3200,
    desc: 'Desborde del arroyo El Gato tras una tormenta de 180 mm. Familias evacuadas y calles anegadas.',
    contact: 'Marcela Ibarra',
    phone: '+54 221 555 0101',
    lotes: [
      ['botes', 'Botes de rescate', 'unidades', 6],
      ['raciones', 'Raciones de comida seca', 'raciones', 1500],
      ['frazadas', 'Frazadas térmicas', 'unidades', 400],
    ],
  },
  {
    label: 'Incendio Olavarría',
    type: 'incendio',
    severity: 'alta',
    ...BA,
    municipalityId: '060497',
    municipality: 'Olavarría',
    affectedZone: 'Pastizales y forestación al sur de Sierras Bayas',
    latitude: -37.2,
    longitude: -60.15,
    people: 250,
    desc: 'Incendio de pastizales con viento fuerte que avanza hacia viviendas rurales y una cantera.',
    contact: 'Hugo Barrientos',
    phone: '+54 2284 55-0102',
    lotes: [
      ['bomberos', 'Bomberos / Brigadistas', 'personas', 20],
      ['cisterna', 'Camiones cisterna de agua', 'vehículos', 3],
    ],
  },
  {
    label: 'Terremoto Zárate',
    type: 'terremoto',
    severity: 'media',
    ...BA,
    municipalityId: '060861',
    municipality: 'Zárate',
    affectedZone: 'Barrio Villa Fox y casco céntrico',
    latitude: -34.0981,
    longitude: -59.0286,
    people: 900,
    desc: 'Sismo percibido con daños en viviendas antiguas y grietas en edificios del casco céntrico.',
    contact: 'Paula Quiroga',
    phone: '+54 3487 55-0103',
    lotes: [
      ['rescatistas', 'Rescatistas especializados', 'personas', 12],
      ['carpas', 'Carpas familiares (4-6 personas)', 'unidades', 40],
      ['kits-primeros-auxilios', 'Kits de primeros auxilios', 'kits', 60],
    ],
  },
  {
    label: 'Otro: Temporal Quilmes',
    type: 'otro',
    typeOther: 'Temporal de viento y granizo',
    severity: 'baja',
    ...BA,
    municipalityId: '060658',
    municipality: 'Quilmes',
    affectedZone: 'Barrios Solano y San Francisco Solano',
    latitude: -34.77,
    longitude: -58.31,
    people: 120,
    desc: 'Temporal con granizo que voló techos de chapa y dejó sin luz a varias manzanas.',
    contact: 'Rodrigo Sosa',
    phone: '+54 11 5555-0104',
    lotes: [
      ['lonas', 'Lonas impermeables', 'unidades', 80],
      ['generadores', 'Generadores eléctricos', 'unidades', 4],
    ],
  },
  {
    label: 'Inundación Bahía Blanca',
    type: 'inundacion',
    severity: 'alta',
    ...BA,
    municipalityId: '060056',
    municipality: 'Bahía Blanca',
    affectedZone: 'Barrios Villa Rosas, Noroeste y zona portuaria',
    latitude: -38.7196,
    longitude: -62.2724,
    people: 2500,
    desc: 'Temporal de lluvia extrema con calles anegadas y barrios incomunicados. Se requiere evacuación.',
    contact: 'Silvia Roldán',
    phone: '+54 291 555-0105',
    lotes: [
      ['botes', 'Botes de rescate', 'unidades', 8],
      ['motobombas', 'Motobombas de achique', 'unidades', 6],
      ['agua-potable', 'Agua potable envasada', 'litros', 6000],
    ],
  },
  {
    label: 'Incendio Tigre',
    type: 'incendio',
    severity: 'media',
    ...BA,
    municipalityId: '060805',
    municipality: 'Tigre',
    affectedZone: 'Islas del Delta, sección tercera',
    latitude: -34.4,
    longitude: -58.55,
    people: 80,
    desc: 'Foco de incendio en pajonales de las islas con humo denso que afecta a viviendas isleñas.',
    contact: 'Carla Medina',
    phone: '+54 11 5555-0106',
    lotes: [
      ['bomberos', 'Bomberos / Brigadistas', 'personas', 10],
      ['botes', 'Botes de rescate', 'unidades', 3],
      ['chalecos', 'Chalecos salvavidas', 'unidades', 40],
    ],
  },
  {
    label: 'Terremoto Gral. Pueyrredón',
    type: 'terremoto',
    severity: 'critica',
    ...BA,
    municipalityId: '060357',
    municipality: 'General Pueyrredón',
    affectedZone: 'Zona centro y barrio Las Avenidas, Mar del Plata',
    latitude: -38.0055,
    longitude: -57.5426,
    people: 4000,
    desc: 'Sismo de gran magnitud con edificios dañados, personas atrapadas y cortes de gas y energía.',
    contact: 'Federico Lamas',
    phone: '+54 223 555-0107',
    lotes: [
      ['rescatistas', 'Rescatistas especializados', 'personas', 30],
      ['ambulancias', 'Ambulancias equipadas', 'vehículos', 6],
      ['colchones', 'Colchones', 'unidades', 300],
    ],
  },
  {
    label: 'Otro: Derrame Luján',
    type: 'otro',
    typeOther: 'Derrame químico en ruta',
    severity: 'alta',
    ...BA,
    municipalityId: '060434',
    municipality: 'Luján',
    affectedZone: 'Ruta 7 km 68, cercanías del río Luján',
    latitude: -34.5703,
    longitude: -59.105,
    people: 600,
    desc: 'Vuelco de camión con químicos sobre la ruta con riesgo de contaminar el río. Evacuación preventiva.',
    contact: 'Natalia Paz',
    phone: '+54 2323 55-0108',
    lotes: [
      ['herramientas', 'Herramientas de trabajo', 'kits', 12],
      ['kits-higiene', 'Kits de higiene personal', 'kits', 200],
      ['medicamentos', 'Medicamentos básicos', 'lotes', 15],
    ],
  },
];

// ---------- helpers ----------
const aleatorio = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const hora = () => new Date().toTimeString().slice(0, 8);
const resultados = [];
let detenido = false;
const despertadores = new Set();

function dormir(ms) {
  if (detenido) return Promise.reject(new Error('detenido'));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      despertadores.delete(reject);
      resolve();
    }, ms);
    despertadores.add(() => {
      clearTimeout(t);
      reject(new Error('detenido'));
    });
  });
}
const esperaCorta = () => dormir(aleatorio(5, 15) * 1000);
const esperaMin = (min, max) =>
  RAPIDO ? esperaCorta() : dormir(aleatorio(min * 60, max * 60) * 1000);

// Cliente HTTP por usuario: guarda la cookie de sesión y re-loguea ante un 401.
class Sesion {
  constructor(username) {
    this.username = username;
    this.cookie = null;
    this.ongRef = null;
  }

  async login() {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: CLAVE }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(`login ${this.username}: HTTP ${res.status} ${data?.message ?? ''}`);
    this.cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    this.ongRef = data.ongRef;
  }

  async request(method, path, body, reintento = true) {
    if (!this.cookie) await this.login();
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Cookie: this.cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && reintento) {
      this.cookie = null;
      return this.request(method, path, body, false);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const campos = data?.errors ? ` ${JSON.stringify(data.errors)}` : '';
      throw new Error(`${method} ${path}: HTTP ${res.status} ${data?.message ?? ''}${campos}`);
    }
    return data;
  }
}

const sesiones = Object.fromEntries(Object.entries(USUARIOS).map(([k, u]) => [k, new Sesion(u)]));

// ---------- una emergencia de punta a punta ----------
async function correrEmergencia(e, indice) {
  const log = (paso) => console.log(`${hora()} [${e.label}] ${paso}`);
  const r = { label: e.label, type: e.type, id: '-', caso: '-', estado: 'no creada' };
  resultados.push(r);
  const fraccion = (desde, hasta) => Math.random() * (hasta - desde) + desde;

  try {
    // 1. Operador municipal: alta (payload igual a toEmergencyPayload del cliente)
    log('OperadorM crea la emergencia');
    const creada = await sesiones.municipio.request('POST', '/emergencies', {
      type: e.type,
      typeOther: e.type === 'otro' ? e.typeOther : null,
      severity: e.severity,
      provinceId: e.provinceId,
      province: e.province,
      municipalityId: e.municipalityId,
      municipality: e.municipality,
      affectedZone: e.affectedZone,
      latitude: e.latitude,
      longitude: e.longitude,
      occurredAt: new Date(Date.now() - 3600000).toISOString(),
      estimatedAffectedPeople: e.people,
      description: PREFIJO + e.desc,
      contactName: e.contact,
      contactPhone: e.phone,
    });
    r.id = creada.id;
    r.caso = creada.bonitaCaseId ?? '-';
    r.estado = creada.status;
    log(
      `creada id=${creada.id} caso=${creada.bonitaCaseId}${creada.bonitaWarning ? ` AVISO: ${creada.bonitaWarning}` : ''}`,
    );

    await esperaMin(1, 6);

    // 2. Coordinador: la UI guarda los lotes y publica; "Revisar Emergencia" y "Generar Lotes"
    // se completan dentro de la publicación. Dos pasos con espera, como la pantalla de lotes.
    log('CoordinadorR guarda los lotes');
    const guardados = await sesiones.coordinador.request(
      'POST',
      `/emergencies/${creada.id}/lotes`,
      {
        lotes: e.lotes.map(([resourceCode, resourceType, unit, quantityRequested]) => ({
          resourceType,
          resourceCode,
          unit,
          quantityRequested,
          notes: null,
        })),
      },
    );
    const { lotes } = guardados;

    await esperaMin(1, 4);

    const duracionMinutos = RAPIDO ? 1 : aleatorio(3, 12);
    log(`CoordinadorR publica la convocatoria (${duracionMinutos} min)`);
    const publicada = await sesiones.coordinador.request(
      'POST',
      `/emergencies/${creada.id}/convocatoria`,
      { duracionMinutos },
    );
    r.estado = publicada.status ?? 'convocatoria_abierta';
    const finVentana = Date.now() + duracionMinutos * 60000;
    const enVentana = (f) =>
      dormir(
        Math.max(
          0,
          Math.min(finVentana - 5000, Date.now() + f * duracionMinutos * 60000) - Date.now(),
        ),
      );

    // 3. Ofertas durante la ventana. Oferta parcial: ~la mitad de cada lote (al menos 1) de los
    // dos primeros lotes; consorcio: todos los lotes, la otra ONG como asociada.
    const itemsParcial = lotes.slice(0, 2).map((l) => ({
      loteId: l.id,
      quantityOffered: Math.max(1, Math.floor(l.quantityRequested / 2)),
      notes: null,
    }));
    const itemsConsorcio = lotes.map((l) => ({
      loteId: l.id,
      quantityOffered: l.quantityRequested,
      notes: null,
    }));

    await enVentana(fraccion(0.1, 0.3));
    log('RescatistasUnidos ofrece parcialmente');
    const oferta = await sesiones.ongA.request('POST', `/emergencies/${creada.id}/ofertas`, {
      observations: 'Cobertura parcial con recursos propios.',
      items: itemsParcial,
    });

    if (RAPIDO || indice % 2 === 1) {
      await enVentana(fraccion(0.4, 0.55));
      const ongs = await sesiones.ongB.request('GET', '/ofertas/ongs');
      const socia = ongs.find((o) => o.bonitaOrgRef === sesiones.ongA.ongRef);
      if (!socia) throw new Error('no se encontró la ONG asociada en /ofertas/ongs');
      log('Manos Solidarias ofrece en consorcio con RescatistasUnidos');
      await sesiones.ongB.request('POST', `/emergencies/${creada.id}/ofertas`, {
        observations: 'Consorcio: cubrimos todos los lotes.',
        partnerOngIds: [socia.id],
        items: itemsConsorcio,
      });
    }

    if (RAPIDO || indice % 2 === 0) {
      await enVentana(fraccion(0.65, 0.85));
      log('RescatistasUnidos edita su oferta (nueva versión)');
      await sesiones.ongA.request('PUT', `/ofertas/${oferta.id}`, {
        observations: 'Ampliamos la cobertura.',
        items: itemsParcial.map((i) => ({ ...i, quantityOffered: i.quantityOffered + 1 })),
      });
    }

    // 4. Pasada la ventana + 2 min (rápido: 3 min), se consulta el estado.
    const espera = (RAPIDO ? 3 : 2) * 60000;
    log(`esperando el cierre de la ventana (+${espera / 60000} min)`);
    await dormir(Math.max(0, finVentana - Date.now()) + espera);
    const final = await sesiones.coordinador.request('GET', `/emergencies/${creada.id}`);
    r.estado = final.status;
    r.caso = final.bonitaCaseId ?? r.caso;
    log(`estado final: ${final.status}`);
  } catch (error) {
    if (!detenido) log(`ERROR: ${error.message} (se sigue con las demás)`);
    r.estado = `${r.estado} (falló)`;
  }
}

function resumen() {
  console.log('\nResumen');
  console.table(
    resultados.map((r) => ({
      emergencia: r.label,
      tipo: r.type,
      id: r.id,
      caso_bonita: r.caso,
      estado: r.estado,
    })),
  );
}

async function main() {
  if (!CLAVE) {
    console.error(
      'Falta la variable de entorno DEMO_CLAVE (clave de los usuarios de Bonita de demo).',
    );
    process.exit(1);
  }
  process.on('SIGINT', () => {
    console.log(`\n${hora()} Ctrl+C: deteniendo...`);
    detenido = true;
    despertadores.forEach((cancelar) => cancelar());
    setTimeout(() => {
      resumen();
      process.exit(130);
    }, 500);
  });

  const lista = RAPIDO ? EMERGENCIAS.slice(0, 1) : EMERGENCIAS;
  console.log(
    `${hora()} API: ${API} | ${lista.length} emergencia(s)${RAPIDO ? ' | modo rápido' : ''}`,
  );
  const corridas = [];
  for (let i = 0; i < lista.length; i += 1) {
    corridas.push(correrEmergencia(lista[i], i));
    if (i < lista.length - 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await dormir(aleatorio(6, 10) * 60000);
      } catch {
        break;
      }
    }
  }
  await Promise.all(corridas);
  resumen();
}

main();
