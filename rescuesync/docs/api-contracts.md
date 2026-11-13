# Contratos de la API (web-app)

Fuente única de la forma de los datos que viajan entre `web-app/client` y
`web-app/server`. Si cambia un campo o un enum, actualizar este documento y
los dos lados.

## Autenticación

Los usuarios se validan contra la organización de Bonita (login service).
El server guarda la sesión de Bonita del lado del server y el navegador
recibe solo la cookie de sesión de la app (`connect.sid`, httpOnly), que
manda automáticamente en cada pedido. Implementado en
`server/src/routes/auth-routes.js` y `server/src/bonita/bonita-client.js`;
el cliente los usa desde `client/src/services/auth-service.js`.

El `role` y el `groupPath` salen de la membresía del usuario en la
organización de Bonita (se consultan en el login y se guardan en la sesión).
`requireRole` los usa para devolver `403` en las acciones no permitidas.

### `POST /api/auth/login`

**Request body**

```json
{ "username": "OperadorM", "password": "..." }
```

| Respuesta | Cuándo | Body |
|---|---|---|
| `200 OK` + `Set-Cookie: connect.sid` | Bonita aceptó las credenciales | `{ "username": "OperadorM", "role": "operador_municipal", "groupPath": "/rescuesync/municipios/la-plata", "ongRef": null }` |
| `400 Bad Request` | falta `username` o `password` | `{ "message": "Usuario y contraseña son obligatorios." }` |
| `401 Unauthorized` | Bonita rechazó las credenciales | `{ "message": "Usuario o contraseña incorrectos." }` |
| `403 Forbidden` | el usuario no tiene un rol de la app en Bonita | `{ "message": "Tu usuario no tiene un rol habilitado en RescueSync." }` |
| `502 Bad Gateway` | Bonita no respondió (Studio cerrado, URL mal) | `{ "message": "No se pudo conectar con Bonita." }` |

### `GET /api/auth/me`

Indica si hay sesión iniciada. El cliente lo llama al arrancar (así la
sesión sobrevive a un F5).

| Respuesta | Cuándo | Body |
|---|---|---|
| `200 OK` | hay sesión | `{ "username", "role", "groupPath", "ongRef" }` (igual que el login) |
| `401 Unauthorized` | no hay sesión o expiró | `{ "message": "No hay sesión iniciada." }` |

`ongRef` solo tiene valor cuando el usuario logueado es una ONG: es el nombre
de su grupo en Bonita y se usa para asociar la sesión con `ongs.bonita_org_ref`;
no reemplaza la autenticación ni define credenciales locales.

### `POST /api/auth/logout`

Cierra la sesión en Bonita (`/bonita/logoutservice`) y destruye la sesión de
la app. Si Bonita no responde, igual cierra la sesión de la app.

**Respuesta `204 No Content`** (borra la cookie `connect.sid`).

## Emergencias

### `POST /api/emergencies`

Alta de una emergencia por parte del **Operador Municipal**. Corresponde a la
tarea BPM **"Registrar Emergencia"**: el backend debe persistirla en Postgres
e **iniciar la instancia del proceso en Bonita**, seteando las variables de
proceso con estos datos.

El cliente valida todo antes de enviar
(`client/src/features/emergencies/validate-emergency.js`), pero el server debe
volver a validar.

