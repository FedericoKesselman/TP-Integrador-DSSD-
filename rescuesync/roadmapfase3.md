# Roadmap — Entrega 3 (RescueSync) · versión final

**Objetivo:** construir el **Sistema Nacional (SN)**: una API REST con JWT,
dockerizada y desplegada en la nube (Render + Neon), que gestione ONGs y sus
recursos, valide ofertas por niveles de competencia, bloquee/comprometa recursos
con locking en PostgreSQL y los libere al cierre. Además, conectar Bonita y la
web-app con ese SN para que el flujo funcione de punta a punta.

**Se entrega:** URL del SN, documento Swagger, URLs de repositorios, Dockerfile.

Cómo leer este archivo: primero **Cómo trabajar con agentes de IA**, después
**Decisiones**, **Contratos** y, al final, **las tareas de tu pista**.

---

## 1. Cómo trabajar con agentes de IA

Cada integrante toma **una pista (A a E)** y trabaja con su agente abierto en la
raíz del repo (así lee `CLAUDE.md` solo). Reglas para todos:

1. **El contrato manda.** Las secciones 4 y 5 son la fuente única. Si hay que
   cambiar un endpoint, un campo o un estado: se avisa al equipo y se edita el
   contrato **antes** de tocar código.
2. Una rama por tarea: `feat/e3-21-validacion`. Commits en Conventional Commits
   (`feat(sistema-nacional): …`), alcance = nombre del sistema.
3. Antes de commitear: `npm run lint:fix` y `npm run format` en el paquete.
4. Nunca commitear `.env`, claves ni connection strings.
5. No editar archivos de otra pista sin avisar. Si tu tarea depende de otra,
   usá el contrato y un mock hasta que esté lista.
6. No renombrar tareas del diagrama de Bonita: la web-app las completa por
   nombre exacto.
7. Al terminar una tarea: tildarla en este archivo y anotar horas reales en la
   bitácora (E3-94; insumo del Gantt de la Entrega 4).

**Mensaje inicial sugerido para tu agente** (reemplazar `<PISTA>` y `<TAREAS>`):

> Leé `CLAUDE.md`, `rescuesync/roadmapfase3.md` (secciones 1 a 5) y, si existe,
> `rescuesync/docs/api-contracts-sistema-nacional.md`. Soy la pista `<PISTA>` y
> me toca implementar `<TAREAS>`. Respetá el contrato y las reglas de la
> sección 1, no toques archivos fuera de mi pista, trabajá en una rama por
> tarea, corré lint y tests antes de cerrar cada una y avisame si algo del
> contrato no cierra en lugar de inventar un formato.

---

## 2. Decisiones tomadas (no reabrir)

