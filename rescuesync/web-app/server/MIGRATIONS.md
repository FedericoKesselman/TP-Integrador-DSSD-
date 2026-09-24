# Migraciones (node-pg-migrate)

Migraciones SQL versionadas del esquema de Postgres de `web-app/server`.

## Migraciones aplicadas

- `1790279577365_create-core-schema.sql`: esquema inicial — `emergencies`,
  `lotes`, `ongs`, `ofertas`, `oferta_ongs` (consorcios), `oferta_lotes`
  (qué cubre cada oferta) y `oferta_historial` (trazabilidad de
  ediciones). Sin tabla de usuarios/roles propia: eso lo resuelve la
  organización de Bonita (ver `../../roadmapfase2.md`). Probada de
  punta a punta (up/down/up, constraints, triggers de `updated_at`,
  consorcio con múltiples ONGs) antes de subirla.

## Uso

Con Postgres corriendo (`docker compose up` desde `web-app/`) y
`server/.env` configurado:

```bash
cd web-app/server
npm run migrate:create -- nombre-de-la-migracion   # crea un archivo .sql nuevo
npm run migrate:up                                  # aplica las migraciones pendientes
npm run migrate:down                                # revierte la última migración aplicada
```

Cada migración creada trae dos secciones (`-- Up Migration` /
`-- Down Migration`) para completar con el SQL de aplicar y revertir el
cambio. node-pg-migrate registra las migraciones ya aplicadas en la tabla
`pgmigrations` (se crea sola en la base).
