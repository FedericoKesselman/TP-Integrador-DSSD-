# Roadmap — Entrega 5 (RescueSync) · versión final

**Objetivo:** que el ciclo completo de una emergencia funcione de punta a punta
con **Bonita como orquestador** (registro → lotes → convocatoria → timer →
validación → decisión → adjudicación → compromiso → ejecución → cierre y
liberación), con los cuatro perfiles, el dashboard del Auditor y el **informe
final** que documenta cada componente, su rol y su interacción.

**Fecha de entrega:** jueves **19/11/2026** (sistema funcionando + informe).
Coloquio: semana del 26/11. Recuperatorio: semana del 3/12.

**Se entrega:** informe final (PDF), `.bos` actualizado, URL del Sistema
Nacional y de su Swagger, URLs de repositorios, Dockerfile, Gantt final.

Cómo leer este archivo: primero **Cómo trabajar** (sección 1), después
**Decisiones** (2), **Arquitectura** (3), **Contratos** (4 y 5) y, al final,
el **banco de tareas** (sección 7).

---

## 1. Cómo trabajar: banco de tareas libre

No hay pistas con dueño. Cada integrante toma la tarea que quiera o pueda,
siempre que **sus dependencias estén tildadas**.

**Columnas de cada tarea:**

- **Necesita:** tareas directas que tienen que estar tildadas **antes de
  empezar**. Las dependencias transitivas se heredan (si A necesita B y B
  necesita C, A necesita C aunque no figure).
- **Se prueba con:** tareas que no bloquean el comienzo (podés construir
  contra el contrato y con datos de prueba), pero **la tarea no se tilda
  hasta probarla con ellas**.
- **Prio:** `P1` imprescindible para cumplir la consigna · `P2` recomendada ·
  `P3` si sobra tiempo.
- **Tomada por:** nombre y fecha. Se completa con un commit chico a `main` que
  toque solo esa línea, **antes** de empezar.

**Reglas para todos:**

1. **El contrato manda.** Las secciones 4 y 5 son la fuente única. Si hay que
   cambiar un endpoint, un campo o un estado: se avisa al equipo y se edita el
   contrato **antes** de tocar código.
2. Una rama por tarea: `feat/e5-17-decision`. Commits en Conventional Commits
   (`feat(web-app): …`), alcance = nombre del sistema.
3. Antes de commitear: `npm run lint:fix` y `npm run format` en el paquete.
4. Nunca commitear `.env`, claves, cookies ni connection strings.
5. No editar archivos que está tocando otra tarea sin avisar.
6. **Bonita: una sola tarea del `.proc` en curso a la vez.** El archivo del
   proceso es un XML largo que no se puede mergear a mano. Quien toma una
   tarea de Bonita lo anota en "Tomada por", trabaja, exporta, commitea y
   recién ahí la libera. Orden sugerido: el de los IDs.
7. **No renombrar tareas del diagrama de Bonita:** la web-app completa tareas
   por nombre exacto (lista en la sección 5.3).
8. **Todo lo de Bonita se verifica contra la documentación oficial de Bonita
   10.4** antes de cargarlo en Studio. Cada tarea de Bonita arranca pidiendo
   su guía paso a paso (con valores exactos) en un chat aparte.
9. Pantallas nuevas **responsive** (el enunciado lo exige).
10. Al terminar una tarea: tildarla, anotar las **horas reales** en la bitácora
    (E5-90) y completar el apartado del informe que le corresponde (ver
    "Informe" abajo).
11. **Informe:** se escribe mientras se construye. Cada tarea que termina un
    componente se cierra recién cuando su apartado en el documento (E5-01)
    tiene el borrador. Los apartados por componente son las tareas
    E5-81 a E5-85.

### Protocolo de uso con el asistente

Cada integrante trabaja con su asistente de IA, que lee este archivo y lo
mantiene actualizado. Una tarea tiene tres estados:

- **Libre:** `[ ]` y "Tomada por" vacío.
- **En curso:** `[ ]` y "Tomada por" con nombre y fecha.
- **Hecha:** `[x]`; "Tomada por" conserva el nombre.

**1. Elegir tarea.** El asistente propone la tarea siguiendo este orden:

1. Solo tareas **libres**, con **todas** las de "Necesita" en `[x]`
   (incluidas las dependencias transitivas).
2. Primero P1, después P2 y P3.
3. Si es una tarea de Bonita (E5-30 a E5-40), solo si **no hay otra de
   Bonita en curso**.
4. Entre las que cumplen todo lo anterior, preferir la que **desbloquea más
   tareas** o la del camino crítico (sección 8).

El asistente responde con la tarea elegida y una línea de por qué. La decisión
final es de quien la va a hacer.

**2. Tomar la tarea.** Antes de empezar:

1. `git pull` en `main`.
2. Volver a mirar que la tarea siga libre y que sus dependencias estén en
   `[x]`.
3. Completar "Tomada por" (nombre y fecha) en esa línea y nada más. Commit
   chico a `main` y push.
4. Si el push es rechazado: `git pull --rebase` y volver al paso 2. Si alguien
   la tomó en el medio, elegir otra.

**3. Terminar la tarea.** Solo cuando se cumple su definición de hecho y se
probó con las tareas de "Se prueba con":

1. Tildar `[x]` en `main` con un commit chico que toque solo esa línea.
2. Anotar las **horas reales** en la bitácora (E5-90).
3. Completar el apartado del informe que le corresponde (regla 11).

**4. Soltar una tarea.** Si alguien no puede seguir, borra su nombre de
"Tomada por", deja en la rama lo avanzado y avisa al grupo. La tarea vuelve a
estar libre.

**5. Si algo del contrato no cierra,** el asistente avisa y no inventa
formatos (regla 1).

**Mensaje para elegir tarea** (pegarlo en el chat del asistente junto con
este archivo):

> Leé `rescuesync/roadmapfase5.md` (secciones 1 a 5 y 7). Decime qué tarea
> me conviene tomar ahora, siguiendo el paso 1 del protocolo de uso:
> solo tareas libres con dependencias tildadas, primero P1, y respetando la
> regla de una sola tarea de Bonita a la vez. Dame la tarea elegida y una
> línea de por qué.

**Mensaje para tomarla y marcar el archivo** (después de elegir):

> Voy a hacer la tarea `<TAREA>`. Seguí el paso 2 del protocolo: `git pull`,
> verificá que siga libre y que sus dependencias estén tildadas, completá
> "Tomada por" con mi nombre y la fecha de hoy, y hacé un commit chico a
> `main` que toque solo esa línea. Después seguí con el mensaje inicial de
> abajo.

**Mensaje inicial sugerido para tu agente** (reemplazar `<TAREA>`):

