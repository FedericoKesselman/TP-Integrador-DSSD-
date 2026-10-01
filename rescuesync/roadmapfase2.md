# Roadmap — Etapa 2 (RescueSync)

> Guía de implementación para la Entrega 2. Define el orden de trabajo; el
> reparto de tareas entre los 5 integrantes se decide aparte usando este
> documento como base.

## Alcance de la Entrega 2 (según el enunciado)

- Formulario web de alta de una emergencia y publicación de lotes por parte
  del municipio/coordinador.
- Implementación del formulario básico de carga de ofertas para las ONGs.
- Integración inicial con la API de Bonita para iniciar la instancia y
  setear variables de proceso.
- Validación del grooming estimado en la Entrega 1 y planificación de la
  siguiente etapa.

## Autenticación — aclaración del profesor (importante)

Los usuarios deben estar definidos en la **organización de Bonita**, no en
una tabla propia de la aplicación. Cualquier acción que requiera
autenticación o verificación de permisos en la app local debe apoyarse en
el **login service que provee el motor de Bonita**
(`POST /bonita/loginservice`). Por lo tanto:

- **No** se arma un sistema de login propio con usuarios/contraseñas ni una
  tabla de roles en Postgres.
- Una tabla de usuarios en la base local solo tendría sentido para
  **extender información** (ej. a qué ONG pertenece, teléfono), nunca para
  manejar credenciales o el rol en sí — eso lo resuelve Bonita.
- Para la Entrega 2, la autenticación puede quedar implementada **solo para
  lo solicitado**: iniciar y completar tareas en Bonita. No hace falta un
  RBAC visual completo todavía.
- El JWT del **Sistema Nacional** (Entrega 3) es un sistema aparte, sin
  relación con este login de usuarios de la app.

## Fase 0 — Cimientos técnicos compartidos ✅ Implementada

*Bloquea todo lo demás. Conviene resolverla en conjunto o entre 1-2 personas
antes de repartir el resto del roadmap, para que nadie construya sobre una
base que después cambia.*

1. [x] Elegir herramienta de migraciones para Postgres (ej. `node-pg-migrate` o
   Knex) e instalarla en `web-app/server`.
2. [x] Diseñar el esquema mínimo de tablas: `emergencies`, `lotes`, `ofertas`.
   **Sin tabla de usuarios/roles propia** — si hace falta guardar algo
   extra de un usuario (ONG a la que pertenece, teléfono, etc.), se agrega
   después como extensión referenciando el id de usuario de Bonita, no
   antes.
3. [x] Agregar React Router al cliente (`web-app/client`) y armar el esqueleto
   de rutas (todavía sin protección por rol propia, ya que el rol lo
   resuelve Bonita).
4. [x] Extraer a una carpeta compartida (`web-app/shared/`) las reglas de
   validación que hoy solo viven en el cliente
   (`client/src/features/emergencies/validate-emergency.js`), para que el
   server las reutilice en vez de reescribirlas.
5. [x] Ampliar `docs/api-contracts.md` con las formas de datos de lotes,
   ofertas y el endpoint que Bonita va a consultar (dejarlo escrito antes
   de programar, para que no se inventen formatos distintos entre
   integrantes).

## Fase 1 — Organización de Bonita e integración mínima de login ✅ Implementada

6. [x] Definir en la organización de Bonita los usuarios, roles y grupos
   necesarios para la Etapa 2 (Operador Municipal, Centro Coordinador,
   ONG — como mínimo los que participan del flujo de esta entrega).
7. [x] Desde `web-app/server`, implementar la llamada al login service de
   Bonita (`POST /bonita/loginservice`) para autenticar al usuario y
   obtener la sesión/cookie que Bonita necesita para las siguientes
   llamadas a su API.
8. [x] Definir cómo esa sesión de Bonita se propaga o se representa hacia el
   cliente (por ejemplo, guardándola server-side y exponiendo al cliente
   solo lo mínimo necesario para saber que está logueado).
9. [x] Pantalla de login mínima en el cliente — alcanza con lo necesario para
   autenticar contra Bonita, sin RBAC visual complejo todavía.

**Cómo quedó:**
- Organización RescueSync en Bonita (en el repo de Bonita): roles
  `operador_municipal`, `coordinador_regional`, `representante_ong`,
  `auditor`, `sistema_nacional`; grupos por entidad (municipios, centro
  coordinador, ONGs, dirección). Actores del proceso mapeados a los roles.
- Server: `bonita/bonita-client.js` (login/logout contra Bonita) y
  `routes/auth-routes.js` (`/api/auth/login`, `/me`, `/logout`). La sesión
  de Bonita se guarda server-side con `express-session`; el cliente solo
  recibe la cookie `connect.sid`.
