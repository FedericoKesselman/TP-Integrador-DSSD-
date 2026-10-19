# Contrato de la API del Sistema Nacional (SN)

Fuente única del contrato del Sistema Nacional de Gestión de Recursos y
Riesgos (`sistema-nacional/`). Lo consumen Bonita (conectores REST) y, para
pruebas, Swagger UI. Si cambia un endpoint, un campo o un estado: se avisa al
equipo y se edita **este archivo primero**, después el código y
`sistema-nacional/openapi.yaml` (la versión navegable en `/docs`).

Origen: sección 4 de [`roadmapfase3.md`](../roadmapfase3.md) (E3-01).

## Generalidades

- **Base URL:** `https://<servicio>.onrender.com` en producción;
  `http://localhost:5000` en local (`docker compose up` en `sistema-nacional/`).
- **Autenticación:** todo requiere `Authorization: Bearer <JWT>` salvo
  `POST /auth/login`, `GET /health` y `GET /docs` (`/docs.json` = OpenAPI).
- **JWT:** HS256, vence en 1 h (`expiresIn` = 3600). Claims:

  | Claim | Valor |
  |---|---|
  | `iss` | `rescuesync-sistema-nacional` |
  | `aud` | `rescuesync` |
  | `sub` | username de la cuenta |
  | `exp` / `iat` | vencimiento / emisión |
  | `role` | `integracion` (la usa Bonita) o `ong` |
  | `ongRef` | solo para `role = ong`: el `ref` de su ONG |

  Bonita hace login justo antes de cada llamada (el token dura 1 h y el
  flujo puede durar más).
- **Errores:** siempre `{ "message": "…" }` (y `detalle` opcional, ej. en el
  409 de stock). Códigos: 400 datos inválidos, 401 sin token / token inválido
  o vencido / credenciales incorrectas, 403 rol sin permiso, 404 no existe,
  409 conflicto, 429 demasiados intentos de login.
- **Solo HTTPS** en producción (HTTP plano responde 403).
- **`recursoCodigo`:** id del catálogo del cliente
  (`web-app/client/src/features/lotes/lote-constants.js`: `paramedicos`,
  `raciones`, …). El SN tiene la misma lista en `recursos_catalogo`.
- **`ref` de ONG:** slug compartido con la web-app
  (`ongs.bonita_org_ref` allá), ej. `rescatistas-unidos`.

## Endpoints

| Método y ruta | Rol | Descripción | Estado |
|---|---|---|---|
| `POST /auth/login` | público | `{username,password}` → `{accessToken,tokenType:"Bearer",expiresIn}` | Hecho |
| `GET /health` | público | Healthcheck (API + base) | Hecho |
| `GET /docs` | público | Swagger UI (`/docs.json` con el OpenAPI) | Hecho (esqueleto) |
| `POST /ongs` | integracion | Onboarding: `{ref,nombre,nivelOperativo(1-4),username,password,recursos?:[{recursoCodigo,cantidadTotal}]}` → crea ONG habilitada + su usuario | Hecho |
| `GET /ongs` | autenticado | ONGs habilitadas | Hecho |
| `PUT /ongs/:ref/recursos` | integracion | Alta/actualización de stock: `[{recursoCodigo,cantidadTotal}]` | Hecho |
| `GET /ongs/:ref/recursos` | integracion, o la propia `ong` | Total, comprometido y disponible por recurso | Hecho |
| `GET /recursos/disponibilidad` | autenticado | Disponibilidad global por `recursoCodigo` | Hecho |
| `POST /validaciones` | integracion | Evalúa ofertas (ver abajo). Lee con lock, no reserva | Hecho |
| `POST /compromisos` | integracion | Reserva transaccional de **todas** las ofertas adjudicadas (todo o nada); idempotente por `(emergenciaId, ofertaId)` | Pendiente |
| `POST /emergencias/:emergenciaId/finalizacion` | integracion | `{ongRefs:[…]}`: ONGs que terminaron su actividad | Hecho |
| `POST /emergencias/:emergenciaId/cierre` | integracion | Cierra el proyecto y libera todo lo comprometido | Hecho |

### `POST /auth/login`

```json
{ "username": "rescuesync-integracion", "password": "…" }
```

`200 OK`:

```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIs…", "tokenType": "Bearer", "expiresIn": 3600 }
```

