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

### `POST /api/auth/login`

**Request body**

```json
{ "username": "OperadorM", "password": "..." }
```

| Respuesta | Cuándo | Body |
|---|---|---|
| `200 OK` + `Set-Cookie: connect.sid` | Bonita aceptó las credenciales | `{ "username": "OperadorM" }` |
| `400 Bad Request` | falta `username` o `password` | `{ "message": "Usuario y contraseña son obligatorios." }` |
| `401 Unauthorized` | Bonita rechazó las credenciales | `{ "message": "Usuario o contraseña incorrectos." }` |
| `502 Bad Gateway` | Bonita no respondió (Studio cerrado, URL mal) | `{ "message": "No se pudo conectar con Bonita." }` |

### `GET /api/auth/me`

Indica si hay sesión iniciada. El cliente lo llama al arrancar (así la
sesión sobrevive a un F5).

| Respuesta | Cuándo | Body |
|---|---|---|
| `200 OK` | hay sesión | `{ "username": "OperadorM" }` |
| `401 Unauthorized` | no hay sesión o expiró | `{ "message": "No hay sesión iniciada." }` |

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

`bonitaCaseId` es el id de la instancia de proceso creada en Bonita (`null` si
todavía no se pudo iniciar).

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
  temporizador de Bonita). Más valores se van a sumar cuando se integre
  la validación/adjudicación con el Sistema Nacional (Entrega 3).

Definidos en el cliente en
`client/src/features/emergencies/emergency-constants.js` y como `CHECK`
constraints en `server/migrations/*_create-core-schema.sql`.

## Lotes

Corresponden a la tabla `lotes` (ver migración del esquema). Los crea el
**Centro Coordinador Regional** al desglosar una emergencia (ej: 5
Paramédicos, 1000 raciones de alimento).

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

### `GET /api/emergencies/:emergencyId/lotes`

Lista los lotes de una emergencia (mismo shape que el array `lotes` de
arriba). Lo usan tanto la pantalla del Coordinador como, más adelante, la
del Sistema Nacional.

### `POST /api/emergencies/:emergencyId/convocatoria`

Publica oficialmente la convocatoria: pasa `emergencies.status` de
`registrada` a `convocatoria_abierta`. Requiere que la emergencia tenga al
menos un lote cargado. Esta acción es la que, en la Fase 5 del roadmap, va a
disparar también la llamada para **completar la tarea correspondiente en
Bonita** (usando el login service, ver `roadmapfase2.md`).

**Respuesta `200 OK`**

```json
{ "emergencyId": "uuid", "status": "convocatoria_abierta" }
```

**Respuesta `409 Conflict`** si la emergencia no tiene lotes o ya tiene la
convocatoria abierta/cerrada:

```json
{ "message": "La emergencia no tiene lotes cargados." }
```

## Ofertas

Corresponden a las tablas `ofertas`, `oferta_ongs` (consorcio) y
`oferta_lotes` (qué cubre cada oferta y con qué cantidad). Las cargan las
**ONGs**, mientras la convocatoria está abierta.

### `POST /api/emergencies/:emergencyId/ofertas`

Alta de una oferta. `ongIds` acepta uno o varios ids para modelar consorcios
(varias ONGs asociándose en una misma oferta).

**Request body**

```json
{
  "ongIds": ["uuid-ong-1", "uuid-ong-2"],
  "observations": "Podemos cubrir también transporte si hace falta.",
  "items": [
    { "loteId": "uuid-lote-1", "quantityOffered": 3, "notes": null }
  ]
}
```

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `ongIds` | string[] (uuid) | sí | al menos 1 id de ONG existente |
| `observations` | string \| null | no | |
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
  "ongs": [{ "id": "uuid-ong-1", "name": "Cruz Roja Argentina", "role": null }],
  "items": [{ "id": "uuid", "loteId": "uuid-lote-1", "quantityOffered": 3, "notes": null }],
  "createdAt": "2026-09-24T14:10:00.000Z",
  "updatedAt": "2026-09-24T14:10:00.000Z"
}
```

### `PUT /api/ofertas/:id`

Edita/actualiza una oferta **mientras la convocatoria de su emergencia sigue
abierta** (`emergencies.status = 'convocatoria_abierta'`); fuera de esa
ventana debe devolver `409 Conflict`. Mismo body que el alta (`observations`,
`items`; `ongIds` también editable).

Cada edición **debe** guardar una fila nueva en `oferta_historial` (snapshot
completo de la oferta antes del cambio, `version` incremental) — es el
requisito de trazabilidad del enunciado. `changed_by` guarda el id/usuario de
Bonita que hizo el cambio (texto libre, sin FK).

**Respuesta `200 OK`**: mismo shape que el alta.

### `GET /api/emergencies/:emergencyId/ofertas`

Lista las ofertas de una emergencia (mismo shape que la respuesta del alta,
en array). La usa el Centro Coordinador para revisarlas.

### `GET /api/ofertas/:id/historial`

Devuelve las versiones guardadas de una oferta, más vieja primero:

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

**Pendiente de definir** (no bloquea la Fase 0): cómo se autentica esta
llamada de Bonita hacia el server — a diferencia del login de usuarios (que
va contra el login service de Bonita), acá es Bonita llamando **hacia**
nuestro server. Podría resolverse con un secreto compartido simple. Definir
en la Fase 5 del roadmap.

### Enums

- `OfertaStatus`: `registrada`, `retirada`

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