> Leé `CLAUDE.md`, `rescuesync/roadmapfase5.md` (secciones 1 a 5) y
> `docs/api-contracts.md`. Voy a hacer la tarea `<TAREA>`. Verificá que sus
> dependencias de "Necesita" estén tildadas. Respetá el contrato y las reglas
> de la sección 1, trabajá en una rama propia, corré lint y tests antes de
> cerrar y avisame si algo del contrato no cierra en lugar de inventar un
> formato. Si es una tarea de Bonita, no edites el `.proc` por tu cuenta:
> seguí la guía y verificá cada paso contra la documentación oficial.

**Dos repositorios:** el código vive en el repo de RescueSync y el diagrama en
el repo de Bonita. Las tareas de Bonita (E5-30 a E5-40) se commitean en el
repo de Bonita.

---

## 2. Decisiones tomadas (no reabrir)

| Tema | Decisión |
|---|---|
| Alcance | Todo funcionando el **19/11**: Bonita, web-app, Sistema Nacional, dashboard e informe |
| Orquestación | **Bonita inicia todo lo que pertenece al ciclo**: cierre de convocatoria, consulta de ofertas, validación, compromiso, notificaciones, cambios de estado, finalización y liberación |
| Inventario de la ONG | Pantalla "Mi inventario". El **backend de la web-app** habla con el SN usando la cuenta de integración y toma la ONG **siempre de la sesión**. Es la **única excepción** a "solo Bonita habla con el SN": es mantenimiento del stock, no un paso del ciclo. Se documenta en el informe |
| `.env` mínimo | Solo secretos (contraseña de la base, secreto de sesión, clave de integración, credenciales del SN). URLs, puertos, nombre del proceso y CORS van como valores por defecto en el código o en `docker-compose`. La lista final la fija E5-06 |
| Clave única de integración | **Una sola clave** (`X-Integration-Key`). En la web-app, variable de entorno; en Bonita, **parámetro del proceso**. Se eliminan `~/.rescuesync/bonita-notification-token`, `BONITA_NOTIFICATION_TOKEN` y el Bearer ad-hoc de notificaciones. El conector de notificaciones de `master` se adapta; no se mergea la rama vieja `feat/notificar-convocatoria-ongs` |
| Dashboard | **Módulo propio dentro de la web-app** (aprobado de palabra por el ayudante; E5-03 lo pide por escrito). Rutas `/api/dashboard/*`, carpeta propia en el cliente, rol `auditor` con su usuario de Bonita. La carpeta `dashboard/` del repo se reemplaza por un README que lo explica |
| Duración de la ventana | La elige el **coordinador al publicar** (y al reabrir): valor sugerido, mínimo y máximo validados. Viaja a Bonita como input de "Publicar Convocatoria" y el timer lee `duracionConvocatoria` (minutos) |
| Camino alternativo | **Continuar:** adjudicación con las ofertas validadas, aunque la cobertura sea parcial. **Reabrir:** las ofertas se mantienen (vuelven a `registrada`), se avisa a las ONGs, nueva ventana. **Reformular:** las ofertas pasan a `retirada` (snapshot en `oferta_historial`), se borran sus `oferta_lotes`, el coordinador rearma lotes y vuelve a publicar |
| Aviso en reformular | Cada ONG con oferta recibe un aviso `OFERTA_RETIRADA` en su bandeja, **en el mismo paso** que retira las ofertas. Después recibe el aviso normal de convocatoria |
| Compromiso antes de notificar | Se registra el compromiso en el SN **antes** de notificar a las ONGs. Si el SN responde `409`, el proceso vuelve a "Adjudicar Ofertas" con el detalle y las ONGs no reciben ningún aviso |
| Cierre de ejecución | El ReceiveTask "Esperar Cierre de Actividades ONGs" se reemplaza por la tarea humana **"Confirmar cierre de ejecución"** del Centro Coordinador |
| Informe | Se escribe a medida que se construye. Primero se crea la base del documento (E5-01) y después se completa en paralelo |
| Login de usuarios | **No se toca**: login service de Bonita. El JWT del SN es un sistema aparte |
| Certificaciones | No existen (el profesor las sacó del enunciado) |
| Notificaciones | Solo dentro de la app (bandeja de la ONG). Sin email |

### Supuestos propuestos (a confirmar por el equipo)

Son valores que propuse sin que se hayan discutido:

1. Duración de la ventana, en minutos: sugerido **120**, mínimo **1**, máximo **10080** (7 días). Con 2 minutos se hace la demo.
2. "Cargar ofertas" **sin flujo de salida normal** es intencional: la ventana se cierra solo por tiempo, como dice el enunciado. Se documenta en lugar de agregar una salida (E5-39).
3. Definiciones del dashboard (sección 5.5).
4. Los lotes cargados antes de existir `resource_code` se borran y se recargan (no se rellenan).
5. Reabrir no pide confirmación a las ONGs: simplemente se les avisa.

---

## 3. Arquitectura y flujo objetivo

```
Navegador ─► web-app (Express) ─► Bonita (sesión del usuario)         [ya existe]
                │  ▲                      │
                │  │ /api/internal/*      │ conectores REST
                │  │ (X-Integration-Key)  ▼
                │  └──────────────── Bonita ──► Sistema Nacional (JWT, Render + Neon)
                │
                └── solo "Mi inventario" ─────────────────────────► Sistema Nacional
                                                                    (cuenta de integración)
Dashboard (módulo de la web-app) ──► BD propia + API REST de Bonita (sesión del Auditor)
```

**Diagrama objetivo de Bonita** (nombres exactos de tareas):

```
Start1 → Registrar Emergencia → Revisar Emergencia → Generar Lotes de Necesidades
→ Publicar Convocatoria [contrato: duracionConvocatoria]
→ Notificar Convocatoria a ONGs
→ Cargar ofertas (Parcial / Completa) [Timer = duracionConvocatoria minutos]
→ Notificar Cierre de Convocatoria a ONGS [estado convocatoria_cerrada + aviso]
→ Obtener Ofertas [GET consolidado]
→ Validar Ofertas [login SN, POST /validaciones, informa a la web-app]
→ ¿Se cubrieron todos los lotes?
     SÍ → Adjudicar Ofertas
     NO → Decidir como Continuar [contrato: camino] → ¿Qué camino seguir?
            CONTINUAR  → Adjudicar Ofertas
            REABRIR    → Publicar Convocatoria
            REFORMULAR → Generar Lotes de Necesidades
Adjudicar Ofertas → Registrar Compromiso de Recursos de ONGS [GET adjudicacion, login SN, POST /compromisos]
→ ¿Compromiso confirmado?
     SÍ → Registrar Compromiso Confirmado [web-app] → Notificar Compromiso a las ONGs
          → Etapa Ejecución [estado en_ejecucion] → Confirmar cierre de ejecución
          → Informar Cierre [GET finalizacion, POST SN finalizacion]
          → Liberar recursos [POST SN cierre, estado finalizada] → Fin1
     NO → Informar Compromiso Fallido [web-app, con el detalle del 409] → Adjudicar Ofertas
```

