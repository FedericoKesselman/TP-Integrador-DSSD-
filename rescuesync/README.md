# RescueSync

Plataforma de coordinación de respuesta ante desastres — TP Integrador de
DSSD, 2026. Ver [`roadmapfase2.md`](./roadmapfase2.md) para el plan de
trabajo de la Entrega 2 y [`../CLAUDE.md`](../CLAUDE.md) para convenciones
del proyecto.

## Requisitos

- Node.js 20.x + npm
- Docker Desktop (con Docker Compose v2)
- Bonita Studio 2025.2 con el proyecto de Bonita del grupo (repo aparte, ver
  [`bonita/README.md`](./bonita/README.md))

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

## Login con Bonita

Los usuarios, roles y grupos viven en la **organización de Bonita**, no en
Postgres (ver `roadmapfase2.md`, sección "Autenticación"). La app valida el
login contra el login service de Bonita, así que para usarla hace falta:

1. **Bonita Studio abierto** (el motor corre dentro de Studio, en
   `http://localhost:8080/bonita`) con la organización **RescueSync
   desplegada** y el proceso configurado (mapeo de actores).
2. `SESSION_SECRET` definido en `web-app/server/.env` (ya viene en el
   `.env.example`).

Usuarios de prueba (uno por perfil) y sus contraseñas: ver
[`bonita/README.md`](./bonita/README.md#usuarios-de-prueba).

Cómo funciona:

```
Navegador ──► server Express (/api/auth/*) ──► Bonita (/bonita/loginservice)
   cookie connect.sid        guarda la sesión de Bonita
                             (JSESSIONID + X-Bonita-API-Token)
```

- El navegador **nunca** habla con Bonita ni ve sus cookies: el server las
  guarda en la sesión del usuario (`express-session`, en memoria) y le da al
  navegador solo su propia cookie `connect.sid`.
- Esa sesión de Bonita es la que el server va a reutilizar en la Fase 5
  para iniciar casos y completar tareas en nombre del usuario.
- La sesión vive en memoria: si se reinicia el server, hay que volver a
  loguearse.
- Dentro de Docker, `localhost` es el propio contenedor: por eso
  `docker-compose.yml` pisa `BONITA_API_URL` con `host.docker.internal`
  (la máquina anfitriona). El `.env` queda con `localhost` para correr
  cosas desde la terminal.

Endpoints: ver [`docs/api-contracts.md`](./docs/api-contracts.md#autenticación).

## Después de hacer `git pull`

Si cambió algún `package.json` (dependencias nuevas):

```bash
# cliente
cd rescuesync/web-app/client
npm install

# server (corre en Docker): reconstruir la imagen y descartar el
# node_modules viejo del contenedor
cd rescuesync/web-app
docker compose up --build -V
```

Si cambió algún `.env.example`, copiar a tu `.env` las variables nuevas.

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
