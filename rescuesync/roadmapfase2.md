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
  1. `web-app/shared/` nunca estaba montada en el contenedor del server
     (el `docker-compose.yml` solo montaba `./server:/app`), así que
     `validate-emergency.js` no podía resolver
     `../../shared/emergency-validation.js` y el server no arrancaba
     (`ERR_MODULE_NOT_FOUND`). Arreglado agregando el volumen
     `./shared:/shared:ro`.
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
- Pendiente para más adelante: `bonitaCaseId` queda `null` a propósito —
  se completa en la Fase 5.

## Fase 3 — Lotes (Centro Coordinador Regional)

13. Diseñar y documentar el modelo de "lote" (tipo de recurso, cantidad,
    emergencia asociada).
14. Endpoints: crear lote(s) para una emergencia, listar lotes de una
    emergencia, publicar/cerrar convocatoria.
15. Pantalla del Centro Coordinador: ver emergencia registrada →
    desglosarla en lotes → publicar convocatoria.

## Fase 4 — Ofertas (ONGs)

16. Diseñar y documentar el modelo de "oferta" (recursos, personal,
    lote(s) que cubre, si es parcial, si es en consorcio).
17. Endpoints: crear oferta, editar/actualizar oferta dentro de la ventana
    de tiempo, listar ofertas propias.
18. Formulario básico de carga de ofertas en el cliente para el rol ONG
    (alcance mínimo que pide la Entrega 2; consorcios complejos pueden
    quedar simplificados para esta etapa).

## Fase 5 — Integración con Bonita: iniciar y completar tareas

19. Modelar (aunque sea preliminar) el proceso en Bonita si todavía no está
    desde la Entrega 1, o retomar el ya entregado.
20. Al registrarse una emergencia (endpoint de la Fase 2), llamar a la API
    de Bonita para **iniciar la instancia del proceso**, seteando las
    variables de proceso iniciales, usando la sesión obtenida en la
    Fase 1.
21. Guardar el `bonitaCaseId` devuelto en la tabla `emergencies` y
    mostrarlo en la confirmación (el campo ya existe en el frontend, solo
    falta que deje de ser `null`).
22. Implementar la llamada para **completar tareas humanas** en Bonita
    desde la app (por ejemplo, cuando el Coordinador publica la
    convocatoria de lotes), usando el login service para autenticar esa
    acción.

## Fase 6 — Cierre de etapa

23. Pruebas de integración del flujo completo: alta de emergencia →
    login/sesión Bonita → inicio de instancia → lotes → ofertas →
    completar tarea.
24. Revisión de grooming: comparar lo estimado en la Entrega 1 contra lo
    efectivamente hecho.
25. Documentar en `docs/` lo implementado (incluyendo cómo quedó la
    integración con el login service de Bonita) y planificar el grooming
    de la Entrega 3 (API del Sistema Nacional).