---

## 4. Contrato del Sistema Nacional

**Sin cambios.** El SN está completo según el roadmap de la Entrega 3 (12
endpoints). El contrato vigente es `docs/api-contracts-sistema-nacional.md`.
URL de Render según la spec exportada:
`https://tp-integrador-dssd-rescuesync-sistema.onrender.com` (E5-05 la
verifica).

Lo que usa esta entrega: `POST /auth/login`, `GET/PUT /ongs/:ref/recursos`,
`POST /validaciones`, `POST /compromisos` (`409` con detalle por ONG),
`POST /emergencias/:id/finalizacion` y `POST /emergencias/:id/cierre`.

---

## 5. Contrato interno de la web-app

### 5.1 Estados

**Emergencia:** `registrada → convocatoria_abierta → convocatoria_cerrada →
validada → adjudicada → en_ejecucion → finalizada`.

**Transiciones permitidas** (whitelist de `PATCH …/estado` y de los endpoints
de decisión):

| Desde | Hacia | Lo dispara |
|---|---|---|
| `registrada` | `convocatoria_abierta` | Publicar convocatoria (coordinador) |
| `convocatoria_abierta` | `convocatoria_cerrada` | Bonita, al vencer el timer |
| `convocatoria_cerrada` | `validada` | Bonita, al guardar los resultados del SN (también con 0 ofertas) |
| `validada` | `convocatoria_abierta` | Decisión **reabrir** |
| `validada` | `registrada` | Decisión **reformular** |
| `validada` | `adjudicada` | Bonita, al confirmar el compromiso |
| `adjudicada` | `en_ejecucion` | Bonita ("Etapa Ejecución") |
| `en_ejecucion` | `finalizada` | Bonita ("Liberar recursos") |

**Oferta:** `registrada`, `retirada`, `validada`, `adjudicada`,
`no_seleccionada`, `finalizada`. Al adjudicar, la selección del municipio se
guarda aparte y las ofertas **solo pasan a `adjudicada` / `no_seleccionada`
cuando el SN confirma el compromiso**. Si el SN rechaza, nada cambia.

Se guarda un historial de cambios de estado de cada emergencia (alimenta el
dashboard).

### 5.2 Para Bonita (`/api/internal/*`, header `X-Integration-Key`, sin sesión de usuario)

| Método y ruta | Qué hace |
|---|---|
| `GET /api/internal/emergencies/:id/consolidado` | Body de `POST /validaciones` del SN (solo ofertas no retiradas; `rol` principal/apoyo según `oferta_ongs`) |
| `PATCH /api/internal/emergencies/:id/estado` | `{estado}`; valida la transición contra la whitelist |
| `POST /api/internal/emergencies/:id/validaciones` | Guarda los `resultados` del SN, marca ofertas `validada` y emergencia `validada` |
| `GET /api/internal/emergencies/:id/adjudicacion` | Body de `POST /compromisos` del SN con la selección del municipio |
| `POST /api/internal/emergencies/:id/compromiso-confirmado` | `{compromisos}` del SN: ofertas → `adjudicada` / `no_seleccionada`, emergencia → `adjudicada` |
| `POST /api/internal/emergencies/:id/compromiso-fallido` | `{detalle}` del `409`: la selección queda sin efecto y el detalle se muestra al municipio |
| `GET /api/internal/emergencies/:id/finalizacion` | `{ongRefs:[…]}` de las ONGs que marcaron su oferta finalizada |
| `POST /api/internal/emergencies/:id/notificaciones` | `{tipo}`; la web-app decide los destinatarios |

**Tipos de aviso:** `CONVOCATORIA`, `CIERRE_CONVOCATORIA`, `OFERTA_RETIRADA`
(la emite la propia web-app al reformular), `ADJUDICADA`, `NO_SELECCIONADA`.
Bonita manda el tipo `COMPROMISO` y la web-app genera `ADJUDICADA` o
`NO_SELECCIONADA` por ONG. Los dos endpoints actuales
(`/api/notifications/convocatoria` y `/cierre`) migran a este router y se
retira el Bearer.

### 5.3 Para el cliente (sesión de Bonita; el rol se valida en el backend)

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `POST /api/emergencies/:id/convocatoria` | coordinador | Se amplía: `{duracionMinutos}`; completa "Publicar Convocatoria" con ese input |
| `GET /api/emergencies/:id/ofertas` | coordinador | Ofertas con su perfil de validación y la cobertura por lote |
| `POST /api/emergencies/:id/decision` | coordinador | `{camino: continuar \| reabrir \| reformular, duracionMinutos?}`; completa "Decidir como Continuar" y aplica el efecto de la sección 2 |
| `GET /api/emergencies/:id/ofertas/validadas` | municipio | Solo ofertas validadas, con perfil y cobertura |
| `POST /api/emergencies/:id/adjudicacion` | municipio | `{ofertaIds:[…]}`; guarda la selección y completa "Adjudicar Ofertas"; si Bonita falla, revierte. El último `409` del SN se expone en `GET /api/emergencies/:id` |
| `POST /api/ofertas/:id/finalizar` | ONG | Solo si la oferta está `adjudicada` y es de su ONG |
| `POST /api/emergencies/:id/cierre-ejecucion` | coordinador | Solo si todas las adjudicadas están `finalizada`; completa "Confirmar cierre de ejecución" |
| `GET /api/notifications`, `PATCH /api/notifications/:id/leida` | ONG | Bandeja (se mantiene la ruta actual) |
| `GET /api/inventario`, `PUT /api/inventario` | ONG | Stock (total, comprometido, disponible) leído y actualizado en el SN; la ONG sale de la sesión |
| `GET /api/dashboard/indicadores`, `/tiempos-etapas`, `/export?formato=csv\|json` | auditor | Ver 5.5 |

**Nombres exactos de tareas que la web-app completa:** "Registrar Emergencia",
"Revisar Emergencia", "Generar Lotes de Necesidades", "Publicar Convocatoria",
"Adjudicar Ofertas", "Decidir como Continuar", "Confirmar cierre de
ejecución".

### 5.4 Bonita: parámetros y variables

**Parámetros del proceso:** `claveIntegracion`, `webAppUrl`, `snUrl`,
`snUsuario`, `snClave`.

**Variables:** `emergenciaId`, `caminoASeguir`, `todosLosLotesCubiertos`,
`duracionConvocatoria` (entero, minutos), `snToken`, `consolidado`,
`resultadoValidacion`, `compromisoConfirmado` (booleano), `detalleCompromiso`.
Hay que verificar el límite de tamaño del tipo Text para `consolidado`.