| Tema | Decisión |
|---|---|
| Hosting | **Render** (API en Docker) + **Neon** (solo Postgres, porque la BD de Render se borra a los 30 días). Mientras tanto, Postgres en Docker local. Cuentas: crearlas en la Fase 6 |
| Repositorio | Mismo monorepo, carpeta `rescuesync/sistema-nacional/` (Render despliega desde subdirectorio) |
| Stack del SN | Node 20 + Express (ESM) + `pg` + `node-pg-migrate`, igual que `web-app/server` |
| Certificaciones | **No existen** (el profesor las sacó del enunciado) |
| Qué guarda el SN | ONGs, sus usuarios, su stock de recursos y compromisos. **No guarda ofertas ni borradores** (viven en la BD de la web-app). No hay sincronización de stock con la app local |
| Bloqueo | `SELECT … FOR UPDATE` en **validación** y en **compromiso** (la ONG debe tener recursos suficientes) |
| Cuentas del SN | Una cuenta de **integración** (la usa Bonita) + **una cuenta por ONG** (rol `ong`, solo ve su propio stock). `POST /ongs` crea la ONG **y su usuario**, ya **habilitada** |
| Códigos de recurso | `recursoCodigo` = ids de `lote-constants.js` (`paramedicos`, `raciones`, …). Nueva columna `lotes.resource_code`; los lotes ya cargados **no se rellenan** (se borran/recargan) |
| ONG compartida | `ongs.bonita_org_ref` (slug, ej. `rescatistas-unidos`) = `ref` en el SN |
| Consorcios | El SN **reparte automáticamente** la cantidad entre las ONGs de la oferta (principal primero, luego asociadas, hasta su disponible) y devuelve el `reparto` |
| Validación | Cobertura = habilitado / ofrecido. `PLENO` ≥ 100 %, `PARCIAL` ≥ 50 %, `APOYO` > 0 %, `SIN_CAPACIDAD` = 0 %. Riesgo permitido = mínimo entre el nivel operativo de las ONGs y un tope por cobertura (PLENO → `critica`, PARCIAL → `alta`, APOYO → `media`) |
| Estados de emergencia | `registrada → convocatoria_abierta → convocatoria_cerrada → validada → adjudicada → en_ejecucion → finalizada` |
| Estados de oferta | `registrada`, `retirada`, `validada`, `adjudicada`, `no_seleccionada`, `finalizada` |
| Bonita → web-app | Rutas `/api/internal/*` con header `X-Integration-Key` (secreto en `.env` y en parámetros del proceso) |
| Salida de "Esperar Cierre" | La tarea (hoy ReceiveTask `ejecucionFinalizada`) se reemplaza por la tarea humana **"Confirmar cierre de ejecución"** del Centro Coordinador |
| Reformular lotes | Las ofertas pasan a `retirada` (snapshot en `oferta_historial`) y se borran sus `oferta_lotes` para poder reemplazar los lotes. Al **reabrir**, las ofertas vuelven a `registrada` y son editables en la nueva ventana |
| Notificaciones | Solo dentro de la app (bandeja de la ONG). Sin email |
| Stock demo | Limitado a propósito, para mostrar cobertura parcial y el camino alternativo |
| Bonita (pista C) | Los cambios se cargan a mano en Studio siguiendo guías con valores exactos |
| Login de usuarios | **No se toca**: sigue siendo el login service de Bonita (funciona desde la Entrega 2). El JWT del SN es un sistema aparte |

---

## 3. Arquitectura y flujo

```
Navegador ─► web-app (Express) ─► Bonita (sesión del usuario)      [ya existe]
                  ▲                    │
                  │ /api/internal/*    │ conectores REST
                  │ (X-Integration-Key)▼
                  └──────────────── Bonita ──► Sistema Nacional (JWT, Render + Neon)
```

1. Vence el timer de la convocatoria → Bonita pone la emergencia en `convocatoria_cerrada`.
2. Bonita pide a la web-app el `consolidado` (ya viene en el formato que espera el SN).
3. Bonita hace login en el SN y envía `POST /validaciones`; informa el resultado a la web-app (`validada`) y setea `todosLosLotesCubiertos`.
4. Si no se cubrió todo: el Coordinador decide **continuar / reabrir / reformular**.
5. El Operador Municipal **adjudica** ofertas validadas; Bonita notifica y registra el compromiso en el SN.
6. Ejecución: cada ONG marca **finalizada** su oferta; el Coordinador **confirma el cierre**.
7. Bonita informa la finalización y el cierre al SN, que libera los recursos.

---

## 4. Contrato del Sistema Nacional

Base: `https://<servicio>.onrender.com`. Todo requiere `Authorization: Bearer <JWT>`
salvo `/auth/login`, `/health` y `/docs`. JWT HS256 con `iss`, `sub`, `aud`, `exp`
(1 h) y `role` (`integracion` | `ong`; para `ong`, además `ongRef`). Errores
siempre `{ "message": "…" }`; códigos HTTP correctos (400, 401, 403, 404, 409).

