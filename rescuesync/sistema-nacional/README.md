# Sistema Nacional (SN)

API REST del **Sistema Nacional de Gestión de Recursos y Riesgos** de
RescueSync: gestiona ONGs y su stock, valida ofertas por niveles de
competencia y compromete/libera recursos con locking en PostgreSQL. La
consume Bonita (conectores REST) con autenticación JWT.

- Contrato: [`../docs/api-contracts-sistema-nacional.md`](../docs/api-contracts-sistema-nacional.md)
- Swagger: `/docs` (spec en [`openapi.yaml`](./openapi.yaml), JSON en `/docs.json`)
- Plan de trabajo: [`../roadmapfase3.md`](../roadmapfase3.md) (Pistas A y B)

**Stack:** Node 20 + Express (ESM), `pg`, `node-pg-migrate`, `jsonwebtoken`,
`bcryptjs`, `helmet`, `express-rate-limit`. Tiene **su propia base**
(no comparte la de `web-app`): local en Docker, en producción Neon.

## Correrlo en local

Requiere Docker Desktop.

```bash
cd sistema-nacional
cp .env.example .env      # y completar JWT_SECRET y SN_INTEGRATION_PASSWORD
docker compose up --build
```

Al arrancar, el contenedor aplica las migraciones, crea la cuenta de
integración y levanta la API en `http://localhost:5000` (con recarga al
editar `src/`). Su Postgres queda publicado en `localhost:5433` para no
chocar con el de `web-app` (5432).

Probar:

```bash
curl http://localhost:5000/health
curl -X POST http://localhost:5000/auth/login -H "Content-Type: application/json" \
  -d '{"username":"rescuesync-integracion","password":"<SN_INTEGRATION_PASSWORD>"}'
```

O abrir `http://localhost:5000/docs`, hacer login, copiar el `accessToken` y
pegarlo en **Authorize**.

## Variables de entorno

| Variable                                             | Para qué                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `PORT`                                               | Puerto HTTP (Render lo inyecta solo)                                                  |
| `NODE_ENV`                                           | `production` activa "solo HTTPS"                                                      |
| `DATABASE_URL`                                       | Postgres del SN. En Neon: conexión **directa** (sin `-pooler`) con `?sslmode=require` |
| `JWT_SECRET`                                         | Secreto HS256, 32+ caracteres; solo como variable de entorno                          |
| `JWT_EXPIRES_IN`                                     | Vida del token en segundos (3600)                                                     |
| `JWT_ISSUER`, `JWT_AUDIENCE`                         | Claims `iss` / `aud` (tienen default)                                                 |
| `SN_INTEGRATION_USERNAME`, `SN_INTEGRATION_PASSWORD` | Cuenta que usa Bonita; `npm run seed` la crea o le cambia la clave                    |
| `CORS_ORIGINS`                                       | Orígenes permitidos, separados por coma (`*` = todos)                                 |

## Scripts

| Comando                               | Qué hace                                                         |
| ------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                         | API con recarga (fuera de Docker; usa `DATABASE_URL` del `.env`) |
| `npm run start:prod`                  | Migraciones + seed + API (lo que corre el `Dockerfile`)          |
| `npm run migrate:up` / `migrate:down` | Aplica / revierte migraciones                                    |
| `npm run migrate:create -- nombre`    | Crea una migración SQL nueva                                     |
| `npm run seed`                        | Crea/actualiza la cuenta de integración                          |
| `npm test`                            | Tests (`node --test`)                                            |
| `npm run lint:fix` / `npm run format` | Antes de commitear                                               |

Dentro de Docker: `docker compose exec api npm run migrate:up`.

## Estructura

```
sistema-nacional/
├── src/
│   ├── index.js              # listen
│   ├── app.js                # Express: seguridad, rutas, errores
│   ├── config.js             # variables de entorno (valida al arrancar)
│   ├── db.js                 # pool de pg + withTransaction (locking)
│   ├── errors.js             # HttpError y respuestas { message }
│   ├── auth/                 # JWT y consulta de cuentas
│   ├── middleware/           # requireAuth, requireRole, ...
│   └── routes/               # auth, health, docs (Pista B suma el dominio)
├── migrations/               # esquema + catálogo de recursos
├── scripts/seed.js           # cuenta de integración
├── test/                     # node --test
├── openapi.yaml              # Swagger
├── Dockerfile                # imagen de producción (Render)
└── docker-compose.yml        # entorno local (API + Postgres)
```

## Esquema

- `ongs`: ONG (`ref` compartido con la web-app, `nivel_operativo` 1-4, `habilitada`).
- `api_clients`: cuentas con hash bcrypt; rol `integracion` u `ong` (con su ONG).
- `recursos_catalogo`: mismos códigos que `web-app/client/src/features/lotes/lote-constants.js`.
- `ong_recursos`: stock por ONG (`cantidad_total`, `cantidad_comprometida`,
  `CHECK comprometida <= total`). `id` secuencial para bloquear en orden.
- `compromisos` / `compromiso_items`: reservas por oferta adjudicada
  (únicas por `emergencia_id, oferta_id`) y su reparto por ONG.
- `emergencia_finalizaciones`: ONGs que terminaron su actividad.

## Para la Pista B (dominio)

- Montar las rutas nuevas en `src/app.js` con `requireAuth` y `requireRole`
  (`src/middleware/auth-middleware.js`).
- Toda operación que bloquee stock va dentro de `withTransaction(client => …)`
  y usa ese `client` para el `SELECT … FOR UPDATE … ORDER BY id`.
- Errores con los helpers de `src/errors.js` (`badRequest`, `conflict`, …)
  dentro de `asyncHandler`.
- Al implementar un endpoint, sacarle el "Pendiente (Pista B)" en
  `openapi.yaml` y en el contrato.

## Producción (Render + Neon)

Pendiente (Fase 6 del roadmap): crear la base en Neon y un Web Service
Docker en Render con _Root Directory_ `rescuesync/sistema-nacional`,
healthcheck en `/health` y las variables de arriba.