`400` si falta `username` o `password`; `401` si no coinciden (mismo
mensaje exista o no el usuario); `429` después de 10 intentos en 15 minutos
desde la misma IP.

### ONGs y stock (E3-20)

- `POST /ongs` → `201` con la ONG, su `username` y `recursos` (stock como en
  `GET /ongs/:ref/recursos`). Todo o nada: si falla algo, no queda la ONG a
  medio crear. `400` con `detalle.recursosDesconocidos` si un código no está
  en el catálogo; `409` con `detalle.campo` (`ref` o `username`) si ya existe.
  `password` de al menos 8 caracteres; `ref` en minúsculas con guiones.
- `GET /ongs` → `[{ ref, nombre, nivelOperativo, habilitada }]`.
- `PUT /ongs/:ref/recursos` → crea o actualiza `cantidadTotal` de los
  recursos enviados (los no enviados no cambian) y devuelve el stock completo.
  `409` con `detalle.insuficientes` si un total quedaría por debajo de lo ya
  comprometido; en ese caso no cambia nada. `404` si la ONG no existe.
- `GET /ongs/:ref/recursos` →
  `[{ recursoCodigo, nombre, unidad, cantidadTotal, cantidadComprometida, cantidadDisponible }]`.
  Una cuenta `ong` solo puede pedir el suyo (`403` si no).
- `GET /recursos/disponibilidad` → mismo shape por recurso, sumado entre las
  ONGs habilitadas, más `categoria` y `ongsConDisponible`. Incluye todo el
  catálogo (en 0 si nadie lo tiene).

### `POST /validaciones`

Request (es exactamente lo que devuelve el `consolidado` de la web-app):

```json
{
  "emergenciaId": "uuid", "severidad": "alta",
  "lotes": [{ "id": "uuid", "recursoCodigo": "paramedicos", "cantidadSolicitada": 5 }],
  "ofertas": [{
    "ofertaId": "uuid",
    "ongs": [{ "ref": "rescatistas-unidos", "rol": "principal" }],
    "items": [{ "loteId": "uuid", "recursoCodigo": "paramedicos", "cantidadOfrecida": 3 }]
  }]
}
```

Response (nunca un rechazo binario: toda oferta recibe un perfil):

```json
{
  "emergenciaId": "uuid",
  "resultados": [{
    "ofertaId": "uuid",
    "nivelHabilitacion": "PLENO | PARCIAL | APOYO | SIN_CAPACIDAD",
    "rolSugerido": "principal | apoyo",
    "nivelRiesgoPermitido": "baja | media | alta | critica",
    "capacidadesHabilitadas": [{ "loteId": "uuid", "recursoCodigo": "paramedicos",
                                  "cantidadHabilitada": 3, "cantidadOfrecida": 3 }],
    "observaciones": ["…"]
  }],
  "resumen": { "todosLosLotesCubiertos": false,
               "cobertura": [{ "loteId": "uuid", "solicitada": 5, "cubierta": 3 }] }
}
```

Reglas:

- Cobertura = habilitado / ofrecido. `PLENO` ≥ 100 %, `PARCIAL` ≥ 50 %,
  `APOYO` > 0 %, `SIN_CAPACIDAD` = 0 %.
- Riesgo permitido = mínimo entre el nivel operativo de las ONGs y un tope
  por cobertura (PLENO → `critica`, PARCIAL → `alta`, APOYO → `media`).
- Con consorcio, `habilitada = min(ofrecida, disponible sumado de las ONGs de la oferta)`.
- Con 0 ofertas, `resultados` es `[]` y `todosLosLotesCubiertos` es `false`.

Precisiones de la implementación (E3-21), para lo que el contrato no define:

- Con varios ítems, la cobertura de la oferta es el **promedio** de la de cada
  ítem: `PLENO` = todos los ítems completos; `SIN_CAPACIDAD` = ninguno.
- `rolSugerido`: `principal` si el nivel es `PLENO` o `PARCIAL`; `apoyo` si es
  `APOYO` o `SIN_CAPACIDAD`.
- Nivel operativo → riesgo: 1 = `baja`, 2 = `media`, 3 = `alta`, 4 = `critica`.
  Con consorcio se toma el **menor** nivel entre las ONGs de la oferta.
  `SIN_CAPACIDAD` tiene tope `baja`.
- Una ONG inexistente o no habilitada **no cuenta** y no rechaza el pedido: se
  informa en `observaciones` (si ninguna cuenta, la oferta queda
  `SIN_CAPACIDAD`).
