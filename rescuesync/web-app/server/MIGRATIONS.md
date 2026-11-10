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

- `1790712000000_seed-demo-ongs.sql` y `1791000000000_create-notifications.sql`:
  ONGs demo y bandeja de avisos.
- `1793000000000_e5-ciclo-completo.sql` (Entrega 5, E5-10 y E5-11): amplía los
  `CHECK` de estados de emergencia y oferta; agrega `emergencies.duracion_convocatoria_min`,
  `convocatoria_ronda`, `validacion_resumen` y `ultimo_conflicto_compromiso`; crea
  `emergency_status_history`, `oferta_validaciones`, `adjudicaciones` y
  `oferta_finalizaciones`; amplía `notifications` (`tipo`, `ronda`, `leida_at`, clave única
  nueva) y agrega `lotes.resource_code`.
  **Ojo:** borra los lotes que no tenían `resource_code` (con sus renglones de oferta y las
  ofertas que queden vacías) y devuelve a `registrada` las emergencias que se queden sin
  lotes: hay que volver a armarlos desde la pantalla del coordinador.

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