| Método y ruta | Rol | Descripción |
|---|---|---|
| `POST /auth/login` | público | `{username,password}` → `{accessToken,tokenType:"Bearer",expiresIn}` |
| `POST /ongs` | integracion | Onboarding: `{ref,nombre,nivelOperativo(1-4),username,password,recursos?:[{recursoCodigo,cantidadTotal}]}` → crea ONG habilitada + su usuario |
| `GET /ongs` | autenticado | ONGs habilitadas |
| `PUT /ongs/:ref/recursos` | integracion | Alta/actualización de stock: `[{recursoCodigo,cantidadTotal}]` |
| `GET /ongs/:ref/recursos` | integracion, o la propia `ong` | Total, comprometido y disponible por recurso |
| `GET /recursos/disponibilidad` | autenticado | Disponibilidad global por `recursoCodigo` |
| `POST /validaciones` | integracion | Evalúa ofertas (ver abajo). Lee con lock, no reserva |
| `POST /compromisos` | integracion | Reserva transaccional de **todas** las ofertas adjudicadas (todo o nada); idempotente por `(emergenciaId, ofertaId)` |
| `POST /emergencias/:emergenciaId/finalizacion` | integracion | `{ongRefs:[…]}`: ONGs que terminaron su actividad |
| `POST /emergencias/:emergenciaId/cierre` | integracion | Cierra el proyecto y libera todo lo comprometido |
| `GET /health` | público | Healthcheck |
| `GET /docs` | público | Swagger UI (`/docs.json` con el OpenAPI) |

**`POST /validaciones`** — request (es exactamente lo que devuelve el `consolidado` de la web-app):

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

Con consorcio, `habilitada = min(ofrecida, disponible sumado de las ONGs de la oferta)`.
Con 0 ofertas, `resultados` es `[]` y `todosLosLotesCubiertos` es `false`.

**`POST /compromisos`** — request y response:

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
Si falta stock → `409` con el detalle de qué recurso y de qué ONG; no se reserva nada.

**Concurrencia:** una transacción por llamada; `SELECT … FOR UPDATE` sobre las
filas de `ong_recursos` involucradas, **ordenadas por id** (evita deadlocks);
`CHECK (cantidad_comprometida <= cantidad_total)` como red de seguridad.

---

## 5. Contrato interno de la web-app (lo que usan Bonita y el cliente)

**Para Bonita** (`/api/internal/*`, header `X-Integration-Key`, sin sesión de usuario):

| Método y ruta | Qué hace |
|---|---|
| `GET /api/internal/emergencies/:id/consolidado` | Devuelve el body de `POST /validaciones` del SN (solo ofertas no retiradas; `rol` = `principal`/`asociada`→`apoyo` según `oferta_ongs`) |
| `PATCH /api/internal/emergencies/:id/estado` | `{estado}`; valida la transición contra una whitelist (incluye las inversas de reabrir/reformular) |
| `POST /api/internal/emergencies/:id/validaciones` | Guarda el `resultados` del SN, marca las ofertas `validada` y la emergencia `validada` |
| `GET /api/internal/emergencies/:id/adjudicacion` | Devuelve el body de `POST /compromisos` del SN con las ofertas adjudicadas |
| `GET /api/internal/emergencies/:id/finalizacion` | `{ongRefs:[…]}` de las ONGs que marcaron su oferta finalizada |
| `POST /api/internal/emergencies/:id/notificaciones` | `{tipo: CONVOCATORIA \| COMPROMISO}`; la web-app decide los destinatarios |