- Si el riesgo permitido es menor que la `severidad` de la emergencia, se agrega
  una observación; no cambia el nivel.
- `cubierta` de cada lote suma lo habilitado de todas las ofertas, con tope en
  `solicitada`.
- La validación **no reserva**: dos ofertas de la misma ONG ven el mismo stock.
  Lo controla `/compromisos` con el `409`.
- `400` con `detalle` por campo (ej. `ofertas[0].items[0].loteId`) si el body no
  respeta el formato: UUIDs, `severidad` válida, al menos un lote, cantidades
  enteras mayores a 0, ítems que coinciden con un lote del pedido.

### `POST /compromisos`

```json
{ "emergenciaId": "uuid",
  "ofertas": [{ "ofertaId": "uuid",
                "ongs": [{ "ref": "rescatistas-unidos", "rol": "principal" }],
                "items": [{ "recursoCodigo": "paramedicos", "cantidad": 3 }] }] }
```

```json
{ "emergenciaId": "uuid",
  "compromisos": [{ "compromisoId": "uuid", "ofertaId": "uuid",
                    "reparto": [{ "ongRef": "rescatistas-unidos", "recursoCodigo": "paramedicos", "cantidad": 3 }] }] }
```

El SN reparte automáticamente la cantidad entre las ONGs de la oferta
(principal primero, luego asociadas, hasta su disponible). Si falta stock →
`409` con el detalle de qué recurso y de qué ONG; no se reserva nada.

### Finalización y cierre (E3-23)

`POST /emergencias/:emergenciaId/finalizacion` con `{ "ongRefs": ["…"] }`
registra qué ONGs terminaron su actividad. No libera recursos. Es
idempotente: repetir una ONG no cambia su fecha.

```json
{ "emergenciaId": "uuid",
  "finalizadas": [{ "ongRef": "rescatistas-unidos", "finalizadaAt": "2026-10-20T15:00:00.000Z" }],
  "ongsSinFinalizar": ["manos-solidarias"] }
```

`ongsSinFinalizar` = ONGs con compromisos activos en la emergencia que
todavía no informaron. `400` si `ongRefs` viene vacío o si alguna ONG no
existe en el SN (`detalle.ongRefsDesconocidas`).

`POST /emergencias/:emergenciaId/cierre` (sin body) cierra el proyecto:
pasa a `liberado` todos los compromisos activos de la emergencia y les
devuelve el stock a las ONGs (`cantidad_comprometida -= …`).

```json
{ "emergenciaId": "uuid", "compromisosLiberados": 2,
  "recursosLiberados": [{ "ongRef": "rescatistas-unidos", "recursoCodigo": "paramedicos", "cantidad": 4 }],
  "ongsSinFinalizar": [] }
```

- Siempre `200`, también sin compromisos (emergencia sin ofertas
  adjudicadas): devuelve `compromisosLiberados: 0`.
- Idempotente y seguro ante reintentos o llamadas concurrentes de Bonita:
  solo la primera llamada libera; las demás devuelven 0.
- No exige que todas las ONGs hayan finalizado (eso lo controla la web-app
  en "Confirmar cierre de ejecución"); `ongsSinFinalizar` lo informa.

Ambos endpoints: rol `integracion`; `400` si `emergenciaId` no es un UUID.

## Concurrencia

Una transacción por llamada (`withTransaction` en `sistema-nacional/src/db.js`);
`SELECT … FOR UPDATE` sobre las filas de `ong_recursos` involucradas,
**ordenadas por id** (evita deadlocks); `CHECK (cantidad_comprometida <=
cantidad_total)` como red de seguridad en la base.

**Orden de bloqueo** (obligatorio para todo endpoint que toque stock, así
dos transacciones nunca se esperan en cruz): primero las filas de
`compromisos` que se van a modificar, después las de `ong_recursos`, siempre
`ORDER BY id`. El cierre (E3-23) ya lo respeta; `/compromisos` (E3-22) tiene
que hacer lo mismo si consulta compromisos existentes para la idempotencia.

## Cuentas

- Una cuenta de **integración** (rol `integracion`), creada por
  `npm run seed` con `SN_INTEGRATION_USERNAME` / `SN_INTEGRATION_PASSWORD`.
- **Una cuenta por ONG** (rol `ong`), creada por `POST /ongs` junto con la
  ONG; solo ve su propio stock.