### 5.5 Dashboard (definiciones propuestas)

- **Datos propios:** suministros movilizados en el mes (suma de cantidades de
  ofertas `adjudicada` o `finalizada`, por recurso y mes) · % de resolución
  mediante consorcios (emergencias finalizadas con al menos una oferta
  adjudicada de 2 o más ONGs) · estado de proyectos (conteo y lista por
  estado) · cobertura promedio de lotes.
- **Datos de la API de Bonita:** tiempo promedio por etapa (registro →
  publicación, ventana de ofertas, validación → adjudicación, ejecución,
  total), calculado con las tareas cerradas de los casos.
- Gráficos interactivos (filtros por período y recurso) y exportación CSV y
  JSON.

---

## 6. Estado de partida (informes de Claude Code del 01/11)

**Ya funciona:** login con roles contra Bonita, alta de emergencias, lotes,
publicación de convocatoria (completa tareas en Bonita), ofertas con consorcios
e historial, bandeja de notificaciones de convocatoria, **Sistema Nacional
completo (12 endpoints)**. No hay ramas sin mergear en el repo de código.

**Falta o hay que corregir:**
- No existe `/api/internal/*` ni la clave de integración. Los estados permitidos en la base son 3 (emergencia) y 2 (oferta).
- `lotes.resource_code` no existe (la tarea E3-51 del roadmap anterior no se hizo).
- No existen decisión, adjudicación, finalización, cierre, ni la ruta de "marcar como leída".
- Frontend: solo existe la bandeja de notificaciones. El rol `auditor` está definido sin ninguna pantalla.
- `dashboard/` está vacío. Sin vínculo web-app → SN para el inventario.
- Bonita: 2 conectores reales (notificaciones, apuntan a `localhost:4000`) y 2 placeholders; no hay operaciones ni parámetros; "Decidir como Continuar" no tiene contrato; el timer está fijo en 2 minutos y `duracionConvocatoria` no se usa; la tarea huérfana "Cópia de Informar Cierre Y Liberar Cursos" sigue en el diagrama; hay 5 tareas de servicio sin conector.
- `Dockerfile` del server corre `npm run dev`. `SISTEMA_NACIONAL_JWT_SECRET` está mal ubicado en `web-app/server/.env.example`. `CLAUDE.md` dice que el SN "no se codea". El repo de Bonita no tiene README y tiene `cookies.txt` sin ignorar.
- Render: la URL figura en la spec exportada. Falta verificar arranque en frío y las ONGs demo.

---

## 7. Banco de tareas

Formato: `[ ]` pendiente · `[~]` construida y probada por separado (Bonita simulado; SN simulado con `npm test` o real con `npm run test:sn`, ambos en `web-app/server`), falta la prueba de integración de «Se prueba con» · `[x]` hecha y probada · **Est.** en horas (estimación de
planificación; las horas reales van a la bitácora E5-90).

### Fase 0 — Cimientos compartidos

| ID | Tarea | Est. | Necesita | Se prueba con | Prio | Tomada por |
|---|---|---|---|---|---|---|
| [x] E5-01 | Crear la **base del informe final** en un documento compartido: capítulos, un apartado por componente con plantilla (qué hace, qué rol cumple, cómo se conecta, decisiones y desvíos), bibliografía compartida y convenciones de figuras | 2 | — | — | P1 | Agustín 12/11 |
| [x] E5-02 | Pasar las secciones 4 y 5 de este archivo a `docs/api-contracts.md` (fuente única), incluidos los estados, la whitelist y los tipos de aviso | 1.5 | — | — | P1 | Joaquín 10/11 |
| [x] E5-03 | Pedir al ayudante **confirmación escrita** (mail o plataforma) de que el dashboard va dentro de la web-app | 0.25 | — | — | P1 | Ignacio 10/11 · confirmado: Julian (ayudante de la materia) nos lo confirmó en una consulta virtual por Meet. **Fue verbal: no hay constancia escrita** (mail ni plataforma) |
| [ ] E5-04 | Borrar las 17 ramas remotas ya mergeadas y agregar `cookies.txt` y `bonita-cookies.txt` al `.gitignore` del repo de Bonita | 0.5 | — | — | P3 | |
| [x] E5-05 | Verificar el SN en Render: `GET /health`, login con la cuenta de integración, ONGs demo (`rescatistas-unidos`, `manos-solidarias`) con stock **limitado a propósito**, medir el arranque en frío y confirmar que `/docs` es público | 1.5 | — | — | P1 | Joaquín 10/11 · **probado:** `GET /health` en frío y `/docs/` y `/docs.json` públicos (200 sin token); login de integración y ONGs demo con stock limitado en Render (probado a mano por Joaquín; sin tiempo de arranque en frío anotado) |
| [ ] E5-06 | **`.env` mínimo:** dejar solo los secretos, mover el resto a valores por defecto o `docker-compose`, quitar `SISTEMA_NACIONAL_JWT_SECRET` y `BONITA_NOTIFICATION_TOKEN`, actualizar `.env.example` | 2 | E5-12 | — | P1 | Joaquín 10/11 · hecho: `.env.example` con la clave y las credenciales del SN, sin las variables retiradas; falta decidir qué pasa a valores por defecto de `docker-compose` |

### Fase 1 — Web-app backend