- Cliente: `LoginPage`, rutas protegidas en `App.jsx` (sin sesión todo
  redirige a `/login`), usuario y botón "Salir" (con confirmación) en el
  `Header`.
- Contratos en `docs/api-contracts.md`; cómo levantarlo en el `README.md`.
- Pendiente para más adelante: el rol del usuario (membresías de Bonita)
  todavía no se consulta; hará falta para el RBAC de las próximas entregas.

## Fase 2 — Emergencias: conectar lo ya construido ✅ Implementada

*El formulario de alta ya existe en el cliente (`EmergencyFormPage.jsx` y
componentes asociados); falta el otro lado.*

10. [x] Implementar `POST /api/emergencies` en `web-app/server` (persistencia
    en Postgres + validación server-side reutilizando lo de la Fase 0).
11. [x] Apagar el modo mock (`VITE_USE_MOCK_API=false` en `client/.env`) y
    probar el flujo real end-to-end.
12. [x] Endpoint de listado (`GET /api/emergencies`) para que el Centro
    Coordinador pueda verlas — necesario para la Fase 3.

**Cómo quedó:**
- Server: `emergencies/emergencies-repository.js` (única capa que sabe de
  SQL para `emergencies`, con el mapeo camelCase ↔ snake_case) y
  `routes/emergency-routes.js` (`POST /api/emergencies`, `GET
  /api/emergencies`), montado en `index.js`. El `POST` reutiliza
  `validateEmergencyPayload` de `web-app/shared/` (Fase 0) para revalidar
  server-side lo que el cliente ya validó.
- Cliente: `client/.env` con `VITE_USE_MOCK_API=false` — el formulario ya
  pega contra el backend real (`emergency-service.js` no necesitó cambios,
  ya estaba preparado para ambos modos).
- Contrato: se agregó `GET /api/emergencies` a `docs/api-contracts.md`
  (el `POST` ya estaba documentado desde la Fase 0).
- Probado end-to-end: alta desde el formulario real (con sesión de Bonita
  vía `OperadorM`), fila verificada en Postgres, `GET /api/emergencies`
  devolviendo el listado, y `POST` con payload incompleto devolviendo
  `400` con los `errors` esperados.
- **Dos bugs de infraestructura (no del código de esta fase) aparecieron
  recién ahora, porque eran la primera vez que el server dentro de Docker
  ejecutaba código que toca `web-app/shared/` y la base real:**
  1. `web-app/shared/` nunca estaba disponible dentro del contenedor del
     server (el `Dockerfile` solo copiaba `./server`, y el
     `docker-compose.yml` solo montaba `./server:/app`), así que
     `validate-emergency.js` no podía resolver
     `../../shared/emergency-validation.js` y el server no arrancaba
     (`ERR_MODULE_NOT_FOUND`). Se arregló de raíz: el build context de
     `server` pasó a ser `web-app/` (no `web-app/server/`) y el
     `Dockerfile` ahora copia `server/` y `shared/` explícitamente dentro
     de la imagen (`COPY shared/ /shared/`), en vez de depender de un
     volumen de desarrollo. Verificado buildeando la imagen y corriéndola
     **sin ningún volumen montado** (`docker run --rm <imagen> node -e
     "console.log(require('fs').existsSync('/shared/emergency-validation.js'))"`
     → `true`). El bind mount `./shared:/shared:ro` se mantiene solo para
     hot-reload en desarrollo (ver comentarios en `docker-compose.yml` y
     `server/Dockerfile`), ya no para que la imagen funcione.
  2. `DATABASE_URL` (heredada de `server/.env`) apuntaba a `localhost`,
     que dentro del contenedor del server es el propio contenedor, no el
     de Postgres — el `POST` fallaba siempre con `ECONNREFUSED
     127.0.0.1:5432`. Arreglado agregando una pisada de `DATABASE_URL` en
     el servicio `server` del `docker-compose.yml` apuntando a
     `postgres:5432` (nombre del servicio en la red de Compose), mismo
     patrón que ya se usaba para `BONITA_API_URL` con
     `host.docker.internal`.
  Ambos bugs eran latentes desde la Fase 0 (nadie había levantado un
  endpoint real que tocara `shared/` + Postgres desde dentro de Docker
  hasta esta fase) y quedan resueltos en `web-app/docker-compose.yml`
  para todo el equipo.
- `bonitaCaseId` quedaba `null` a propósito en esta fase — resuelto en la
  Fase 5.

## Fase 3 — Lotes (Centro Coordinador Regional) ✅ Implementada

