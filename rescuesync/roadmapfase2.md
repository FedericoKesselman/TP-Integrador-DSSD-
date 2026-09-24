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

## Fase 1 — Organización de Bonita e integración mínima de login

6. [x] Definir en la organización de Bonita los usuarios, roles y grupos
   necesarios para la Etapa 2 (Operador Municipal, Centro Coordinador,
   ONG — como mínimo los que participan del flujo de esta entrega).
7. Desde `web-app/server`, implementar la llamada al login service de
   Bonita (`POST /bonita/loginservice`) para autenticar al usuario y
   obtener la sesión/cookie que Bonita necesita para las siguientes
   llamadas a su API.
8. Definir cómo esa sesión de Bonita se propaga o se representa hacia el
   cliente (por ejemplo, guardándola server-side y exponiendo al cliente
   solo lo mínimo necesario para saber que está logueado).
9. Pantalla de login mínima en el cliente — alcanza con lo necesario para
   autenticar contra Bonita, sin RBAC visual complejo todavía.

## Fase 2 — Emergencias: conectar lo ya construido

*El formulario de alta ya existe en el cliente (`EmergencyFormPage.jsx` y
componentes asociados); falta el otro lado.*

10. Implementar `POST /api/emergencies` en `web-app/server` (persistencia
    en Postgres + validación server-side reutilizando lo de la Fase 0).
11. Apagar el modo mock (`VITE_USE_MOCK_API=false` en `client/.env`) y
    probar el flujo real end-to-end.
12. Endpoint de listado (`GET /api/emergencies`) para que el Centro
    Coordinador pueda verlas — necesario para la Fase 3.

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