| ID | Tarea | Est. | Necesita | Se prueba con | Prio | Tomada por |
|---|---|---|---|---|---|---|
| [x] E5-10 | Migración: ampliar los `CHECK` de estados de emergencia y oferta; tablas `oferta_validaciones`, `adjudicaciones` (selección y reparto), `oferta_finalizaciones`, historial de estados de emergencia; columna `duracion_convocatoria_min` y campo para el último `409`; ampliar tipos de `notifications` | 4.5 | E5-02 | — | P1 | Joaquín 10/11 |
| [~] E5-11 | `lotes.resource_code`: migración, guardar y devolver `resourceCode` junto a `resourceType` (cliente, server, `shared/lote-validation.js`, contrato); borrar y recargar los lotes viejos | 3 | E5-02 | — | P1 | Joaquín 10/11 · backend probado (`ciclo.integration.js`); falta probar la pantalla de lotes en el navegador |
| [~] E5-12 | Middleware `requireIntegrationKey` y router `/api/internal/*`; migrar los dos endpoints de notificaciones al router con `X-Integration-Key` y retirar el Bearer; definir la variable de la clave | 2.5 | E5-02, E5-10 | E5-32 | P1 | Joaquín 10/11 · clave, 401/503 y avisos probados; falta E5-32 |
| [~] E5-13 | `GET …/consolidado` en formato SN (`severidad`, `recursoCodigo`, `ref` de ONG, solo ofertas no retiradas) | 3 | E5-11, E5-12 | E5-33 | P1 | Joaquín 10/11 · probado con consorcio y **aceptado por el `POST /validaciones` del SN real**; falta E5-33 (Bonita) |
| [~] E5-14 | `PATCH …/estado` con whitelist de transiciones, historial de estados y bloqueo de edición de ofertas al cerrar la convocatoria | 3 | E5-10, E5-12 | E5-33 | P1 | Joaquín 10/11 · whitelist, historial, idempotencia y concurrencia probados; falta E5-33 |
| [~] E5-15 | `POST …/validaciones`: guarda los perfiles, ofertas → `validada`, emergencia → `validada`; maneja el caso de 0 ofertas | 3 | E5-10, E5-12 | E5-34 | P1 | Joaquín 10/11 · probado con 0 ofertas, reintento y **con la respuesta real del SN**; falta E5-34 (Bonita) |
| [~] E5-16 | `GET /api/emergencies/:id/ofertas` (coordinador) y `GET …/ofertas/validadas` (municipio), con perfil y cobertura por lote | 2.5 | E5-15 | — | P1 | Joaquín 10/11 · probado, con perfil y cobertura reales del SN; pasa a `[x]` cuando E5-15 se pruebe con E5-34 |
| [~] E5-17 | `POST /api/emergencies/:id/decision`: continuar / reabrir / reformular con sus efectos, completa "Decidir como Continuar" con `camino`, emite `OFERTA_RETIRADA` en el mismo paso que retira las ofertas | 6 | E5-14, E5-16 | E5-35 | P1 | Joaquín 10/11 · los 3 caminos probados, con compensación si Bonita falla; falta E5-35 |
| [~] E5-18 | Publicar convocatoria con duración: `POST …/convocatoria` acepta `duracionMinutos` (validación compartida con mínimo y máximo), la guarda y la manda como input de "Publicar Convocatoria". Revisar el completado de tareas por nombre con body distinto por tarea | 3 | E5-10 | E5-31 | P1 | Joaquín 10/11 · validación, input a Bonita y reversión probados; falta E5-31 y E5-51 |
| [~] E5-19 | Adjudicación: `POST …/adjudicacion` (guarda la selección, completa "Adjudicar Ofertas", revierte si Bonita falla), `GET …/adjudicacion` interno, `compromiso-confirmado` y `compromiso-fallido` | 7 | E5-12, E5-15 | E5-36 | P1 | Joaquín 10/11 · probado contra el **SN real**: `POST /compromisos` acepta el body, `409` por stock compartido (todo o nada), idempotencia, reparto guardado; falta E5-36 (Bonita) |
| [~] E5-20 | Avisos nuevos: `COMPROMISO` → `ADJUDICADA` / `NO_SELECCIONADA` por ONG, listado por tipos y `PATCH …/leida` | 3.5 | E5-12, E5-19 | E5-37 | P1 | Joaquín 10/11 · ADJUDICADA / NO_SELECCIONADA / OFERTA_RETIRADA probados; falta E5-37 |
| [~] E5-21 | Finalización: `POST /api/ofertas/:id/finalizar` (solo `adjudicada` y de la ONG de la sesión) y `GET …/finalizacion` interno | 3.5 | E5-19 | E5-38 | P1 | Joaquín 10/11 · permisos, idempotencia y estados probados; finalización y cierre del **SN real** liberan el stock; falta E5-38 (Bonita) |
| [~] E5-22 | `POST /api/emergencies/:id/cierre-ejecucion` (solo si todas las adjudicadas están finalizadas; completa "Confirmar cierre de ejecución") | 2 | E5-21 | E5-38 | P1 | Joaquín 10/11 · 409 con pendientes y 502 si Bonita falla probados; falta E5-38 |
| [~] E5-23 | Inventario: cliente del SN con login y token en memoria, `GET` y `PUT /api/inventario` con la ONG tomada de la sesión, errores del SN traducidos (por ejemplo, bajar el total por debajo de lo comprometido) | 6 | E5-02, E5-05 | — | P1 | Joaquín 10/11 · probado contra el **SN real** (local) y contra uno simulado (token vencido, caída): `GET`/`PUT`, `409` al bajar el total, `400` recurso desconocido, `404` ONG no dada de alta; también respuestas raras (HTML 503 al despertar, 403, login rechazado) con recuperación. **Pendiente (decisión de Joaquín):** una sola prueba manual de `GET /api/inventario` contra Render |
| [~] E5-24 | `Dockerfile` de producción del server (`npm start`, `npm ci --omit=dev`); el modo dev sigue en compose | 1 | — | — | P2 | Joaquín 10/11 · arranque en modo producción verificado (`npm ci --omit=dev` + `npm start`); falta un `docker build` real |
| [ ] E5-25 | Reintento del caso de Bonita cuando falló el alta (`bonitaWarning`) | 3 | — | — | P3 | |

### Fase 2 — Bonita (repo de Bonita; una tarea a la vez, ver regla 6)

