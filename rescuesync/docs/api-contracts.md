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
  `finalizada`. Los cuatro últimos son de la Entrega 3 (ver
  "Entrega 3" más abajo); hoy el `CHECK` de la base solo admite los tres
  primeros (se amplía en E3-50).

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
    { "resourceType": "Paramédicos", "unit": "personas", "quantityRequested": 5, "notes": null },
    { "resourceType": "Raciones de alimento", "unit": "raciones", "quantityRequested": 1000, "notes": "aptas para celiacos si es posible" }
  ]
}
```

| Campo (de cada lote) | Tipo | Requerido | Reglas |
|---|---|---|---|
| `resourceType` | string | sí | texto libre (tipo de recurso) |
| `unit` | string \| null | no | unidad del recurso ("personas", "raciones", "unidades") |
| `quantityRequested` | integer | sí | > 0 |
| `notes` | string \| null | no | |

**Respuesta `201 Created`**

```json
{
  "emergencyId": "uuid",
  "lotes": [
    { "id": "uuid", "resourceType": "Paramédicos", "unit": "personas", "quantityRequested": 5, "notes": null, "createdAt": "2026-09-24T14:00:00.000Z" }
  ]
}
```

**Respuesta `409 Conflict`** si la convocatoria ya fue publicada o cerrada.
Una vez que la emergencia deja el estado `registrada`, sus lotes quedan
bloqueados para conservar lo que se publicó a las ONGs.

### `GET /api/emergencies/:emergencyId/lotes`

Lista los lotes de una emergencia (mismo shape que el array `lotes` de
arriba). Lo usan tanto la pantalla del Coordinador como, más adelante, la
del Sistema Nacional.

### `POST /api/emergencies/:emergencyId/convocatoria`

Publica oficialmente la convocatoria: pasa `emergencies.status` de
`registrada` a `convocatoria_abierta`. Requiere que la emergencia tenga al
menos un lote cargado. Esta acción también **completa en Bonita** las tareas
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

Lista las ofertas de una emergencia (mismo shape que la respuesta del alta,
en array). La usa el Centro Coordinador para revisarlas.

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

**Reemplazado en la Entrega 3** por
`GET /api/internal/emergencies/:id/consolidado` (ver "Entrega 3" más abajo):
devuelve directamente el body de `POST /validaciones` del Sistema Nacional y
Bonita se autentica con el header `X-Integration-Key`.

### Enums

- `OfertaStatus`: `registrada`, `retirada` y, desde la Entrega 3,
  `validada`, `adjudicada`, `no_seleccionada`, `finalizada` (se suman al
  `CHECK` en E3-50).

## Entrega 3: rutas internas (Bonita) y nuevas del cliente

Origen: sección 5 de [`roadmapfase3.md`](../roadmapfase3.md) (E3-01). El
contrato del Sistema Nacional está en
[`api-contracts-sistema-nacional.md`](./api-contracts-sistema-nacional.md).
Todo esto está **pendiente de implementar** (Pistas D y E).

### Para Bonita (`/api/internal/*`)

Bonita llama sin sesión de usuario. Se autentica con el header
`X-Integration-Key: <BONITA_INTEGRATION_KEY>` (secreto en `server/.env` y en
los parámetros del proceso). Sin el header o con otro valor → `401`.

| Método y ruta | Qué hace |
|---|---|
| `GET /api/internal/emergencies/:id/consolidado` | Devuelve el body de `POST /validaciones` del SN (solo ofertas no retiradas; `rol` = `principal`/`asociada`→`apoyo` según `oferta_ongs`) |
| `PATCH /api/internal/emergencies/:id/estado` | `{estado}`; valida la transición contra una whitelist (incluye las inversas de reabrir/reformular) |
| `POST /api/internal/emergencies/:id/validaciones` | Guarda el `resultados` del SN, marca las ofertas `validada` y la emergencia `validada` |
| `GET /api/internal/emergencies/:id/adjudicacion` | Devuelve el body de `POST /compromisos` del SN con las ofertas adjudicadas |
| `GET /api/internal/emergencies/:id/finalizacion` | `{ongRefs:[…]}` de las ONGs que marcaron su oferta finalizada |
| `POST /api/internal/emergencies/:id/notificaciones` | `{tipo: CONVOCATORIA \| COMPROMISO}`; la web-app decide los destinatarios |

### Para el cliente (sesión de Bonita; el rol se valida en el backend)

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /api/emergencies/:id/ofertas` | coordinador | Ofertas con su perfil de validación |
| `POST /api/emergencies/:id/decision` | coordinador | `{camino: continuar \| reabrir \| reformular}`: completa "Decidir como Continuar" con `camino` y aplica el efecto (reabrir: ofertas → `registrada`, completa "Publicar Convocatoria", estado `convocatoria_abierta`; reformular: ofertas → `retirada`, estado `registrada`, el coordinador rearma lotes y vuelve a publicar con el endpoint existente) |
| `GET /api/emergencies/:id/ofertas/validadas` | municipio | Solo ofertas validadas, con perfil |
| `POST /api/emergencies/:id/adjudicacion` | municipio | `{ofertaIds:[…]}`; ofertas → `adjudicada`/`no_seleccionada`, completa "Adjudicar Ofertas"; si Bonita falla, revierte |
| `POST /api/ofertas/:id/finalizar` | ONG | Marca la oferta `finalizada` (solo si está `adjudicada` y es de su ONG) |
| `POST /api/emergencies/:id/cierre-ejecucion` | coordinador | Solo si todas las adjudicadas están `finalizada`; completa "Confirmar cierre de ejecución" |
| `GET /api/notificaciones`, `PATCH /api/notificaciones/:id/leida` | ONG | Bandeja de la ONG |

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

## Notificaciones persistentes de convocatoria

`POST /api/notifications/convocatoria` es una llamada técnica de Bonita.
Requiere `Authorization: Bearer <BONITA_NOTIFICATION_TOKEN>` y JSON
`{"emergenciaId":"UUID"}`. La emergencia debe estar en
`convocatoria_abierta`. Inserta un aviso por ONG de la red en una
transacción; la clave única `(emergency_id, ong_id)` evita duplicados.
Respuesta `200`: `{ "emergenciaId": "UUID", "created": 2 }` (cantidad
insertada, cero en un reintento sin nuevas ONG). Errores: `400`, `401`,
`404`, `409`, `500` y `503` si falta configurar el secreto.

`GET /api/notifications` requiere sesión de Bonita con rol
`representante_ong`. Devuelve los avisos de la ONG identificada por el
grupo de la sesión: `[{id, emergencyId, createdAt}]`, más recientes primero.
No permite consultar avisos de otra ONG mediante parámetros del cliente.

Ver `bonita/README.md` para configuración y reintentos. El correo y las
notificaciones de adjudicación quedan fuera de este contrato.