**Request body**

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `type` | string (enum `EmergencyType`) | sí | |
| `typeOther` | string \| null | si `type = "otro"` | texto libre; `null` en otro caso |
| `severity` | string (enum `Severity`) | sí | |
| `provinceId` | string | sí | código INDEC de la provincia según [Georef](https://apis.datos.gob.ar/georef/api/provincias) (ej. `"06"`) |
| `province` | string | sí | nombre oficial de la provincia (Georef) |
| `municipalityId` | string \| null | sí | código de municipio de Georef (ej. `"060441"`); en CABA es una comuna. `null` solo si la lista de Georef no estuvo disponible y el nombre se cargó a mano |
| `municipality` | string | sí | nombre oficial del municipio o comuna |
| `affectedZone` | string | sí | 3–200 caracteres |
| `latitude` | number \| null | no | −90..90; si viene, `longitude` también. Punto exacto marcado en el mapa o tomado del GPS |
| `longitude` | number \| null | no | −180..180; si viene, `latitude` también |
| `occurredAt` | string (ISO 8601 UTC) | sí | no puede ser futura |
| `estimatedAffectedPeople` | integer \| null | no | ≥ 0 |
| `description` | string | sí | 20–2000 caracteres |
| `contactName` | string | sí | |
| `contactPhone` | string | sí | `^\+?[\d\s()-]{6,20}$` |

Ejemplo:

```json
{
  "type": "inundacion",
  "typeOther": null,
  "severity": "alta",
  "provinceId": "06",
  "province": "Buenos Aires",
  "municipalityId": "060441",
  "municipality": "La Plata",
  "affectedZone": "Barrios Tolosa y Ringuelet, márgenes del arroyo El Gato",
  "latitude": -34.9214,
  "longitude": -57.9544,
  "occurredAt": "2026-09-24T13:30:00.000Z",
  "estimatedAffectedPeople": 350,
  "description": "Desborde del arroyo tras 180 mm de lluvia en 6 horas. Viviendas anegadas.",
  "contactName": "María Gómez",
  "contactPhone": "+54 221 555-1234"
}
```

**Respuesta `201 Created`**: el mismo objeto más:

```json
{
  "id": "uuid",
  "status": "registrada",
  "bonitaCaseId": "1234",
  "createdAt": "2026-09-24T13:35:12.000Z"
}
```

`bonitaCaseId` es el id de la instancia de proceso creada en Bonita. Si Bonita
falló (sesión vencida, proceso no desplegado o activo, Bonita caído), la
emergencia igual queda guardada y la respuesta sigue siendo `201` pero con
`bonitaCaseId: null` y un campo extra `bonitaWarning` con el aviso:

```json
{
  "id": "uuid",
  "status": "registrada",
  "bonitaCaseId": null,
  "bonitaWarning": "La emergencia se guardó, pero no se pudo iniciar el caso en Bonita.",
  "createdAt": "2026-09-24T13:35:12.000Z"
}
```

`bonitaWarning` aparece cuando falló el inicio del caso, y también cuando el
caso se creó (con su `bonitaCaseId`) pero no se pudo completar la tarea
"Registrar Emergencia" que el alta tilda a continuación:

```json
{
  "id": "uuid",
  "status": "registrada",
  "bonitaCaseId": "1234",
  "bonitaWarning": "El caso se creó pero no se pudo completar Registrar Emergencia.",
  "createdAt": "2026-09-24T13:35:12.000Z"
}
```

**Respuesta `400 Bad Request`** (validación):

```json
{
  "message": "Datos inválidos",
  "errors": { "severity": "Elegí el nivel de gravedad." }
}
```

El cliente muestra `message` en pantalla. Cualquier otro error debe devolver
también `{ "message": "..." }`.

### Enums

- `EmergencyType`: `inundacion`, `incendio`, `terremoto`, `otro`
- `Severity`: `baja`, `media`, `alta`, `critica`
- `EmergencyStatus`: `registrada` (alta hecha) → `convocatoria_abierta`
  (el Coordinador publicó los lotes) → `convocatoria_cerrada` (venció el
  temporizador de Bonita) → `validada` → `adjudicada` → `en_ejecucion` →
  `finalizada`. Las transiciones permitidas y quién las dispara están en
  "Entrega 5 → Estados y transiciones" más abajo. Fuente de las constantes:
  `web-app/shared/workflow.js`.

Definidos en el cliente en
`client/src/features/emergencies/emergency-constants.js` y como `CHECK`
constraints en `server/migrations/*_create-core-schema.sql`.

### `GET /api/emergencies`

Listado completo de emergencias registradas, para el Centro Coordinador
Regional (lo empieza a consumir la pantalla de la Fase 3). Sin paginación ni
filtros por ahora — se agregan si hacen falta cuando exista esa pantalla.

**Respuesta `200 OK`**: array ordenado por `createdAt` descendente (la más
reciente primero), cada elemento con el mismo shape que la respuesta de
`POST /api/emergencies`:

```json
[
  {
    "id": "uuid",
    "type": "inundacion",
    "typeOther": null,
    "severity": "alta",
    "provinceId": "06",
    "province": "Buenos Aires",
    "municipalityId": "060441",
    "municipality": "La Plata",
    "affectedZone": "Barrios Tolosa y Ringuelet, márgenes del arroyo El Gato",
    "latitude": -34.9214,
    "longitude": -57.9544,
    "occurredAt": "2026-09-24T13:30:00.000Z",
    "estimatedAffectedPeople": 350,
    "description": "Desborde del arroyo tras 180 mm de lluvia en 6 horas. Viviendas anegadas.",
    "contactName": "María Gómez",
    "contactPhone": "+54 221 555-1234",
    "status": "registrada",
    "bonitaCaseId": null,
    "createdAt": "2026-09-24T13:35:12.000Z"
  }
]
```

## Lotes

Corresponden a la tabla `lotes` (ver migración del esquema). Los crea el
**Centro Coordinador Regional** al desglosar una emergencia (ej: 5
Paramédicos, 1000 raciones de alimento).

Todos los endpoints de emergencias y lotes requieren una sesión iniciada.
El alta de emergencias corresponde al Operador Municipal; guardar lotes y
publicar la convocatoria corresponde al Centro Coordinador Regional.

### `POST /api/emergencies/:emergencyId/lotes`

Alta de uno o varios lotes para una emergencia, en un solo pedido (el
Coordinador arma el desglose completo antes de publicar la convocatoria).

**Request body**

```json
{
  "lotes": [
    { "resourceType": "Paramédicos", "resourceCode": "paramedicos", "unit": "personas", "quantityRequested": 5, "notes": null },
    { "resourceType": "Raciones de comida seca", "resourceCode": "raciones", "unit": "raciones", "quantityRequested": 1000, "notes": "aptas para celiacos si es posible" }
  ]
}
```

| Campo (de cada lote) | Tipo | Requerido | Reglas |
|---|---|---|---|
| `resourceType` | string | sí | nombre para mostrar (etiqueta del catálogo) |
| `resourceCode` | string | sí | id del catálogo (`^[a-z0-9-]+$`, ej. `paramedicos`); es lo que entiende el Sistema Nacional |
| `unit` | string \| null | no | unidad del recurso ("personas", "raciones", "unidades") |
| `quantityRequested` | integer | sí | > 0 |
| `notes` | string \| null | no | |

**Respuesta `201 Created`**

```json
{
  "emergencyId": "uuid",
  "lotes": [
    { "id": "uuid", "resourceType": "Paramédicos", "resourceCode": "paramedicos", "unit": "personas", "quantityRequested": 5, "notes": null, "createdAt": "2026-09-24T14:00:00.000Z" }
  ]
}
```

**Respuesta `409 Conflict`** si la convocatoria ya fue publicada o cerrada.
Una vez que la emergencia deja el estado `registrada`, sus lotes quedan
bloqueados para conservar lo que se publicó a las ONGs. Al **reformular**
(ver `POST …/decision`) la emergencia vuelve a `registrada` y los lotes se
pueden rearmar.

### `GET /api/emergencies/:emergencyId/lotes`

Lista los lotes de una emergencia (mismo shape que el array `lotes` de
arriba). Lo usan tanto la pantalla del Coordinador como, más adelante, la
del Sistema Nacional.

### `POST /api/emergencies/:emergencyId/convocatoria`

Publica oficialmente la convocatoria: pasa `emergencies.status` de
`registrada` a `convocatoria_abierta`. Requiere que la emergencia tenga al
menos un lote cargado.

**Request body** (opcional): `{ "duracionMinutos": 120 }`: duración de la ventana
de ofertas, entera, entre 1 y 10080 (mínimo y máximo en
`shared/workflow.js`, `CONVOCATORIA_DURACION`); si no viene se usa 120. Se guarda
en `emergencies.duracion_convocatoria_min` (se expone como
`duracionConvocatoriaMin`) y viaja a Bonita como input `duracionConvocatoria` de
"Publicar Convocatoria"; el timer lee esa variable. `400` con
`{ message, errors: { duracionMinutos } }` si no es válida. Esta acción también **completa en Bonita** las tareas
del coordinador que estén pendientes ("Revisar Emergencia", "Generar Lotes de
Necesidades" y "Publicar Convocatoria"), con la sesión del usuario (ver
`roadmapfase2.md`). Publicar en la web y avanzar en Bonita van juntos: si
Bonita no avanza, se revierte la publicación.

**Respuesta `200 OK`**

```json
{ "emergencyId": "uuid", "status": "convocatoria_abierta" }
```

**Respuesta `409 Conflict`** si la emergencia no tiene lotes o ya tiene la
convocatoria abierta/cerrada:

```json
{ "message": "La emergencia no tiene lotes cargados." }
```

**Respuesta `502 Bad Gateway`** si Bonita no pudo avanzar (la emergencia no
tiene caso en Bonita, Bonita dio error, o "Publicar Convocatoria" no estaba
pendiente). La publicación se revierte: la emergencia sigue en `registrada` y
se puede reintentar.

```json
{
  "message": "No se pudo iniciar la convocatoria en Bonita; la emergencia sigue en estado registrada, reintentá."
}
```

## Ofertas

Corresponden a las tablas `ofertas`, `oferta_ongs` (consorcio) y
`oferta_lotes` (qué cubre cada oferta y con qué cantidad). Las cargan las
**ONGs**, mientras la convocatoria está abierta.

Para el alcance mínimo de la Entrega 2, la ONG que presenta la oferta se
resuelve desde la sesión de Bonita del usuario logueado (`representante_ong`).
La aplicación no crea usuarios propios ni recibe credenciales locales: solo
vincula esa sesión con una fila de dominio en `ongs` mediante
`ongs.bonita_org_ref`. Los consorcios se guardan en `oferta_ongs` (rol
`principal` o `asociada`).

### `POST /api/emergencies/:emergencyId/ofertas`

Alta de una oferta por parte de la ONG logueada, que queda como ONG
`principal`. Para un **consorcio**, `partnerOngIds` agrega otras ONGs como
`asociada`: pueden ver y editar la oferta, pero solo la principal cambia
quiénes forman el consorcio.

**Request body**

```json
{
  "observations": "Podemos cubrir también transporte si hace falta.",
  "partnerOngIds": ["uuid-ong-2"],
  "items": [
    { "loteId": "uuid-lote-1", "quantityOffered": 3, "notes": null }
  ]
}
```

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `observations` | string \| null | no | |
| `partnerOngIds` | string[] (uuid) | no | ONGs asociadas (consorcio); deben existir en `ongs` |
| `items` | array | sí | al menos 1 item |
| `items[].loteId` | string (uuid) | sí | debe pertenecer a la misma emergencia |
| `items[].quantityOffered` | integer | sí | > 0 (puede ser menor a lo pedido: oferta parcial) |
| `items[].notes` | string \| null | no | |

**Respuesta `201 Created`**

```json
{
  "id": "uuid",
  "emergencyId": "uuid",
  "status": "registrada",
  "observations": "...",
  "ongs": [{ "id": "uuid-ong-1", "name": "Cruz Roja Argentina", "role": "principal" }],
  "items": [{ "id": "uuid", "loteId": "uuid-lote-1", "quantityOffered": 3, "notes": null }],
  "createdAt": "2026-09-24T14:10:00.000Z",
  "updatedAt": "2026-09-24T14:10:00.000Z"
}
```

### `GET /api/emergencies/:emergencyId/ofertas/mine`

Lista únicamente las ofertas de la ONG asociada a la sesión iniciada, para
que su representante pueda consultar lo que ya cargó. Requiere el rol
`representante_ong` y devuelve un array con el mismo shape que el alta.

Devuelve `409 Conflict` si el usuario de Bonita tiene el rol de ONG pero no
existe una fila de `ongs` vinculada mediante `bonita_org_ref`.

### `PUT /api/ofertas/:id`

Edita/actualiza una oferta **mientras la convocatoria de su emergencia sigue
abierta** (`emergencies.status = 'convocatoria_abierta'`); fuera de esa
ventana debe devolver `409 Conflict`. Mismo body que el alta (`observations`,
`partnerOngIds`, `items`). Si viene `partnerOngIds`, reemplaza las ONGs
asociadas; solo puede hacerlo la ONG principal (si no, `403`). Solo una ONG asociada a la oferta puede modificarla; el intento de
otra ONG devuelve `403 Forbidden`.

Cada edición **debe** guardar una fila nueva en `oferta_historial` (snapshot
completo de la oferta antes del cambio, `version` incremental) — es el
requisito de trazabilidad del enunciado. `changed_by` guarda el id/usuario de
Bonita que hizo el cambio (texto libre, sin FK).

**Respuesta `200 OK`**: mismo shape que el alta.

### `GET /api/emergencies/:emergencyId/ofertas`

Lista las ofertas de una emergencia para el Centro Coordinador. **El shape cambió
en la Entrega 5**: trae las ofertas con su perfil de validación y la cobertura por
lote (ver "Entrega 5 → Para el cliente").

### `GET /api/ofertas/ongs`

Lista las ONGs de la red (`[{ "id", "name", "bonitaOrgRef" }]`), para elegir
con quién formar un consorcio. Requiere el rol `representante_ong`.

### `GET /api/ofertas/:id/historial`

Devuelve las versiones guardadas de una oferta propia, más vieja primero.
Requiere sesión con rol `representante_ong` y que la ONG esté asociada a la
oferta.

```json
[
  { "version": 1, "snapshot": { "...": "..." }, "changedBy": "bonita-user-42", "changedAt": "2026-09-24T14:10:00.000Z" }
]
```

### `GET /api/emergencies/:emergencyId/ofertas/consolidado`

**Este es el endpoint que consulta Bonita**, según la directiva de
integración del enunciado ("Mecanismo de Consulta y Comunicación"): cuando
vence el temporizador de la convocatoria, un conector de Bonita hace un `GET`
acá para pedir el listado consolidado de ofertas, y recién con esa respuesta
Bonita llama a la API del Sistema Nacional. Se documenta desde ahora para que
el formato no lo termine inventando cada uno por su lado, aunque su uso real
arranca en una fase posterior del roadmap (Fase 5 en adelante / Entrega 3).

**Respuesta `200 OK`**

```json
{
  "emergencyId": "uuid",
  "lotes": [
    { "id": "uuid-lote-1", "resourceType": "Paramédicos", "unit": "personas", "quantityRequested": 5 }
  ],
  "ofertas": [
    {
      "id": "uuid",
      "status": "registrada",
      "ongs": [{ "id": "uuid-ong-1", "name": "Cruz Roja Argentina", "role": null }],
      "items": [{ "loteId": "uuid-lote-1", "quantityOffered": 3 }],
      "observations": null,
      "createdAt": "2026-09-24T14:10:00.000Z",
      "updatedAt": "2026-09-24T14:10:00.000Z"
    }
  ]
}
```

**Reemplazado** por
`GET /api/internal/emergencies/:id/consolidado` (ver "Entrega 5 → Para Bonita"):
devuelve directamente el body de `POST /validaciones` del Sistema Nacional y
Bonita se autentica con el header `X-Integration-Key`.

### Enums

- `OfertaStatus`: `registrada`, `retirada`, `validada`, `adjudicada`,
  `no_seleccionada`, `finalizada` (ver "Entrega 5 → Estados y transiciones").
  Cada item de una oferta trae también `resourceCode`.

## Entrega 5: ciclo completo orquestado por Bonita

Origen: secciones 4 y 5 de [`roadmapfase5.md`](../roadmapfase5.md) (E5-02); este
archivo es la fuente única. El contrato del Sistema Nacional (sin cambios) está
en [`api-contracts-sistema-nacional.md`](./api-contracts-sistema-nacional.md).
Las constantes (estados, transiciones, tipos de aviso, duración de la ventana)
viven en `web-app/shared/workflow.js`.

### Estados y transiciones

Emergencia: `registrada → convocatoria_abierta → convocatoria_cerrada →
validada → adjudicada → en_ejecucion → finalizada`.

| Desde | Hacia | Lo dispara |
|---|---|---|
| `registrada` | `convocatoria_abierta` | Publicar convocatoria (coordinador) |
| `convocatoria_abierta` | `convocatoria_cerrada` | Bonita, al vencer el timer (`PATCH …/estado`) |
| `convocatoria_cerrada` | `validada` | Bonita, al guardar los resultados del SN (`POST …/validaciones`, también con 0 ofertas) |
| `validada` | `convocatoria_abierta` | Decisión **reabrir** |
| `validada` | `registrada` | Decisión **reformular** |
| `validada` | `adjudicada` | Bonita, al confirmar el compromiso (`POST …/compromiso-confirmado`) |
| `adjudicada` | `en_ejecucion` | Bonita ("Etapa Ejecución", `PATCH …/estado`) |
| `en_ejecucion` | `finalizada` | Bonita ("Liberar recursos", `PATCH …/estado`) |

Cualquier otra transición responde `409`. Cada cambio deja una fila en
`emergency_status_history` (alimenta el dashboard).

Oferta: `registrada`, `retirada`, `validada`, `adjudicada`, `no_seleccionada`,
`finalizada`. Al adjudicar, la selección del municipio se guarda aparte
(`adjudicaciones`) y las ofertas **solo pasan a `adjudicada` /
`no_seleccionada` cuando el SN confirma el compromiso**; si el SN rechaza, nada
cambia. Las ofertas solo se crean o editan con la emergencia en
`convocatoria_abierta`; al cerrar la convocatoria quedan bloqueadas.

Además de `GET /api/emergencies` y `GET /api/emergencies/:id`, la emergencia expone
`duracionConvocatoriaMin` y `ultimoConflictoCompromiso` (`null`, o
`{ detalle, registradoAt }` con el último `409` del SN).

### Para Bonita (`/api/internal/*`)

Bonita llama sin sesión de usuario. Se autentica con el header
`X-Integration-Key: <BONITA_INTEGRATION_KEY>` (secreto en `server/.env`; en Bonita
es el parámetro del proceso `claveIntegracion`). Sin el header o con otro valor →
`401`; si la clave no está configurada en el server → `503`. `:id` debe ser un UUID
(`400` si no).

| Método y ruta | Qué hace |
|---|---|
| `GET /api/internal/emergencies/:id/consolidado` | Body de `POST /validaciones` del SN: `{emergenciaId, severidad, lotes:[{id, recursoCodigo, cantidadSolicitada}], ofertas:[{ofertaId, ongs:[{ref, rol}], items:[{loteId, recursoCodigo, cantidadOfrecida}]}]}`. Solo ofertas no retiradas; `rol` = `principal`, y `asociada` → `apoyo` |
| `PATCH /api/internal/emergencies/:id/estado` | `{estado}`; solo `convocatoria_cerrada`, `en_ejecucion` o `finalizada` (`400` con otro valor); valida la whitelist (`409` si no corresponde). Idempotente: si ya está en ese estado responde `200` con `alreadyApplied: true` |
| `POST /api/internal/emergencies/:id/validaciones` | Respuesta del SN `{resultados, resumen}`. Exige emergencia `convocatoria_cerrada` y un resultado por cada oferta no retirada (`400` si no coinciden). Guarda los perfiles, ofertas → `validada`, emergencia → `validada`. Con 0 ofertas, `resultados: []`. Idempotente: si la emergencia ya está `validada` responde `200` con `alreadyApplied: true` (reintento de Bonita) |
| `GET /api/internal/emergencies/:id/adjudicacion` | Body de `POST /compromisos` del SN con la selección del municipio: `{emergenciaId, ofertas:[{ofertaId, ongs, items:[{recursoCodigo, cantidad}]}]}`. La `cantidad` es lo habilitado por el SN en la validación (tope: lo ofrecido), sumado por recurso; un lote que el SN no habilitó no se compromete. `409` si el municipio no eligió nada |
| `POST /api/internal/emergencies/:id/compromiso-confirmado` | `{compromisos}` del SN (`compromisoId`, `ofertaId`, `reparto`). Ofertas elegidas → `adjudicada`, el resto de las validadas → `no_seleccionada`, emergencia → `adjudicada`. Idempotente: si ya está `adjudicada` responde `200` con `alreadyApplied: true` |
| `POST /api/internal/emergencies/:id/compromiso-fallido` | `{detalle}` del `409` del SN. La selección queda sin efecto, el detalle se guarda en `ultimoConflictoCompromiso` y la emergencia sigue `validada` |
| `GET /api/internal/emergencies/:id/finalizacion` | `{ongRefs:[…]}` de las ONGs cuya oferta está `finalizada` |
| `POST /api/internal/emergencies/:id/notificaciones` | `{tipo: CONVOCATORIA \| CIERRE_CONVOCATORIA \| COMPROMISO}`; la web-app decide los destinatarios (ver "Avisos"). Responde `{emergenciaId, tipo, created}` |

Los endpoints `POST /api/notifications/convocatoria` y `/cierre` (con Bearer) **se
retiraron**: los reemplaza `POST …/notificaciones`.

### Para el cliente (sesión de Bonita; el rol se valida en el backend)

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `POST /api/emergencies/:id/convocatoria` | coordinador | `{duracionMinutos?}`; completa "Publicar Convocatoria" con el input `duracionConvocatoria` |
| `GET /api/emergencies/:id/ofertas` | coordinador | `{emergencyId, status, todosLosLotesCubiertos, lotes:[{id, resourceType, resourceCode, unit, quantityRequested, cubierta}], ofertas:[{…oferta, validacion}]}`; `validacion` = `{nivelHabilitacion, rolSugerido, nivelRiesgoPermitido, capacidadesHabilitadas, observaciones}` o `null` si todavía no se validó; `cubierta` y `todosLosLotesCubiertos` son `null` mientras no haya una validación vigente |
| `POST /api/emergencies/:id/decision` | coordinador | `{camino: continuar \| reabrir \| reformular, duracionMinutos?}` (la duración solo aplica al reabrir). Requiere emergencia `validada`. Completa "Decidir como Continuar" con el input `camino` y aplica el efecto de abajo |
| `GET /api/emergencies/:id/ofertas/validadas` | municipio | Mismo shape, solo ofertas `validada` |
| `POST /api/emergencies/:id/adjudicacion` | municipio | `{ofertaIds:[…]}`; guarda la selección (reemplaza la anterior) y completa "Adjudicar Ofertas"; si Bonita falla, revierte (`502`). El último `409` del SN se expone en `GET /api/emergencies/:id` (`ultimoConflictoCompromiso`) |
| `POST /api/ofertas/:id/finalizar` | ONG | Solo si la oferta está `adjudicada` y es de su ONG (`409` si no; idempotente si ya estaba `finalizada`) |
| `POST /api/emergencies/:id/cierre-ejecucion` | coordinador | Solo con la emergencia `en_ejecucion` y todas las adjudicadas `finalizada` (`409` con `detalle.pendientes` si no); completa "Confirmar cierre de ejecución". El pase a `finalizada` lo hace Bonita después |
| `GET /api/notifications`, `PATCH /api/notifications/:id/leida` | ONG | Bandeja (ver "Avisos") |
| `GET /api/inventario`, `PUT /api/inventario` | ONG | Stock leído y actualizado en el SN (ver "Inventario") |

**Efectos de la decisión** (`POST …/decision`):

- **continuar**: sin cambios en la base; solo se completa la tarea en Bonita, que sigue a "Adjudicar Ofertas".
- **reabrir**: las ofertas vuelven a `registrada`, se descarta la selección vieja, la emergencia pasa a `convocatoria_abierta` con la nueva duración y se completan "Decidir como Continuar" y "Publicar Convocatoria" (con `duracionConvocatoria`). Si Bonita falla se revierte.
- **reformular**: las ofertas pasan a `retirada` (snapshot en `oferta_historial`, `changed_by = reformular:<usuario>`), se borran sus renglones (`oferta_lotes`), cada ONG con oferta recibe un aviso `OFERTA_RETIRADA` en el mismo paso, y la emergencia vuelve a `registrada` para rearmar lotes y publicar de nuevo. Todo en una transacción que solo se confirma si Bonita avanza.

Si Bonita no tenía pendiente la tarea que se pide, la web-app responde `502` y no aplica el cambio.

**Inputs que la web-app manda a Bonita** (deben coincidir con el contrato de cada tarea
en el `.proc`): "Publicar Convocatoria" → `{duracionConvocatoria: <entero, minutos>}`;
"Decidir como Continuar" → `{camino: "continuar" | "reabrir" | "reformular"}` (en
minúsculas). Las demás tareas se completan con `{}`.

**Nombres exactos de tareas que la web-app completa:** "Registrar Emergencia",
"Revisar Emergencia", "Generar Lotes de Necesidades", "Publicar Convocatoria",
"Adjudicar Ofertas", "Decidir como Continuar", "Confirmar cierre de ejecución".

### Avisos (bandeja de la ONG)

Tipos: `CONVOCATORIA`, `CIERRE_CONVOCATORIA`, `OFERTA_RETIRADA` (la emite la propia
web-app al reformular), `ADJUDICADA`, `NO_SELECCIONADA`. Bonita manda el tipo
`COMPROMISO` y la web-app genera `ADJUDICADA` (ONGs con alguna oferta
adjudicada) o `NO_SELECCIONADA` (ONGs cuyas ofertas no fueron elegidas y que no
tienen ninguna adjudicada). `CONVOCATORIA` y `CIERRE_CONVOCATORIA` van a todas las
ONGs de la red. Cada pedido exige el estado correspondiente de la emergencia
(`convocatoria_abierta`, `convocatoria_cerrada`, `adjudicada`/`en_ejecucion`) o
responde `409`.

Un aviso es único por `(emergencia, ONG, tipo, ronda)`: la ronda cuenta las veces
que se publicó la convocatoria, así los reintentos de Bonita no duplican y al
reabrir las ONGs vuelven a recibir aviso.

`GET /api/notifications` (rol `representante_ong`) devuelve los avisos de la ONG de
la sesión, más recientes primero: `[{id, tipo, emergencyId, emergencyDescription,
emergencyType, emergencySeverity, emergencyProvince, emergencyMunicipality,
emergencyStatus, leida, leidaAt, createdAt}]`. `PATCH /api/notifications/:id/leida`
marca como leído un aviso propio (`404` si no existe o es de otra ONG).

### Inventario

Pantalla "Mi inventario". El backend de la web-app habla con el SN con la cuenta de
integración (`SN_INTEGRATION_USERNAME` / `SN_INTEGRATION_PASSWORD`; URL en
`SISTEMA_NACIONAL_API_URL`, por defecto la de Render) y toma la ONG **siempre de la
sesión** (`ongRef`). Es la **única excepción** a "solo Bonita habla con el SN":
es mantenimiento del stock, no un paso del ciclo.

- `GET /api/inventario` → `[{recursoCodigo, nombre, unidad, cantidadTotal, cantidadComprometida, cantidadDisponible}]`.
- `PUT /api/inventario` con `{recursos:[{recursoCodigo, cantidadTotal}]}` (enteros ≥ 0)
  → el stock completo. Errores: `400` datos inválidos o recurso desconocido; `409` si el
  total quedaría por debajo de lo comprometido (con `detalle`) o si la ONG no está en el
  SN; `502` si el SN no responde (el primer pedido puede tardar ~1 minuto por el
  arranque en frío de Render; el timeout es de 90 s).

## Dashboard

`GET /api/dashboard/indicadores` — rol `auditor` (`401` sin sesión, `403` otro rol).
Solo datos propios de Postgres; no usa Bonita. Cuentan las ofertas `adjudicada` y
`finalizada`. El mes de un suministro es el de la fecha de adjudicación de la oferta
(`adjudicaciones.created_at`, `YYYY-MM`; si hubiera varias, la más reciente). Es la fecha en
que el municipio eligió la oferta, no cambia al finalizarla. En `estadoProyectos` solo
aparecen los estados que tienen emergencias.

```json
{
  "suministrosMovilizados": [{ "mes": "2026-11", "recursoCodigo": "raciones", "cantidad": 180 }],
  "resolucionConsorcios": { "emergenciasFinalizadas": 2, "conConsorcio": 1, "porcentaje": 50 },
  "estadoProyectos": [
    {
      "estado": "finalizada",
      "cantidad": 2,
      "emergencias": [
        { "id": "uuid", "type": "incendio", "severity": "alta", "province": "Buenos Aires",
          "municipality": "La Plata", "createdAt": "ISO" }
      ]
    }
  ],
  "coberturaLotes": { "lotes": 3, "promedioPorcentaje": 50 }
}
```

- `conConsorcio`: emergencias finalizadas con al menos una oferta vigente de 2 o más ONGs.
- `coberturaLotes`: por lote, cantidad cubierta (tope = pedida) / `quantity_requested`,
  promediada sobre todos los lotes (los sin cobertura cuentan 0). Porcentajes con 1 decimal.
- Sin datos: listas vacías y porcentajes en 0.

### GET /api/dashboard/tiempos-etapas

Rol `auditor` (`401` sin sesión, `403` otro rol). Datos de la API REST de Bonita: los
consulta el backend con la sesión de Bonita del propio auditor logueado
(`req.session.bonita`), solo `GET`; el navegador no habla con Bonita. Requiere que el
usuario auditor tenga perfil Administrador en Bonita (confirmado por el profesor en consulta
del 13/11).

Query opcional: `desde` y `hasta` (`YYYY-MM-DD`, inclusive); filtran por fecha de inicio del
caso. `400` si el formato es inválido o `desde` > `hasta`.

Respuesta `200`:

```json
{
  "periodo": { "desde": "2026-11-01", "hasta": "2026-11-30" },
  "casosAnalizados": 4,
  "etapas": [
    { "etapa": "registro_publicacion", "casos": 3, "promedioMinutos": 3.5,
      "minMinutos": 2.1, "maxMinutos": 5 }
  ]
}
```

`periodo.desde` y `periodo.hasta` son `null` si no se pasaron. Etapas, siempre las 5 y en
este orden:

- `registro_publicacion`: "Registrar Emergencia" → "Publicar Convocatoria".
- `ventana_ofertas`: "Publicar Convocatoria" → "Notificar Cierre de Convocatoria a ONGS".
- `validacion_adjudicacion`: "Validar Ofertas" → "Adjudicar Ofertas".
- `ejecucion`: "Etapa Ejecución" → "Liberar recursos".
- `total`: inicio → fin del caso (solo casos terminados).

Reglas:

- Un caso cuenta en una etapa solo si tiene las dos puntas. Si una tarea aparece varias
  veces (reabrir/reformular) se toma la primera aparición de la tarea de inicio y la última
  de la de fin.
- Minutos con 1 decimal. Etapa sin casos: `casos` 0 y `promedioMinutos`/`minMinutos`/
  `maxMinutos` en `null`.
- El filtro por recurso no aplica (Bonita no conoce recursos).

Errores (siempre `{ "message": "..." }`):

- `401` si Bonita responde `401` con la sesión del usuario: `"Tu sesión de Bonita venció.
  Volvé a iniciar sesión."`
- `502` si Bonita responde `403`: `"Bonita rechazó la consulta: el usuario auditor necesita
  perfil Administrador en Bonita."`
- `502` si Bonita no responde.

Fuente de las fechas: los casos salen de `bpm/case` (abiertos) y `bpm/archivedCase`
(terminados; `end_date` solo si `state` es `completed`) de todas las versiones del proceso;
las tareas, de `bpm/archivedActivity` con `state=completed`, usando `reached_state_date`.
Incluye tareas de servicio (por ejemplo, "Notificar Cierre de Convocatoria a ONGS").

### GET /api/dashboard/export

Rol `auditor`. Query: `formato=json|csv` (obligatorio), `desde` y `hasta` opcionales (mismas
reglas que en `tiempos-etapas`), `dataset` (obligatorio solo con `csv`): `suministros` |
`estado-proyectos` | `tiempos-etapas`. `400` si falta o no es válido.

- `json`: `{ "generadoAt": "ISO", "periodo": {...}, "indicadores": <igual que
  /indicadores>, "tiemposEtapas": <igual que /tiempos-etapas> | null, "avisos": [] }`. Si
  Bonita falla, `tiemposEtapas` = `null` y se agrega un aviso en `avisos`; responde `200`
  igual.
- `csv`: un archivo por dataset, UTF-8 con encabezado, separador coma.
  - `suministros`: `mes,recursoCodigo,cantidad`
  - `estado-proyectos`: `estado,id,type,severity,province,municipality,createdAt`
  - `tiempos-etapas`: `etapa,casos,promedioMinutos,minMinutos,maxMinutos` (si Bonita falla
    con este dataset: `502`).

Headers: `Content-Disposition: attachment`; nombre
`rescuesync-dashboard-<dataset|completo>-<YYYY-MM-DD>.<ext>`.

## Datos geográficos

El cliente consulta directamente la API pública Georef (datos.gob.ar, permite CORS):

- `GET /georef/api/municipios?provincia={provinceId}&campos=id,nombre,centroide&max=1000`
  para la lista de municipios (las provincias están fijas en el cliente).
- `GET /georef/api/ubicacion?lat=..&lon=..` para verificar en qué municipio cae el punto
  marcado en el mapa.

El mapa base es el gris oficial del IGN (Argenmap). El backend puede volver a validar
`provinceId`/`municipalityId` contra Georef si lo necesita.

## Modo mock del cliente

Mientras el endpoint no exista, el cliente corre con `VITE_USE_MOCK_API=true`
(valor por defecto) y guarda las emergencias en `localStorage`
(`rescuesync:emergencies`). Para usar el backend real: crear `client/.env` con
`VITE_USE_MOCK_API=false`. Vite redirige `/api` a `http://localhost:4000`.

## Notificaciones

Ver "Entrega 5 → Avisos" más arriba. Los avisos son solo dentro de la app (bandeja
de la ONG); el correo queda fuera de alcance. `bonita/README.md` documenta la
configuración de los conectores.