| ID | Tarea | Est. | Necesita | Se prueba con | Prio | Tomada por |
|---|---|---|---|---|---|---|
| [x] E5-30 | Preparación: parámetros del proceso (5.4), variables nuevas, borrar la tarea huérfana "Cópia de Informar Cierre Y Liberar Cursos", crear el README del repo de Bonita | 3 | E5-02 | — | P1 | Joaquín 10/11 · Agustín 12/11 |
| [x] E5-31 | Timer parametrizable: input `duracionConvocatoria` en el contrato de "Publicar Convocatoria", operación que lo guarda en la variable, y timer que la lee (en minutos) | 2.5 | E5-30 | E5-18, E5-51 | P1 | Agustín 12/11 |
| [x] E5-32 | Conectores de notificaciones de `master` adaptados a la clave de integración y a las URLs por parámetro (`notificarConvocatoria`, `cierreConvocatoria`) | 2 | E5-30 | E5-12 | P1 | Agustín 12/11 |
| [ ] E5-33 | "Notificar Cierre de Convocatoria a ONGS": `PATCH` estado `convocatoria_cerrada` y aviso. "Obtener Ofertas": `GET …/consolidado` guardado en la variable | 3.5 | E5-30 | E5-13, E5-14 | P1 | Pendiente: falta agregar el `PATCH` de estado antes del aviso |
| [ ] E5-34 | "Validar Ofertas": login al SN (`snToken`), `POST /validaciones`, operación que setea `todosLosLotesCubiertos`, `POST …/validaciones` a la web-app. Timeouts de 90 s por el arranque en frío de Render | 5 | E5-33 | E5-15, E5-05 | P1 | |
| [ ] E5-35 | "Decidir como Continuar": contrato con input `camino` (con restricción de valores) y operación que lo copia a `caminoASeguir` | 3 | E5-34 | E5-17 | P1 | |
| [ ] E5-36 | Adjudicación y compromiso: reordenar el flujo (compromiso antes de notificar), "Registrar Compromiso de Recursos de ONGS" (`GET …/adjudicacion`, login SN, `POST /compromisos`), compuerta "¿Compromiso confirmado?", "Registrar Compromiso Confirmado" e "Informar Compromiso Fallido" (vuelve a "Adjudicar Ofertas"). El conector debe tolerar el `409` | 7 | E5-34 | E5-19, E5-05 | P1 | |
| [ ] E5-37 | "Notificar Compromiso a las ONGs" (tipo `COMPROMISO`) y "Etapa Ejecución" (`PATCH` estado `en_ejecucion`) | 2.5 | E5-36 | E5-20 | P1 | |
| [ ] E5-38 | Cierre: reemplazar el ReceiveTask por la tarea humana "Confirmar cierre de ejecución" (lane Centro Coordinador); "Informar Cierre" (`GET …/finalizacion` y `POST` finalización al SN); "Liberar recursos" (`POST` cierre al SN y `PATCH` estado `finalizada`) | 5 | E5-37 | E5-21, E5-22 | P1 | |
| [ ] E5-39 | Verificar en Studio que REABRIR vuelve a "Publicar Convocatoria" (reinicia el timer) y REFORMULAR a "Generar Lotes de Necesidades"; documentar que "Cargar ofertas" se cierra solo por tiempo | 2 | E5-31, E5-35 | E5-17 | P1 | |
| [ ] E5-40 | Exportar el `.bos` / `.proc` final al repo de Bonita, completar su README y confirmar que no quedan URLs a `localhost` ni conectores placeholder | 1.5 | E5-38, E5-39 | — | P1 | |

### Fase 3 — Web-app frontend (todas responsive)

| ID | Tarea | Est. | Necesita | Se prueba con | Prio | Tomada por |
|---|---|---|---|---|---|---|
| [~] E5-50 | Estados nuevos en `EmergenciesListPage` y `ProgressTracker`, rutas y permisos por rol (incluida la ruta del Auditor) | 3 | E5-02 | — | P1 | Joaquín 10/11 · hecho: los 7 estados con etiqueta, filtro y *stepper* por tarjeta (`emergency-status.js`, `StatusBadge`, `EmergencyStatusStepper`); `RequireRole` y rutas por rol, con `/dashboard` (Auditor, página reservada) e `/inventario` (ONG) y enlaces en el menú; ayuda por rol cuando no hay acción. Probado en navegador (modo mock, 23 comprobaciones por rol y redirecciones). El `ProgressTracker` del formulario no cambió. **Falta:** los botones y rutas de E5-52, E5-53, E5-55 y E5-57 se agregan con cada pantalla; ver el flujo real con Bonita (E5-70) |
| [~] E5-51 | Coordinador: elegir la duración de la ventana al publicar la convocatoria (sugerido, mínimo y máximo visibles) | 2.5 | E5-02 | E5-18 | P1 | Joaquín 10/11 · hecho: campo de duración en el modal de publicar (`DuracionConvocatoriaField`, sugerido 120 min, mín. 1, máx. 10080, atajos incl. 2 min demo), misma validación compartida; manda `{duracionMinutos}`. Probado en navegador con API simulada. Pendiente: corrida real con Bonita (E5-70). |
| [~] E5-52 | Coordinador: ver las ofertas con su perfil y la cobertura por lote, y elegir continuar / reabrir / reformular (con duración al reabrir) | 7 | E5-50 | E5-16, E5-17 | P1 | Joaquín 10/11 · hecho: `/emergencias/:id/ofertas` (coordinador) con perfil de cada oferta, habilitado por lote, cobertura y decisión continuar/reabrir (con duración)/reformular (con confirmación); errores 502 visibles. Sin modo mock (necesita backend real). Probado en navegador con API simulada. Pendiente: corrida real (E5-70). |
| [~] E5-53 | Municipio: pantalla de adjudicación (solo ofertas validadas, con perfil de competencia y riesgo, selección y confirmación). Si el SN rechazó, muestra qué oferta y qué recurso fallaron | 6 | E5-50 | E5-16, E5-19 | P1 | Joaquín 10/11 · hecho: `/emergencias/:id/adjudicacion` (municipio) con ofertas validadas, cobertura en vivo según lo habilitado por el SN, doble confirmación, aviso del último rechazo del SN (oferta, recurso, faltante, disponible por ONG) y bloqueo hasta que cambie el estado o haya un rechazo nuevo. Sin modo mock. Probado en navegador con API simulada. Pendiente: corrida real (E5-70). |
| [~] E5-54 | ONG: bandeja ampliada con todos los tipos de aviso, marcar como leída y contador | 3.5 | E5-02 | E5-20 | P1 | Joaquín 10/11 · hecho: campana con contador de no leídas, panel con los 5 tipos de aviso, leer al abrir y llevar a su pantalla, "marcar todos como leídos", sondeo cada 30 s. Probado en navegador con API simulada. Pendiente: corrida real (E5-70). |
| [~] E5-55 | ONG: "Mis ofertas" con las adjudicadas y el botón "Marcar actividad como finalizada" | 3.5 | E5-50 | E5-21 | P1 | Joaquín 10/11 · hecho: `/mis-ofertas` (ONG) con emergencias adjudicada/en ejecución/finalizada, resultado de cada oferta propia y "Marcar actividad como finalizada" con confirmación, solo en ejecución. Sin modo mock. Probado en navegador con API simulada. Pendiente: corrida real (E5-70). |
| [~] E5-56 | ONG: "Mi inventario" (total, comprometido y disponible por recurso; alta y edición) | 5 | E5-02 | E5-23 | P1 | Joaquín 10/11 · hecho: `/inventario` (`InventarioPage`, `inventario-service.js`): catálogo de lotes por categoría, total editable, comprometido y disponible del SN, solo manda los renglones cambiados, validación compartida, muestra el `409` con el recurso que falló y el `502`. Probado en navegador en modo mock y con respuestas simuladas del backend (409, 502, reintento, éxito). **Falta** la prueba manual contra Render (E5-23), sobre todo el arranque en frío |
| [~] E5-57 | Coordinador: "Confirmar cierre de ejecución", con el estado de cada ONG (finalizada o pendiente), habilitado cuando todas terminaron | 3 | E5-50 | E5-22 | P1 | Joaquín 10/11 · hecho: panel de ejecución en `/emergencias/:id/ofertas` con estado por oferta (finalizada/pendiente), "Confirmar cierre" habilitado solo con todas finalizadas y lista de ONGs pendientes ante un 409. Sin modo mock. Probado en navegador con API simulada. Pendiente: corrida real (E5-70). |

