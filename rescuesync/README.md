# RescueSync

Plataforma de coordinación de respuesta ante desastres — TP Integrador de
DSSD, 2026. El plan vigente es [`roadmapfase5.md`](./roadmapfase5.md)
(Entrega 5: ciclo completo orquestado por Bonita; ahí está el estado de cada
tarea y la leyenda `[ ]`/`[~]`/`[x]`). Planes anteriores:
[`roadmapfase2.md`](./roadmapfase2.md). Convenciones del proyecto en
[`../CLAUDE.md`](../CLAUDE.md); contratos de la API en
[`docs/api-contracts.md`](./docs/api-contracts.md).

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
openssl rand -hex 32
cd ..
docker compose up --build
```

Si el entorno ya fue configurado y solo se necesita iniciar los servicios:

```bash
cd rescuesync/web-app
docker compose up -d postgres server
```

Copiar el valor que imprime `openssl rand -hex 32` en
`server/.env` después de `BONITA_INTEGRATION_KEY=` (clave que Bonita manda en
el header `X-Integration-Key` a `/api/internal/*`; sin ella esos endpoints
responden `503`). Completar también `SN_INTEGRATION_USERNAME` /
`SN_INTEGRATION_PASSWORD` (cuenta de integración del Sistema Nacional, usada
solo por "Mi inventario"). La copia de `.env.example` se hace solo la primera
vez: no volver a ejecutarla después de completar el `.env`, porque lo
sobrescribe.

Confirmar en los logs: `Postgres connection established` y
`RescueSync server listening on port 4000`.

En otra terminal, aplicar las migraciones (crea las tablas; hace falta
cada vez que haya migraciones nuevas):

```bash
cd rescuesync/web-app/server
npm install
npm run migrate:up
```

La migración de Entrega 5 (`1793000000000_e5-ciclo-completo.sql`) **borra los
lotes sin `resource_code`** y devuelve a `registrada` las emergencias que se
quedan sin lotes (ver [`MIGRATIONS.md`](./web-app/server/MIGRATIONS.md)).

**Tests del backend** (desde `web-app/server`, con Postgres levantado; usan un
esquema temporal y no tocan los datos de la app, con Bonita y SN simulados):

```bash
npm test            # notificaciones + ciclo completo
npm run test:sn     # contra el Sistema Nacional real (SN_TEST_URL, default http://localhost:5000); se saltea si no responde
```

**2. Bonita Studio (antes de usar login o crear emergencias)**

Bonita vive en otro repositorio, pero debe estar levantado junto con el
backend porque el server valida los usuarios e inicia los casos del proceso.
Cada integrante debe tener un `BONITA_INTEGRATION_KEY` local en
`web-app/server/.env`. ⚠️ El script `start-studio.sh` y `bonita/README.md`
todavía describen el mecanismo anterior (`BONITA_NOTIFICATION_TOKEN`); se
actualizan en E5-32/E5-91 del roadmap, cuando Bonita pase a usar la clave de
integración como parámetro del proceso. Con PostgreSQL y el backend ya
levantados, guardar el trabajo, cerrar Bonita Studio y su runtime e iniciar
mediante el script desde la raíz del repositorio:

```bash
sh rescuesync/bonita/scripts/start-studio.sh
```

El script configura el token del backend en el runtime de Bonita. No abrir
Bonita directamente desde Finder, porque el runtime podría arrancar sin las
variables necesarias. En Bonita, desplegar la organización RescueSync y el
proceso activo antes de crear una emergencia. Si se modifica el `.proc` o un
conector, incrementar la versión y redesplegar el proceso; los casos ya
iniciados conservan la versión anterior.

**3. Cliente (Vite, en otra terminal)**

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
- Esa sesión de Bonita es la que el server reutiliza para iniciar casos
  (ver "Inicio del caso en Bonita") y, más adelante, completar tareas en
  nombre del usuario.
- La sesión vive en memoria: si se reinicia el server, hay que volver a
  loguearse.
- Dentro de Docker, `localhost` es el propio contenedor: por eso
  `docker-compose.yml` pisa `BONITA_API_URL` con `host.docker.internal`
  (la máquina anfitriona). El `.env` queda con `localhost` para correr
  cosas desde la terminal.

Endpoints: ver [`docs/api-contracts.md`](./docs/api-contracts.md#autenticación).

### Inicio del caso en Bonita

Al crear una emergencia (`POST /api/emergencies`) el server inicia una
instancia del proceso en Bonita y guarda el `bonitaCaseId`. El id del
proceso **no se configura**: el server lo busca solo por nombre entre los
procesos desplegados y activos (`BONITA_PROCESS_ID` ya no existe).

- `BONITA_PROCESS_NAME` (en `web-app/server/.env`): nombre del proceso.
  Usar `GestionarEmergencia`, que es el nombre del proceso desplegado.
- Después de redesplegar en Bonita Studio **no hay que tocar ningún `.env`**.
- El proceso tiene que estar **desplegado y activo** en Bonita. Si no lo
  está, o Bonita no responde, la emergencia se guarda igual pero el caso no
  se inicia y la respuesta trae `bonitaWarning`.
- El contrato de inicio del proceso tiene que tener el input `emergencyID`
  (distingue mayúsculas).
- El alta y la publicación de la convocatoria también completan tareas del
  caso en Bonita ("Registrar Emergencia"; "Revisar Emergencia", "Generar
  Lotes de Necesidades" y "Publicar Convocatoria"), así que requieren un
  usuario con el rol correcto en Bonita (`operador_municipal` y
  `coordinador_regional`).

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

Si cambió el proceso, el `.proc` o un conector de Bonita, cerrar Studio,
reiniciarlo con `start-studio.sh` para sincronizar el token, incrementar la
versión y redesplegarlo. Crear casos nuevos para probarlo: los existentes
conservan la versión anterior. No usar versiones anteriores para validar
cambios nuevos.

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
