# RescueSync

Plataforma de coordinación de respuesta ante desastres — TP Integrador de
DSSD, 2026 (Grupo 3, UNLP). El ciclo completo de una emergencia lo orquesta
**Bonita**; la web-app guarda los datos y es la interfaz de cada perfil, y el
**Sistema Nacional (SN)** valida las ofertas y reserva el stock de las ONG.

Documentación relacionada:

- **[`docs/guia-de-pruebas.md`](./docs/guia-de-pruebas.md)** — casos de prueba paso a paso, con valores de ejemplo.
- [`bonita/README.md`](./bonita/README.md) — configuración de Bonita Studio, parámetros y mapa del proceso.
- [`docs/api-contracts.md`](./docs/api-contracts.md) y [`docs/api-contracts-sistema-nacional.md`](./docs/api-contracts-sistema-nacional.md) — contratos de las APIs.
- [`roadmapfase5.md`](./roadmapfase5.md) — plan y estado de la Entrega 5.

## Cómo encajan las piezas

```
 Navegador ──► Cliente React (Vite, :5173) ──► Backend Express (Docker, :4000) ──► Postgres (Docker, :5432)
                                                  │   ▲
                       login y tareas de usuario  │   │  conectores REST (/api/internal/*, header X-Integration-Key)
                                                  ▼   │
                                     Bonita Studio (runtime local, :8080/bonita)
                                                  │
                                   conectores REST con JWT (login + validaciones, compromisos, cierre)
                                                  ▼
                                    Sistema Nacional (Render, o local en :5000)
```

- **Todo corre en tu máquina** salvo el Sistema Nacional, que por defecto se usa el ya desplegado en Render (también se puede levantar local, ver paso 2).
- Los usuarios, roles y grupos viven en la **organización de Bonita**, no en Postgres.

## Requisitos

| Qué | Para qué |
|---|---|
| Docker Desktop (Compose v2) | Backend + Postgres |
| Node.js 20.x + npm | Cliente (Vite) |
| Bonita Studio Community **2025.2** | Orquestación del proceso (interfaz en inglés en esta guía) |
| Repo del proyecto de Bonita (aparte) | Diagrama `GestionarEmergencia` y organización RescueSync |
| `curl` y `openssl` | Generar la clave de integración y probar el SN |

Puertos que tienen que estar libres: `4000`, `5173`, `5432` y `8080`.

## Guía rápida de instalación

Todos los comandos parten de la raíz del repositorio.

### 1. Backend + Postgres (Docker)

```bash
cd rescuesync/web-app/server
cp .env.example .env            # solo la primera vez: si lo repetís, pisa tu .env
openssl rand -hex 32            # copiá el valor que imprime
```

Editá `rescuesync/web-app/server/.env` y completá **dos** variables:

| Variable | Valor |
|---|---|
| `BONITA_INTEGRATION_KEY` | el valor que imprimió `openssl rand -hex 32`. Es la clave que Bonita manda en `X-Integration-Key`; **la vas a pegar otra vez en Bonita** (parámetro `claveIntegracion`). Sin ella, `/api/internal/*` responde `503`. |
| `SN_INTEGRATION_PASSWORD` | la clave de la cuenta `rescuesync-integracion` del Sistema Nacional (se entrega junto con el TP; no se versiona). **Copiala y pegala:** tiene letras `O` mayúsculas que se confunden con ceros. |

El resto de las variables viene con valores que funcionan (`BONITA_PROCESS_NAME=Gestionar Emergencia`, base `rescuesync`, etc.).

Levantar los servicios y crear las tablas:

```bash
cd rescuesync/web-app
docker compose up -d --build
docker compose exec server npm run migrate:up
```

Verificar que esté todo arriba:

```bash
docker compose logs server | tail -5        # "Postgres connection established" y "listening on port 4000"
```

> Si después cambiás `server/.env`, recreá el contenedor (lee el archivo solo al crearse):
> `docker compose up -d --force-recreate server`

### 2. Sistema Nacional

**Opción A (por defecto): el SN de Render.** No hay que levantar nada. URL:
`https://tp-integrador-dssd-rescuesync-sistema.onrender.com`

Render duerme el servicio gratuito: el **primer pedido tarda hasta ~1 minuto**. Despertalo antes de probar:

```bash
curl -s https://tp-integrador-dssd-rescuesync-sistema.onrender.com/health
```