### Fase 4 — Dashboard (módulo de la web-app, rol Auditor)

| ID | Tarea | Est. | Necesita | Se prueba con | Prio | Tomada por |
|---|---|---|---|---|---|---|
| [ ] E5-60 | Verificar que existe un usuario Auditor en la organización de Bonita (crearlo si falta) y que puede leer por la API REST las tareas cerradas de los casos; prueba mínima de una consulta de tiempos | 2 | E5-02 | — | P1 | Ignacio 10/11 |
| [~] E5-61 | Backend del dashboard con datos propios (5.5): `/api/dashboard/indicadores` | 4.5 | E5-10 | E5-19, E5-21 | P1 | Ignacio 10/11 · hecho: `GET /api/dashboard/indicadores` (auditor; suministros por mes de adjudicación y recurso, % consorcios, estado de proyectos, cobertura promedio de lotes), solo datos propios de Postgres, contrato documentado. El mes sale de `adjudicaciones.created_at` (fecha de selección del municipio, no de confirmación del SN). **Probado:** `tests/dashboard.integration.js` (Postgres real: permisos, vacío, ofertas que no cuentan, tope de cobertura, mes estable al tocar `updated_at`) y `npm test` completo; a mano con el servidor real (login con el usuario Dirección, rol auditor) y respuesta igual al contrato; consultas SQL revisadas (sin duplicación de filas, consorcios por oferta, `reparto` no altera cantidades). Para la prueba manual hubo que correr `migrate:up` en la base de desarrollo. **Falta:** probarla con E5-19 y E5-21 integradas con Bonita (ciclo real, E5-70 y E5-75) y que la consuma E5-63 |
| [ ] E5-62 | Backend del dashboard con datos de Bonita: `/api/dashboard/tiempos-etapas` (promedio por etapa) con la sesión del Auditor | 5 | E5-60 | E5-75 | P1 | |
| [ ] E5-63 | Frontend del dashboard: página del Auditor/Directivo con indicadores, gráficos interactivos y filtros. Reemplazar el `dashboard/` vacío por un README que explique que es un módulo | 6 | E5-50, E5-61 | E5-62 | P1 | |
| [ ] E5-64 | Exportación de datos estructurados (CSV y JSON) desde el dashboard | 2 | E5-61 | — | P1 | |

### Fase 5 — Pruebas e integración

| ID | Tarea | Est. | Necesita | Se prueba con | Prio | Tomada por |
|---|---|---|---|---|---|---|
| [ ] E5-70 | **Prueba end-to-end del ciclo feliz** con el SN en Render: alta → lotes → convocatoria (timer corto) → ofertas (parcial y consorcio) → vence → validación → adjudicación → compromiso → ejecución → finalización → cierre. Verificar el stock del SN antes y después | 4 | E5-22, E5-40, E5-52, E5-53, E5-55, E5-57 | — | P1 | |
| [ ] E5-71 | Caminos alternativos: sin cobertura total → continuar, reabrir y reformular **con ofertas ya cargadas**; caso borde de 0 ofertas | 4 | E5-70 | — | P1 | |
| [ ] E5-72 | Camino de error: provocar el `409` en el compromiso (ONG con stock comprometido en otra emergencia) y comprobar el retorno a "Adjudicar Ofertas" y la ausencia de avisos | 2 | E5-70 | — | P1 | |
| [ ] E5-73 | Prueba de concurrencia contra Render (dos adjudicaciones en paralelo sobre el mismo stock): nunca sobre-asigna | 2 | E5-05 | — | P2 | |
| [ ] E5-74 | Permisos por rol: los 4 perfiles ven solo sus pantallas; `401` sin sesión y `403` con rol equivocado en cada endpoint nuevo | 2 | E5-52, E5-53, E5-55, E5-56, E5-57, E5-63 | — | P1 | |
| [ ] E5-75 | Datos de demo: correr varios casos completos (con ventanas de 2 minutos) para que el dashboard tenga contenido, y escribir el guion de demo | 2.5 | E5-70 | — | P2 | |

### Fase 6 — Documentación, informe y entrega

| ID | Tarea | Est. | Necesita | Se prueba con | Prio | Tomada por |
|---|---|---|---|---|---|---|
| [ ] E5-80 | Informe: arquitectura general, diagrama de componentes y flujo de integración orquestada | 3 | E5-01, E5-02 | — | P1 | |
| [ ] E5-81 | Informe: apartado del Sistema Nacional (rol, endpoints, locking, despliegue) | 2 | E5-01, E5-05 | — | P1 | |
| [ ] E5-82 | Informe: apartado de Bonita (proceso, timer, caminos alternativos, conectores, parámetros) | 2 | E5-01, E5-40 | — | P1 | |
| [ ] E5-83 | Informe: apartado del backend de la web-app (API, estados, integración, inventario como excepción justificada) | 2 | E5-01, E5-22, E5-23 | — | P1 | |
| [ ] E5-84 | Informe: apartado del frontend (pantallas por rol, RBAC, responsive) | 1.5 | E5-01, E5-57 | — | P1 | |
| [ ] E5-85 | Informe: apartado del dashboard | 1.5 | E5-01, E5-63, E5-64 | — | P1 | |
| [ ] E5-86 | Informe: modelo de proceso de la Entrega 1 vs. el final, con los desvíos justificados (por ejemplo, compromiso antes de notificar) | 3 | E5-01, E5-40 | — | P1 | |
| [ ] E5-87 | Informe: matriz de cumplimiento (cada requisito del enunciado → dónde se cumple y cómo se verificó) | 3 | E5-01, E5-70 | — | P1 | |
| [ ] E5-88 | Informe: gestión del proyecto (Gantt, desvíos, cómo se usó IA) | 2 | E5-01, E5-90 | — | P1 | |
| [ ] E5-89 | Informe: bibliografía con citas rigurosas | 2 | E5-01 | — | P1 | |
| [ ] E5-90 | **Gantt final** (completar las filas de la Entrega 5 con horas reales, desvíos y tareas no planificadas) a partir de la bitácora | 2 | E5-75 | — | P1 | |
| [ ] E5-91 | `README.md` raíz, `CLAUDE.md` (el SN deja de ser "no se codea"), README del SN y del repo de Bonita, `.env.example` final | 3 | E5-06, E5-40 | — | P1 | |
| [ ] E5-92 | Revisión final del informe: coherencia, figuras, referencias y exportación a PDF | 3 | E5-80, E5-81, E5-82, E5-83, E5-84, E5-85, E5-86, E5-87, E5-88, E5-89 | — | P1 | |
| [ ] E5-93 | Paquete de entrega: PDF del informe, `.bos`, URLs del SN y de Swagger, URLs de repos, Dockerfile, Gantt | 1.5 | E5-92, E5-40, E5-91 | — | P1 | |
| [ ] E5-94 | Preparación del coloquio del 26/11: guion, ensayo y preguntas probables (después de la entrega) | 3 | E5-93 | — | P2 | |