13. [x] Diseñar y documentar el modelo de "lote" (tipo de recurso, cantidad,
    emergencia asociada).
14. [x] Endpoints para crear y listar lotes de una emergencia, y publicar la
    convocatoria. El cierre queda a cargo del temporizador de Bonita en la
    Fase 5, como define `docs/api-contracts.md`.
15. [x] Pantalla del Centro Coordinador: ver emergencia registrada →
    desglosarla en lotes → publicar convocatoria.

**Cómo quedó:**
- Modelo `lotes` relacionado con `emergencies`, creado por la migración del
  esquema. El contrato y las transiciones de estado están documentados en
  `docs/api-contracts.md`; las reglas de entrada viven en
  `web-app/shared/lote-validation.js` y se reutilizan en el server.
- Server: `lotes/lotes-repository.js` guarda o reemplaza el desglose dentro
  de una transacción, lista los lotes y publica la convocatoria. Las rutas
  están expuestas desde `routes/emergency-routes.js` como `POST/GET
  /api/emergencies/:emergencyId/lotes` y `POST
  /api/emergencies/:emergencyId/convocatoria`.
- Reglas del flujo: se exige al menos un lote para publicar; una convocatoria
  solo se puede abrir desde el estado `registrada`; después de publicarla,
  sus lotes quedan bloqueados y un intento de modificarlos devuelve `409`.
- Seguridad: todos los endpoints de emergencias requieren sesión. El alta
  corresponde al Operador Municipal y la gestión/publicación de lotes al
  Centro Coordinador Regional. El frontend replica estas restricciones para
  ocultar acciones y redirigir rutas, pero el control definitivo queda en el
  backend.
- Cliente: `EmergenciesListPage` muestra la bandeja, filtros, métricas y el
  estado de cada emergencia. `EmergencyLotesPage` permite seleccionar
  recursos, cantidades y notas, guardar el borrador, recuperarlo y publicar
  la convocatoria. El cálculo humanitario sugerido queda detrás de sus flags
  de entorno y no altera el flujo básico.
- Completar la tarea humana quedó resuelto en la Fase 5: al publicar la
  convocatoria se completan las tareas del coordinador en Bonita. Sigue
  pendiente ejecutar el temporizador de Bonita y pasar de
  `convocatoria_abierta` a `convocatoria_cerrada`.

**Verificación de cierre:**
- [x] Login real contra Bonita con `OperadorM` y `CoordinadorR`.
- [x] Alta real de emergencia y persistencia en PostgreSQL.
- [x] Guardado y recuperación de múltiples lotes.
- [x] Publicación con cambio de estado a `convocatoria_abierta`.
- [x] Rechazo `401` sin sesión y `403` con un rol no autorizado.
- [x] Rechazo `409` al intentar modificar lotes ya publicados.
- [x] `npm run lint` sin errores en cliente y server.
- [x] `npm run build` del cliente completado correctamente.

## Fase 4 — Ofertas (ONGs) ✅ Implementada

16. [x] Diseñar y documentar el modelo de "oferta" (recursos, personal,
    lote(s) que cubre, si es parcial, si es en consorcio).
17. [x] Endpoints: crear oferta, editar/actualizar oferta dentro de la ventana
    de tiempo, listar ofertas propias y consultar su historial de versiones.
18. [x] Formulario básico de carga de ofertas en el cliente para el rol ONG
    (alcance mínimo que pide la Entrega 2; consorcios complejos pueden
    quedar simplificados para esta etapa).

**Backend implementado (puntos 16 y 17):**
- El usuario se autentica en Bonita y su `ongRef` se vincula con la entidad
  local `ongs`; las credenciales no se duplican en PostgreSQL.
- Una oferta puede cubrir parcialmente uno o varios lotes. `oferta_ongs`
  conserva el soporte para consorcios, aunque la UI mínima cargará inicialmente
  a la ONG de la sesión como principal.
- La creación y edición se hacen en transacciones y solo durante
  `convocatoria_abierta`. La edición exige pertenecer a la oferta y guarda el
  estado anterior en `oferta_historial` con versión incremental y usuario de
  Bonita.
- Endpoints implementados: `POST /api/emergencies/:emergencyId/ofertas`,
  `GET /api/emergencies/:emergencyId/ofertas/mine`, `PUT /api/ofertas/:id` y
  `GET /api/ofertas/:id/historial`.
- Cliente: las convocatorias abiertas muestran al representante de ONG el
  acceso a `/emergencias/:id/oferta`. El formulario recupera los lotes, permite
  seleccionar cuáles cubrir, cargar cantidades y notas, crear la oferta o
  editar la última oferta propia, y muestra las versiones anteriores.

