# RescueSync

Plataforma de coordinación de respuesta ante desastres — TP Integrador de
DSSD, 2026. Ver [`roadmapfase2.md`](./roadmapfase2.md) para el plan de
trabajo de la Entrega 2 y [`../CLAUDE.md`](../CLAUDE.md) para convenciones
del proyecto.

## Requisitos

- Node.js 20.x + npm
- Docker Desktop (con Docker Compose v2)

## Cómo levantar el proyecto

**1. Backend + Postgres (Docker)**

```bash
cd rescuesync/web-app/server
cp .env.example .env
cd ..
docker compose up --build
```

Confirmar en los logs: `Postgres connection established` y
`RescueSync server listening on port 4000`.

En otra terminal, aplicar las migraciones (crea las tablas; hace falta
cada vez que haya migraciones nuevas):

```bash
cd rescuesync/web-app/server
npm install
npm run migrate:up
```

**2. Cliente (Vite, en otra terminal)**

```bash
cd rescuesync/web-app/client
npm install
npm run dev
```

- Cliente: http://localhost:5173
- API: http://localhost:4000

Por defecto el cliente corre en **modo mock** (guarda en `localStorage`,
no necesita el backend levantado). Para probarlo contra el backend real,
crear `client/.env` a partir de `client/.env.example` con
`VITE_USE_MOCK_API=false`.

## Credenciales

Cada integrante crea sus propios `.env` a partir de los `.env.example`
(`web-app/server/.env.example` y `web-app/client/.env.example`) — nunca se
commitean. Las variables de Postgres, Sistema Nacional y Bonita están
comentadas ahí mismo.

⚠️ Si cambiás `DB_USER`/`DB_PASSWORD`/`DB_NAME`, hacelo también en un
`web-app/.env` (al lado de `docker-compose.yml`) o exportándolas antes de
`docker compose up` — el contenedor de Postgres no lee
`web-app/server/.env`, solo el contenedor `server` lo hace.

## Migraciones (Postgres)

`migrate:up` ya está en el paso 1. Otros comandos, desde `web-app/server`:

```bash
npm run migrate:create -- nombre-migracion    # crea una migración nueva
npm run migrate:down                          # revierte la última migración
```

Detalle en [`web-app/server/MIGRATIONS.md`](./web-app/server/MIGRATIONS.md).

## Apagar

```bash
docker compose down        # conserva los datos
docker compose down -v     # borra también los datos de Postgres
```