### Correspondencia con el Gantt de la Entrega 4

| Fila del Gantt | Tareas de este roadmap |
|---|---|
| 5.1 Bonita → web-app (consolidado) | E5-12, E5-13, E5-33 |
| 5.2 Bonita → Sistema Nacional | E5-34, E5-36, E5-38 |
| 5.3 Camino alternativo | E5-17, E5-35, E5-39, E5-52 |
| 5.4 Adjudicación y notificación | E5-19, E5-20, E5-36, E5-37, E5-53 |
| 5.5 Perfil ONG | E5-21, E5-23, E5-54, E5-55, E5-56 |
| 5.6 Cierre y Auditor | E5-22, E5-38, E5-57, E5-60 |
| 5.7 y 5.8 Dashboard | E5-61, E5-62, E5-63, E5-64 |
| 5.9 Pruebas | E5-70 a E5-75 |
| 5.10 Gantt | E5-90 |
| **No planificadas** | E5-01 y E5-80 a E5-94 (informe), E5-10, E5-11, E5-14, E5-15, E5-18, E5-30 a E5-32, E5-50, E5-51, E5-06, E5-24, E5-25 |

---

## 8. Dependencias y calendario

```
E5-02 ──► E5-10 ──► E5-12 ──► E5-13/14/15 ──► E5-16 ──► E5-17
  │          │         └──────────────────────────► E5-19 ──► E5-20, E5-21 ──► E5-22
  │          └─► E5-11 ─► E5-13                      │
  ├──► E5-30 ──► E5-33 ──► E5-34 ──► E5-35 ─► E5-39 ─┐
  │      └─► E5-31, E5-32           └──► E5-36 ─► E5-37 ─► E5-38 ─► E5-40 ──► E5-70
  ├──► E5-50 ──► E5-52, E5-53, E5-55, E5-57                              │
  ├──► E5-23 (con E5-05) ─► E5-56                      E5-71, 72, 75 ◄───┘
  └──► E5-60 ──► E5-62          E5-61 ──► E5-63, E5-64
E5-01 ──► E5-80 … E5-89 ──► E5-92 ──► E5-93
```

**Camino crítico (calculado sobre las dependencias, ~47 h):** E5-02 → E5-30 →
E5-33 → E5-34 → E5-36 → E5-37 → E5-38 → E5-40 → E5-70 → E5-75 → E5-90 → E5-88 →
E5-92 → E5-93 → E5-94. Dentro de Bonita, las tareas se hacen **una a la vez**,
así que la cadena E5-30 … E5-40 es el tope del calendario. Conviene empezarla ya
y que el backend (E5-10 …) le vaya abriendo el camino.

**Hitos:**

| Fecha | Hito |
|---|---|
| Vie 06/11 | Fase 0 completa; migración (E5-10) y router interno (E5-12) listos; Bonita con parámetros, timer y notificaciones (E5-30 a E5-32) |
| Vie 13/11 | Todo construido; el ciclo feliz corre de punta a punta (E5-70); borrador de cada apartado del informe |
| Lun 16/11 | **Congelamiento de funcionalidades.** Borrador completo del informe |
| 17 y 18/11 | Caminos alternativos, errores, permisos, revisión del informe, Gantt final |
| **Jue 19/11** | **Entrega** (E5-93) |

---

## 9. Definición de "hecho"

- [ ] Proceso en Bonita (≥ 7.9; hoy 10.4) con timer parametrizado y camino alternativo, y **todos** los conectores reales, sin `localhost` ni placeholders.
- [ ] Bonita inicia la consulta de ofertas, la validación, el compromiso, las notificaciones, los cambios de estado, la finalización y la liberación.
- [ ] Web-app responsive con 4 perfiles y permisos propios (municipal, coordinador, ONG, auditor), validados en el backend.
- [ ] Representante de ONG: inventario, avisos de adjudicación, ofertas parciales y consorcios, marcar actividades finalizadas.
- [ ] Ofertas con versiones editables dentro de la ventana y trazabilidad.
- [ ] Sistema Nacional público en Render (JWT, Swagger, Dockerfile), con locking probado.
- [ ] El compromiso rechazado (`409`) vuelve a "Adjudicar Ofertas" sin avisar a las ONGs.
- [ ] Dashboard: datos propios + tiempos por etapa de Bonita, gráficos interactivos y exportación.
- [ ] Prueba del ciclo completo y de los tres caminos alternativos.
- [ ] Informe final con arquitectura, cada componente, matriz de cumplimiento y bibliografía.
- [ ] Gantt final con desvíos y bitácora de horas.
- [ ] Documentación al día (`CLAUDE.md`, READMEs, `docs/`, `.env.example`).

**Fuera de alcance:** email, certificaciones, sincronización automática de
stock entre el SN y la app local, escalado a varias réplicas del SN.

---

## 10. Riesgos

- **Tiempo:** el camino crítico pasa por Bonita, que se edita de a una tarea. Empezar la cadena el primer día y no dejar la escritura del informe para el final.
- **Arranque en frío de Render:** la primera llamada puede tardar ~1 minuto. Timeouts de 90 s en los conectores y, si hace falta, un `GET /health` previo.
- **Token del SN:** dura 1 hora. Hacer login justo antes de cada llamada.
- **Detección del `409` en Bonita:** un conector REST puede tratar los errores HTTP como falla. Verificar en la documentación oficial cómo continuar y leer el cuerpo de la respuesta (E5-36).
- **Tamaño del `consolidado`:** si el tipo Text de Bonita no alcanza, hay que pedirlo de nuevo en lugar de guardarlo.
- **Nombres exactos de tareas:** renombrar una rompe la integración. Avisar antes.
- **Compuertas con default silencioso:** hoy "NO" y "REFORMULAR" son default. La web-app valida `camino` y el contrato de Bonita restringe los valores (E5-35).
- **Permisos del Auditor en Bonita:** si no puede leer tareas cerradas, el dashboard pierde su mitad (E5-60 es lo primero a probar).
- **Cada integrante tiene su Bonita local:** URLs y claves van por parámetros del proceso, no hardcodeadas.
- **Lotes viejos sin `resource_code`:** borrarlos o recargarlos antes de probar la integración.
- **Secretos:** `.env` y cookies fuera de git. El secreto JWT vive solo en el SN.
- **Inventario como excepción:** hay que justificarla en el informe (E5-83) para que no parezca una violación de la directiva de orquestación.