Las ONG de ejemplo (`rescatistas-unidos`, `manos-solidarias`) ya están dadas de alta con su inventario base (ver [`docs/guia-de-pruebas.md`](./docs/guia-de-pruebas.md#datos-de-partida)).

**Opción B: SN local** (sin depender de Render). Ver [`sistema-nacional/README.md`](./sistema-nacional/README.md) para levantarlo (`docker compose up --build` en `rescuesync/sistema-nacional`, queda en `http://localhost:5000`), y en la guía de pruebas, sección "SN local", los `curl` para crear las ONG y su inventario. Si lo usás: en `server/.env` poné `SISTEMA_NACIONAL_API_URL=http://host.docker.internal:5000` (el backend corre dentro de Docker y "Mi inventario" le habla directo al SN), recreá el server, y en Bonita poné `snUrl = http://localhost:5000` (Bonita corre en tu máquina, no en Docker).

### 3. Cliente (Vite)

```bash
cd rescuesync/web-app/client
cp .env.example .env            # trae VITE_USE_MOCK_API=false: usa el backend real
npm install
npm run dev
```

Abrí http://localhost:5173. Sin el `.env`, el cliente corre en **modo mock** (guarda en `localStorage` y no usa Bonita).

### 4. Bonita Studio

Es el paso más largo. Está explicado **en detalle** (con los valores de los parámetros) en [`bonita/README.md`](./bonita/README.md). Resumen:

1. Abrir Studio 2025.2 e importar el proyecto de Bonita desde su repo.
2. Desplegar la organización `RescueSync.xml` (usuario por defecto `Dirección`).
3. En el proceso: **Configure → Local…** → actor mapping, **parámetros** y authentication. Parámetros:

   | Parámetro | Valor |
   |---|---|
   | `claveIntegracion` | el mismo valor de `BONITA_INTEGRATION_KEY` |
   | `webAppUrl` | `http://localhost:4000` |
   | `snUrl` | `https://tp-integrador-dssd-rescuesync-sistema.onrender.com` |
   | `snUsuario` | `rescuesync-integracion` |
   | `snClave` | la clave del SN (la misma que `SN_INTEGRATION_PASSWORD`) |

4. **Finish** y **Deploy**. El runtime responde en http://localhost:8080/bonita.

No hace falta `start-studio.sh`: la clave ya no se inyecta como variable de entorno sino como parámetro del proceso.

### 5. Primer ingreso

En http://localhost:5173 ingresá con el usuario de cada perfil (**contraseña `123123123`**):

| Usuario | Perfil | Qué hace en el ciclo |
|---|---|---|
| `OperadorM` | Operador municipal | Registra la emergencia y adjudica ofertas |
| `CoordinadorR` | Coordinador regional | Revisa, arma los lotes, publica la convocatoria, decide cómo continuar y confirma el cierre |
| `RescatistasUnidos` | ONG (`rescatistas-unidos`) | Carga ofertas, finaliza su actividad, maneja su inventario |
| `Manos Solidarias` | ONG (`manos-solidarias`) | Ídem |
| `Dirección` | Auditor | Dashboard de tiempos y estados |

Usá el login **tal cual** (mayúsculas, espacios y tildes). Para ir probando los casos: **[`docs/guia-de-pruebas.md`](./docs/guia-de-pruebas.md)**.

## Tests del backend

Desde `rescuesync/web-app` (con Postgres levantado). Usan un esquema temporal y no tocan los datos de la app; Bonita y el SN están simulados:

```bash
docker compose exec server npm test        # notificaciones + ciclo completo
```

O desde `web-app/server` con Node local: `npm test`. `npm run test:sn` prueba contra el SN real (`SN_TEST_URL`, por defecto `http://localhost:5000`; se saltea si no responde).

## Cómo funciona el login con Bonita

La app valida el login contra el login service de Bonita:

```
Navegador ──► server Express (/api/auth/*) ──► Bonita (/bonita/loginservice)
   cookie connect.sid        guarda la sesión de Bonita
                             (JSESSIONID + X-Bonita-API-Token)
```

- El navegador **nunca** habla con Bonita: el server guarda las cookies de Bonita en la sesión del usuario (`express-session`, en memoria) y le da al navegador solo `connect.sid`. Si se reinicia el server, hay que volver a loguearse.
- Esa sesión es la que el server usa para iniciar el caso (`POST /api/emergencies`) y para completar las **tareas humanas** en nombre del usuario.
- El id del proceso no se configura: el server lo busca por nombre (`BONITA_PROCESS_NAME`) entre los procesos desplegados y activos.
- Dentro de Docker, `localhost` es el propio contenedor: por eso `docker-compose.yml` pisa `BONITA_API_URL` con `host.docker.internal`.

## Después de hacer `git pull`

```bash
cd rescuesync/web-app/client && npm install                      # si cambió algún package.json
cd ../ && docker compose up -d --build -V                         # reconstruye el server
docker compose exec server npm run migrate:up                    # migraciones nuevas
```

Si cambió algún `.env.example`, copiá las variables nuevas a tu `.env`. Si cambió el proceso de Bonita, ver "Versiones del proceso" en [`bonita/README.md`](./bonita/README.md).

La migración de Entrega 5 (`1793000000000_e5-ciclo-completo.sql`) **borra los lotes sin `resource_code`** y devuelve a `registrada` las emergencias que se quedan sin lotes (ver [`MIGRATIONS.md`](./web-app/server/MIGRATIONS.md)).

## Dejar el entorno limpio (volver a empezar)

Orden importante: primero liberar el stock del SN (necesita los ids de las emergencias), después vaciar la base, y por último borrar los casos de Bonita.

```bash
cd rescuesync/web-app
SN=https://tp-integrador-dssd-rescuesync-sistema.onrender.com
TOKEN=$(curl -s -X POST $SN/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"rescuesync-integracion","password":"<clave del SN>"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

# 1) liberar lo comprometido de cada emergencia (idempotente)
for id in $(docker compose exec -T postgres psql -U rescuesync -d rescuesync -Atc "select id from emergencies" | tr -d '\r'); do
  curl -s -X POST "$SN/emergencias/$id/cierre" -H "Authorization: Bearer $TOKEN"; echo
done

# 2) vaciar la base de la web-app (conserva la tabla de ONGs)
docker compose exec -T postgres psql -U rescuesync -d rescuesync -c "TRUNCATE emergencies CASCADE;"
```

3. En el Portal de Bonita (http://localhost:8080/bonita, usuario `Dirección`): **Administrator → Cases** → borrar los casos abiertos. **No** borrar el proceso desplegado.
4. Comprobar en **Mi inventario** que el comprometido volvió a 0.

## Credenciales y variables

Cada integrante crea sus `.env` a partir de los `.env.example` (`web-app/server/.env.example`, `web-app/client/.env.example`); nunca se commitean.

Si cambiás `DB_USER` / `DB_PASSWORD` / `DB_NAME`, hacelo también en un `web-app/.env` (al lado de `docker-compose.yml`): el contenedor de Postgres no lee `server/.env`.

## Migraciones (Postgres)

`migrate:up` ya está en el paso 1. Otros comandos, desde `web-app/server` (o con `docker compose exec server …`):

```bash
npm run migrate:create -- nombre-migracion    # crea una migración nueva
npm run migrate:down                          # revierte la última migración
```

Detalle en [`web-app/server/MIGRATIONS.md`](./web-app/server/MIGRATIONS.md).

## Apagar

```bash
docker compose down        # conserva los datos
docker compose down -v     # borra también los datos de Postgres (no lo uses para "reiniciar": ver sección de limpieza)
```

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| "El Sistema Nacional rechazó el login de integración" | `SN_INTEGRATION_PASSWORD` (o el parámetro `snClave`) mal copiado; revisar `O` vs `0`. Después de editar el `.env`: `docker compose up -d --force-recreate server`. |
| El login de la app falla | Bonita Studio cerrado, organización sin desplegar, o usuario mal tipeado (respetar mayúsculas y espacios). |
| La emergencia se crea pero responde `bonitaWarning` | El proceso no está desplegado y activo en Bonita, o el nombre no coincide con `BONITA_PROCESS_NAME`. |
| Mi inventario: "Tu ONG todavía no está dada de alta en el Sistema Nacional" | El `ref` de la ONG (grupo del usuario en Bonita) no existe en el SN. Crearla con `POST /ongs` (ver guía de pruebas). |
| Primer pedido al SN muy lento o un 5xx al azar | Render estaba dormido; esperar ~1 minuto y reintentar (los conectores tienen timeouts de 90 s). |
| En Studio, **Finish** deshabilitado en *Configure* | Falta el mapeo de actores, los parámetros o la autenticación. Ver `bonita/README.md`. |
| Una tarea de Bonita queda en *Failed* | Portal → **Task list → Failed flow nodes**: el detalle indica qué conector falló; el log del backend (`docker compose logs server`) muestra la respuesta. |