**Para el cliente** (sesión de Bonita; el rol se valida en el backend):

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /api/emergencies/:id/ofertas` | coordinador | Ofertas con su perfil de validación (hoy documentado y no implementado) |
| `POST /api/emergencies/:id/decision` | coordinador | `{camino: continuar \| reabrir \| reformular}`: completa "Decidir como Continuar" con `camino` y aplica el efecto (reabrir: ofertas → `registrada`, completa "Publicar Convocatoria", estado `convocatoria_abierta`; reformular: ofertas → `retirada`, estado `registrada`, el coordinador rearma lotes y vuelve a publicar con el endpoint existente) |
| `GET /api/emergencies/:id/ofertas/validadas` | municipio | Solo ofertas validadas, con perfil |
| `POST /api/emergencies/:id/adjudicacion` | municipio | `{ofertaIds:[…]}`; ofertas → `adjudicada`/`no_seleccionada`, completa "Adjudicar Ofertas"; si Bonita falla, revierte |
| `POST /api/ofertas/:id/finalizar` | ONG | Marca la oferta `finalizada` (solo si está `adjudicada` y es de su ONG) |
| `POST /api/emergencies/:id/cierre-ejecucion` | coordinador | Solo si todas las adjudicadas están `finalizada`; completa "Confirmar cierre de ejecución" |
| `GET /api/notificaciones`, `PATCH /api/notificaciones/:id/leida` | ONG | Bandeja de la ONG |

---

## 6. Estado de partida (revisado contra el código y el `.bos`)

**Ya funciona:** login contra Bonita con roles, alta de emergencias, lotes,
publicación de convocatoria (completa tareas en Bonita), ofertas con consorcios
y historial, esquema de BD con migraciones, docker-compose.

**Falta o hay que corregir:**
- `sistema-nacional/` está vacío.
- No existe el endpoint `consolidado` (aunque está documentado) y `/api/emergencies` exige sesión de usuario, que Bonita no tiene.
- Nada pasa la emergencia a `convocatoria_cerrada`; el `CHECK` de estados solo tiene 3 valores.
- `lotes.resource_type` guarda la etiqueta ("Paramédicos"), no el id estable.
- Reformular lotes falla con ofertas cargadas: `DELETE FROM lotes` choca con `oferta_lotes.lote_id ON DELETE RESTRICT`. Reabrir y reformular no tienen soporte web.
- No existen adjudicación, notificaciones, "marcar finalizada" ni cierre en la app.
- Bonita: **no hay operaciones**, así que `todosLosLotesCubiertos` queda siempre en `false`; "Decidir como Continuar" no tiene contrato, por lo que `caminoASeguir` queda siempre en `reabrir`.
- Bonita: solo 2 conectores y ambos son placeholders; "Validar Ofertas", "Informar Cierre", "Liberar recursos" y las tareas de notificación no tienen conector.
- Bonita: el timer es constante (`7200000L`) y no usa `duracionConvocatoria`; hay una tarea huérfana "Cópia de Informar Cierre Y Liberar Cursos"; "Cargar ofertas" no tiene flujo de salida (hoy solo la interrumpe el timer).
- `web-app/server/.env.example` tiene `SISTEMA_NACIONAL_JWT_SECRET`: el secreto debe vivir solo en el SN.
- El `Dockerfile` del server corre `npm run dev` (solo desarrollo).

---

## 7. Tareas

Formato: `[ ]` pendiente · `[x]` hecha · **Est.** en horas · **Resp.** a completar al repartir.

### Avance al 15/10 (Pista A — MiloEspi)

- **Hecho:** E3-01, E3-10 a E3-17, E3-20 y E3-23. El SN corre en local con
  Docker; 28 tests en verde (incluye 8 cierres concurrentes). Ramas
  encadenadas `feat/e3-sistema-nacional-base` → `feat/e3-20-onboarding-ongs`
  → `feat/e3-23-finalizacion-cierre` → `feat/e3-26-swagger`: alcanza con un
  PR desde la última hacia `main`.
- **E3-26:** OpenAPI completo con ejemplos y `npm run docs:export` (YAML,
  JSON, HTML y PDF en `docs/sistema-nacional-api/`). Falta re-exportar con
  la URL de Render y cuando la Pista B termine `/validaciones` y
  `/compromisos`.
- **E3-08 / E3-80:** proyecto Neon `rescuesync-sn` creado (AWS US East 2,
  Ohio) y conexión directa probada. Las migraciones corren solas al
  arrancar el servicio en Render.
- **E3-81 (bloqueado):** Render no puede leer el repo porque es privado y de
  la cuenta personal de Federico. Opciones: que Federico instale la app de
  Render en el repo, que configure él el servicio, o hacer el repo público.
- **Para la Pista B:** `/compromisos` tiene que bloquear en el mismo orden
  que el cierre (primero `compromisos`, después `ong_recursos`, `ORDER BY
  id`); ver `docs/api-contracts-sistema-nacional.md`.

### Fase 0 — Acuerdos (todos) · ~1 h, bloquea todo

| ID | Tarea | Resp. |
|---|---|---|
| [x] E3-01 | Copiar las secciones 4 y 5 a `docs/api-contracts-sistema-nacional.md` y `docs/api-contracts.md` (fuente única) | MiloEspi |
| [x] E3-02 a E3-07, E3-09 | Decisiones de la sección 2 | — |
| [ ] E3-08 | Crear cuentas de Neon y Render (se hace en la Fase 6; no bloquea el desarrollo local) | MiloEspi |
| [ ] E3-09b | Validar la regla de reformular/reabrir de la sección 2 (la única decisión que el equipo todavía no vio) | |
| [ ] E3-0R | Repartir pistas y completar la columna "Resp." de todo este documento | |

### Fase 1 — Pista A · Sistema Nacional: base

| ID | Tarea | Est. | Resp. |
|---|---|---|---|
| [x] E3-10 | Scaffolding en `rescuesync/sistema-nacional/`: Express (ESM), `pg`, `node-pg-migrate`, `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`; ESLint/Prettier iguales a `web-app` | 3 | MiloEspi |
| [x] E3-11 | Conexión a Postgres con SSL (Neon exige `sslmode=require`) y config por `.env` / `.env.example` | 1 | MiloEspi |
| [x] E3-12 | Migración inicial: `api_clients` (usuarios, hash bcrypt, rol, `ong_ref`), `ongs`, `recursos_catalogo` (seed con el catálogo del cliente), `ong_recursos` (`cantidad_total`, `cantidad_comprometida`, `CHECK`), `compromisos`, `compromiso_items` | 3 | MiloEspi |
| [x] E3-13 | `POST /auth/login` + middlewares `requireAuth` / `requireRole`; seed del cliente `rescuesync-integracion` (clave por variable de entorno) | 3 | MiloEspi |
| [x] E3-14 | `GET /health`; errores uniformes `{ "message" }`; códigos HTTP correctos | 1 | MiloEspi |
| [x] E3-15 | `Dockerfile` de producción (`npm ci --omit=dev`, `CMD node src/index.js`) + `docker-compose.yml` local con Postgres | 2 | MiloEspi |
| [x] E3-16 | Esqueleto de `openapi.yaml` y Swagger UI en `/docs` con esquema Bearer | 2 | MiloEspi |
| [x] E3-17 | Endurecimiento básico: solo HTTPS en producción, `helmet`, límite de tamaño del body, rate limit en `/auth/login`, SQL siempre parametrizado, `JWT_SECRET` largo solo por variable de entorno | 2 | MiloEspi |

### Fase 2 — Pista B · Sistema Nacional: dominio (depende de E3-12 y E3-13)

| ID | Tarea | Est. | Resp. |
|---|---|---|---|
| [x] E3-20 | Onboarding y catálogo: `POST /ongs` (ONG + usuario), `GET /ongs`, `PUT/GET /ongs/:ref/recursos`, `GET /recursos/disponibilidad` | 5 | MiloEspi |
| [ ] E3-21 | Validación: transacción con `FOR UPDATE` ordenado, algoritmo de competencia y riesgo, respuesta estructurada | 6 | |
| [x] E3-22 | Compromiso en lote (todo o nada): reparto automático por ONG, `409` con detalle si falta stock, idempotencia por `(emergenciaId, ofertaId)` | 6 | FedericoK |
| [x] E3-23 | Finalización por ONG y cierre del proyecto con liberación (`cantidad_comprometida -=`) | 4 | MiloEspi |
| [x] E3-24 | **Prueba de concurrencia**: N pedidos paralelos sobre el mismo stock → nunca sobre-asigna. Queda en el repo (es la evidencia del locking) | 3 | FedericoK |
| [ ] E3-25 | Tests de integración (al menos validación, compromiso y cierre) | 4 | |
| [ ] E3-26 | OpenAPI completo con ejemplos y **exportar el documento Swagger** (`openapi.yaml` + PDF/HTML) para la entrega | 3 | MiloEspi |

### Fase 3 — Pista C · Bonita (guías paso a paso; cada cambio se carga en Studio)

| ID | Tarea | Est. | Resp. |
|---|---|---|---|
| [ ] E3-30 | Variables `snToken` y `resultadoValidacion` (y `ofertasJson` si hace falta; verificar el límite del tipo Text). **Parámetros del proceso**: URL y credenciales del SN, URL de la web-app, `BONITA_INTEGRATION_KEY`. Borrar la tarea huérfana "Cópia de Informar Cierre Y Liberar Cursos". Resolver la rama sin salida de "Cargar ofertas" | 2 | |
| [ ] E3-31 | Timer parametrizable con `duracionConvocatoria` (2 h por defecto; 2-5 min para demo y pruebas) | 1 | |
| [ ] E3-32 | "Notificar Cierre de Convocatoria": `PATCH /api/internal/emergencies/:id/estado` → `convocatoria_cerrada` | 2 | |
| [ ] E3-33 | "Obtener Ofertas": `GET …/consolidado` con `X-Integration-Key`; guardar la respuesta | 2 | |
| [ ] E3-34 | "Validar Ofertas": conector de login al SN (guarda `snToken`) → `POST /validaciones` con el consolidado → operación que setea `todosLosLotesCubiertos` desde `resumen` → `POST …/validaciones` a la web-app | 5 | |
| [ ] E3-35 | "Decidir como Continuar": agregar **contrato** (input `camino`: `continuar`/`reabrir`/`reformular`) y operación que lo copia a `caminoASeguir` | 2 | |
| [ ] E3-36 | "Registrar Compromiso de Recursos": `GET …/adjudicacion` → relogin al SN → `POST /compromisos` | 4 | |
| [ ] E3-37 | "Informar Cierre": `GET …/finalizacion` → `POST /emergencias/:id/finalizacion`. "Liberar recursos": `POST /emergencias/:id/cierre` y `PATCH` estado `finalizada` | 3 | |
| [ ] E3-38 | Tareas de notificación: "Notificar Convocatoria a ONGs" y "Notificar Compromiso" → `POST …/notificaciones`; "Etapa Ejecución" → `PATCH` estado `en_ejecucion` | 3 | |
| [ ] E3-39 | Reemplazar el ReceiveTask "Esperar Cierre de Actividades ONGs" por la tarea humana "Confirmar cierre de ejecución" (carril Centro Coordinador, sin contrato), con el mismo flujo hacia "Informar Cierre" | 2 | |
| [ ] E3-39b | Verificar en Studio que REABRIR vuelve a "Publicar Convocatoria" (reinicia el timer) y REFORMULAR a "Generar Lotes de Necesidades" | 2 | |
| [ ] E3-40 | Timeouts (60 s por defecto vs. arranque en frío de Render) y TLS; exportar el `.bos` actualizado al repo de Bonita y actualizar `bonita/README.md` | 1 | |

### Fase 4 — Pista D · Web-app backend

*Bonita necesita esta fase para E3-32/33/36: priorizar E3-50 a E3-55.*

| ID | Tarea | Est. | Resp. |
|---|---|---|---|
| [ ] E3-50 | Migración: `lotes.resource_code`; ampliar los `CHECK` de estados de emergencia y oferta; tablas `oferta_validaciones`, `adjudicaciones`, `notificaciones`, `oferta_finalizaciones` | 4 | |
| [ ] E3-51 | Guardar y devolver `resourceCode` junto a `resourceType` (cliente, server, `shared/lote-validation.js`, `api-contracts.md`) | 3 | |
| [ ] E3-52 | Middleware `requireIntegrationKey` y router `/api/internal/*` | 2 | |
| [ ] E3-53 | `GET /api/internal/emergencies/:id/consolidado` en formato SN (incluye `severidad`, `recursoCodigo`, `ref` de ONG) | 3 | |
| [ ] E3-54 | `PATCH …/estado` con whitelist de transiciones; al cerrar bloquea la edición de ofertas | 3 | |
| [ ] E3-55 | `POST …/validaciones`: guarda perfiles, ofertas y emergencia → `validada` | 3 | |
| [ ] E3-56 | Adjudicación: `GET …/ofertas/validadas`, `POST …/adjudicacion` (completa "Adjudicar Ofertas", revierte si Bonita falla) y `GET /api/internal/…/adjudicacion` | 5 | |
| [ ] E3-57 | `POST /api/ofertas/:id/finalizar` y `GET /api/internal/…/finalizacion` | 4 | |
| [ ] E3-58 | Notificaciones: `POST /api/internal/…/notificaciones`, `GET /api/notificaciones`, marcar como leída | 3 | |
| [ ] E3-59 | `GET /api/emergencies/:id/ofertas` (coordinador) con perfil de validación | 1 | |
| [ ] E3-60 | `Dockerfile` de producción del server (`npm start`, `npm ci --omit=dev`); el modo dev sigue en compose | 1 | |
| [ ] E3-61 | `POST /api/emergencies/:id/decision` (continuar / reabrir / reformular) con los efectos de la sección 5; reformular aplica la regla de lotes y ofertas | 5 | |
| [ ] E3-62 | `POST /api/emergencies/:id/cierre-ejecucion` | 2 | |

### Fase 5 — Pista E · Web-app frontend y QA (depende de los contratos de la sección 5)

| ID | Tarea | Est. | Resp. |
|---|---|---|---|
| [ ] E3-70 | Coordinador: ver ofertas con su perfil de validación y elegir continuar / reabrir / reformular (usa E3-61) | 7 | |
| [ ] E3-71 | Operador Municipal: pantalla de adjudicación (solo ofertas validadas, con perfil de competencia y riesgo) | 5 | |
| [ ] E3-72 | ONG: bandeja de notificaciones (convocatoria, adjudicada / no seleccionada) y botón "Marcar actividad como finalizada" | 5 | |
| [ ] E3-73 | Estados nuevos en `EmergenciesListPage` y `ProgressTracker` | 3 | |
| [ ] E3-74 | Coordinador: botón "Confirmar cierre de ejecución" (habilitado cuando todas las adjudicadas están finalizadas; usa E3-62) | 3 | |
| [ ] E3-75 | QA del flujo completo y lista de casos para la demo | 4 | |

### Fase 6 — Despliegue y documentación (Pistas A + B; depende de E3-23 y E3-26)

| ID | Tarea | Est. | Resp. |
|---|---|---|---|
| [ ] E3-80 | Neon: crear la base, correr migraciones y guardar `DATABASE_URL` (usar conexión directa, no el pooler en modo transacción) | 1 | MiloEspi |
| [ ] E3-81 | Render: Web Service Docker apuntando a `rescuesync/sistema-nacional`, variables (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`), healthcheck en `/health` | 2 | MiloEspi |
| [ ] E3-82 | Seed de producción: cliente de integración, ONGs demo (`rescatistas-unidos`, `manos-solidarias`) y su stock limitado | 1 | |
| [ ] E3-83 | Swagger público en `/docs` probado con "Authorize" servicio por servicio | 1 | |
| [ ] E3-84 | Backup de la base (dump fuera del repo) y nota sobre la política de 30 días | 1 | |
| [ ] E3-85 | README del SN: cómo correrlo local y con Docker, variables, URL pública, usuario de prueba | 2 | |
| [ ] E3-86 | Actualizar `README.md` raíz, `CLAUDE.md` (el SN deja de ser "no se codea") y `.env.example` de la web-app: **quitar** `SISTEMA_NACIONAL_JWT_SECRET` y agregar `BONITA_INTEGRATION_KEY` | 1 | |

### Fase 7 — Integración y cierre (todos)

| ID | Tarea | Resp. |
|---|---|---|
| [ ] E3-90 | Prueba end-to-end con el SN en Render: alta → lotes → convocatoria → ofertas (parcial y consorcio) → vence el timer → validación → adjudicación → compromiso → finalización → cierre; verificar el stock del SN antes y después | |
| [ ] E3-91 | Camino alternativo: sin cobertura total → "Decidir como Continuar" → reabrir / reformular (con ofertas ya cargadas) / continuar; caso borde de **0 ofertas** | |
| [ ] E3-92 | Prueba de concurrencia contra Render (E3-24 apuntando a la nube) | |
| [ ] E3-93 | Paquete de entrega: URL del SN, URL de Swagger, URLs de repos, Dockerfile, `.bos` actualizado | |
| [ ] E3-94 | **Bitácora de desvíos** (estimado vs. real por tarea): insumo del Gantt de la Entrega 4 | |
| [ ] E3-95 | Grooming de las Entregas 4 y 5: dashboard de indicadores, Gantt, informe final | |

---

## 8. Pistas y dependencias

```
Fase 0 ──► A (Fase 1) ──► B (Fase 2) ──► Deploy (Fase 6) ──┐
      ├──► D (Fase 4) ──► E (Fase 5) ──────────────────────┼──► Fase 7
      └──► C (Fase 3: usa D para consolidado/estado y A/B para el SN) ┘
```

**Orden:** (1) Fase 0; (2) A y D arrancan, C prepara variables y timer;
(3) B y el resto de D, C conecta contra el SN local; (4) despliegue, E con las
pantallas, C prueba contra la nube; (5) Fase 7.

**Reparto sugerido** (ajustar por afinidad): **A** base del SN + despliegue ·
**B** dominio y concurrencia del SN · **C** Bonita · **D** backend web-app ·
**E** frontend + QA + documentación. Carga estimada: ~152 h en total (~31 h por
persona). D es la más cargada: si hace falta, E3-58 y E3-59 pasan a E. Si hay que
recortar, empezar por E3-58 y E3-84.

---

## 9. Definición de "hecho"

- [ ] SN desplegado en Render con BD en Neon, accesible por HTTPS.
- [ ] Login con JWT; el resto de los endpoints responden `401` sin token.
- [ ] Onboarding de ONGs (con su usuario), consulta de ONGs y de disponibilidad global.
- [ ] La validación devuelve perfiles (capacidades y riesgo), nunca un rechazo binario.
- [ ] Compromiso y validación con locking; la prueba de concurrencia no sobre-asigna.
- [ ] Finalización, cierre y liberación de recursos funcionando.
- [ ] Swagger público y completo; `Dockerfile` en el repo.
- [ ] Bonita llama al SN y a la web-app con conectores reales (sin placeholders).
- [ ] Documentación actualizada (`docs/`, READMEs, `CLAUDE.md`).

**Fuera de alcance:** dashboard y pantallas del Auditor (Entrega 4/5), Gantt
(Entrega 4), informe final (Entrega 5), certificaciones y sincronización de
stock entre SN y app local.

---

## 10. Riesgos

- **Arranque en frío de Render (plan gratuito):** la primera llamada puede tardar ~1 min y los conectores tienen timeout de 60 s. Hacer un healthcheck previo o subir el timeout.
- **Neon + transacciones:** usar conexión directa (no el pooler en modo transacción) para `FOR UPDATE`.
- **Token JWT vs. duración del flujo:** el token dura 1 h; hacer login justo antes de cada llamada al SN.
- **Cada integrante tiene su Bonita local:** las URLs salen de parámetros del proceso, no hardcodeadas con `localhost`.
- **Nombres exactos de tareas:** la web-app completa tareas por nombre (`completePendingTasks`); renombrar una rompe la integración. Avisar antes.
- **Secretos:** `.env` está en `.gitignore`; `JWT_SECRET` y `DATABASE_URL` de producción van solo como variables de entorno de Render.
- **Lotes viejos sin `resource_code`:** borrarlos o recargarlos antes de probar la integración.