**Verificación de cierre:**
- [x] Alta real de una oferta asociada a la ONG de la sesión.
- [x] Listado de ofertas propias y recuperación para edición.
- [x] Edición con snapshot anterior en `oferta_historial`.
- [x] Rechazo `401` sin sesión y `403` cuando otra ONG intenta editarla.
- [x] Ruta protegida para `representante_ong`; la acción de carga aparece en
  convocatorias abiertas y una convocatoria cerrada queda en modo consulta.
- [x] `npm run lint` y `npm run build` del cliente sin errores.

## Fase 5 — Integración con Bonita: iniciar y completar tareas ✅ Implementada

19. [x] Modelar (aunque sea preliminar) el proceso en Bonita si todavía no está
    desde la Entrega 1, o retomar el ya entregado.
20. [x] Al registrarse una emergencia (endpoint de la Fase 2), llamar a la API
    de Bonita para **iniciar la instancia del proceso**, seteando las
    variables de proceso iniciales, usando la sesión obtenida en la
    Fase 1.
21. [x] Guardar el `bonitaCaseId` devuelto en la tabla `emergencies` y
    mostrarlo en la confirmación (el campo ya existe en el frontend, solo
    falta que deje de ser `null`).
22. [x] Implementar la llamada para **completar tareas humanas** en Bonita
    desde la app (por ejemplo, cuando el Coordinador publica la
    convocatoria de lotes), usando el login service para autenticar esa
    acción.

**Cómo quedó:**
- Server: `bonita/bonita-client.js` suma `getProcessId` (busca el id del
  proceso por nombre entre los procesos desplegados y activos; con varias
  versiones toma la desplegada más recientemente) y `startCase`, que inicia
  el caso con la sesión de Bonita del usuario logueado. El nombre del
  proceso sale de `BONITA_PROCESS_NAME` (default `Gestionar Emergencia`);
  no hay ningún id en el `.env`, así que redesplegar en Bonita Studio no
  requiere tocar nada.
  Además suma `completeTask` (busca la tarea pendiente del caso por nombre,
  la toma para el usuario de la sesión y la completa con body `{}`, porque
  las tareas humanas del diagrama tienen contrato vacío) y
  `completePendingTasks` (recorre nombres en orden y salta las que no estén
  pendientes; reintenta hasta 3 veces con 300 ms cuando la tarea todavía no
  apareció).
- `POST /api/emergencies` inicia el caso después de guardar la emergencia y
  guarda el `bonitaCaseId` en la fila. Si Bonita falla, la emergencia queda
  guardada igual y la respuesta trae `bonitaWarning` (con `bonitaCaseId`
  en `null`). El cliente muestra `Caso N` en la confirmación, o el aviso.
- Después de iniciar el caso, el mismo `POST` completa la tarea "Registrar
  Emergencia"; espera hasta unos 900 ms a que Bonita la deje lista. Si
  falla, la emergencia queda guardada con su `bonitaCaseId` y la respuesta
  trae `bonitaWarning`.
- `POST /api/emergencies/:emergencyId/convocatoria` completa las tareas del
  coordinador que estén pendientes, en orden: "Revisar Emergencia",
  "Generar Lotes de Necesidades" y "Publicar Convocatoria". Publicar en la
  web y completar "Publicar Convocatoria" (que arranca el reloj de la
  convocatoria) van juntos: si Bonita no avanza, se revierte la publicación
  (la emergencia vuelve a `registrada`) y responde `502`.
- Los nombres de las tareas tienen que coincidir exactamente con los del
  diagrama de Bonita.
- En Bonita (repo aparte): el contrato de inicio del proceso tiene el input
  `emergencyID`, mapeado a la variable `emergenciaId`. El nombre del input
  tiene que coincidir exactamente con lo que manda el server (distingue
  mayúsculas): `emergencyID`.
- Pendiente: reintento del caso cuando falló el alta; soporte web para los
  regresos REFORMULAR y REABRIR del diagrama; los dos conectores REST del
  diagrama apuntan a URLs que no existen.

## Fase 6 — Cierre de etapa

23. Pruebas de integración del flujo completo: alta de emergencia →
    login/sesión Bonita → inicio de instancia → lotes → ofertas →
    completar tarea.
24. Revisión de grooming: comparar lo estimado en la Entrega 1 contra lo
    efectivamente hecho.
25. Documentar en `docs/` lo implementado (incluyendo cómo quedó la
    integración con el login service de Bonita) y planificar el grooming
    de la Entrega 3 (API del Sistema Nacional).
