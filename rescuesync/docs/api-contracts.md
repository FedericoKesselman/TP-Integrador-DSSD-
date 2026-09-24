# Contratos de la API (web-app)

Fuente única de la forma de los datos que viajan entre `web-app/client` y
`web-app/server`. Si cambia un campo o un enum, actualizar este documento y
los dos lados.

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
| `municipalityId` | string | null | sí |\| null | sí | código de municipio de Georef (ej. `"060441"`); en CABA es una comuna. `null` solo si la lista de Georef no estuvo disponible y el nombre se cargó a mano |
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
  "errors": { "severity": "Seleccioná el nivel de gravedad." }
}
```

El cliente muestra `message` en pantalla. Cualquier otro error debe devolver
también `{ "message": "..." }`.

### Enums

- `EmergencyType`: `inundacion`, `incendio`, `terremoto`, `otro`
- `Severity`: `baja`, `media`, `alta`, `critica`
- `EmergencyStatus`: `registrada` (valores siguientes a definir con el flujo
  de Bonita: en revisión, convocatoria abierta, etc.)

Definidos en el cliente en
`client/src/features/emergencies/emergency-constants.js`.

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
