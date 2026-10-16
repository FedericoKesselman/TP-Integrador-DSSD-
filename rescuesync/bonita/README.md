# Bonita

El proyecto de Bonita (diagrama del proceso `GestionarEmergencia` y la
organización **RescueSync**) vive en un **repositorio aparte**, conectado
directamente desde Bonita Studio:


## Puesta en marcha

Para levantar el entorno local en el orden correcto:

1. Desde `rescuesync/web-app`, levantar la base y el backend:

   ```bash
   docker compose up -d postgres
   docker compose up -d server
   ```

   Verificar que el backend esté escuchando en `http://localhost:4000`.
   No usar `docker compose down -v`: elimina los datos de PostgreSQL.

2. Verificar que `web-app/server/.env` tenga un valor para
   `BONITA_NOTIFICATION_TOKEN`. Cada integrante debe configurar su propio
   valor local; el archivo `.env` no se versiona.

3. En Bonita Studio (2025.2), importar/clonar el proyecto desde ese repo.
4. En el Explorador, abrir `Organizaciones → RescueSync.xml` y
   **Desplegar** (tiene que quedar marcada como *activa*).
5. Abrir el proceso → **Configurar**: verificar el mapeo de actores
   (Municipio → `operador_municipal`, Coordinador → `coordinador_regional`,
   ONG → `representante_ong`, Sistema Nacional → `sistema_nacional`) y, en
   *Autenticación*, un usuario de la organización RescueSync.
6. Configurar los conectores REST según la sección siguiente y desplegar una
   versión nueva del proceso cada vez que se modifique un conector. Los casos
   ya iniciados conservan la versión con la que fueron creados.
7. Con Studio abierto, Bonita responde en `http://localhost:8080/bonita`.
   La app web lo usa para el login (ver `../README.md`, "Login con Bonita").

### Inicio desde Finder

Cada vez que se vaya a iniciar Bonita, cerrar previamente Bonita Studio y su
runtime y ejecutar desde la raíz del repositorio:

```bash
sh rescuesync/bonita/scripts/start-studio.sh
```

El script toma el token del contenedor `server` o, como alternativa, de
`web-app/server/.env`, configura el runtime local de Bonita y luego inicia
Bonita Studio. No abrir Bonita directamente desde Finder, porque el runtime
puede no recibir las variables necesarias.

## Usuarios de prueba

Todos con contraseña `123123123`. Son usuarios de la Bonita local de cada
uno, solo para desarrollo y demo.

| Usuario (login) | Rol | Grupo |
|---|---|---|
| `OperadorM` | `operador_municipal` | `/rescuesync/municipios/la-plata` |
| `CoordinadorR` | `coordinador_regional` | `/rescuesync/centro-coordinador` |
| `RescatistasUnidos` | `representante_ong` | `/rescuesync/ongs/rescatistas-unidos` |
| `Manos Solidarias` | `representante_ong` | `/rescuesync/ongs/manos-solidarias` |
| `Dirección` | `auditor` | `/rescuesync/direccion` |

Para el login se usa la columna **Usuario** tal cual (respetando
mayúsculas, espacios y tildes), no el nombre visible que muestra Studio.

## Notificaciones de convocatoria

La tarea automática **Notificar Convocatoria a ONGs** tiene un conector
REST POST 1.5.0 en el repositorio de Desktop de Bonita. Envía:

- `POST ${RESCUESYNC_BACKEND_URL}/api/notifications/convocatoria`
- `Authorization: Bearer ${BONITA_NOTIFICATION_TOKEN}`
- `Content-Type: application/json`
- Cuerpo: `{"emergenciaId":"<variable emergenciaId del caso>"}`.

El backend notifica a todas las entidades de `ongs`. No crea usuarios:
la autenticación y los grupos siguen en Bonita. El aviso pertenece a la
ONG y lo ven sus representantes en **Avisos** del encabezado de la web.
Se consulta al entrar y cada 30 segundos. Los avisos se conservan.

### Configuración local

La integración con Bonita usa el conector REST del proceso y las variables
locales indicadas arriba. Después de configurar el entorno, desplegar el
proceso y crear una emergencia nueva se puede probar el flujo completo.

1. Aplicar `npm run migrate:up` en `web-app/server` (o dentro del contenedor).
2. Generar un secreto local, por ejemplo con `openssl rand -hex 32`.
   Guardarlo como `BONITA_NOTIFICATION_TOKEN` en `web-app/server/.env`,
   que no se versiona. No agregarlo al `.env` del cliente.
3. Recrear el backend con `docker compose up -d --force-recreate server`
   desde `web-app`, para que reciba la variable nueva.
4. Cerrar Studio y su runtime después de guardar el trabajo. Iniciar Studio con
   `sh rescuesync/bonita/scripts/start-studio.sh` desde la raíz del repo.
   El script obtiene `BONITA_NOTIFICATION_TOKEN` del contenedor `server`
   (debe estar levantado), salvo que ya esté exportado en la terminal.
   Usa `RESCUESYNC_BACKEND_URL=http://localhost:4000` por defecto.
   Configura ambas variables explícitamente en el archivo local de lanzamiento
   de Tomcat de Eclipse, con permisos `0600`; contiene el secreto y no debe
   compartirse ni versionarse. No alcanza con exportar variables en otra
   terminal cuando el runtime ya está ejecutándose.
   Para otra instalación, definir `BONITA_STUDIO_APP` y, si hace falta,
   `DOCKER_BIN`. El runtime debe haberse iniciado al menos una vez para que
   exista su configuración local.
5. Reabrir y validar el diagrama; desplegarlo para casos nuevos.
   Editar el `.proc` no actualiza automáticamente los casos ya iniciados.

Bonita corre en el host, por eso usa `localhost:4000`, el puerto publicado
por Compose. No usar el nombre Docker `server` desde ese runtime.

### Errores y reintentos

El endpoint responde `200` con `{emergenciaId, created}`; un reintento
exitoso devuelve `created: 0`. Una restricción única por emergencia y ONG
impide duplicados incluso ante llamadas concurrentes. Devuelve `400` para
un UUID inválido, `401` para credenciales inválidas, `404` si no existe la
emergencia, `409` si no está abierta, `503` si falta configurar el secreto
y `500` ante fallas de base de datos.

Los errores HTTP 4xx/5xx y de conexión hacen fallar el conector. No se
ignoran: la tarea queda fallida, visible en Administración de Bonita.
Corregir la causa y reintentar la actividad desde Administración. El
conector limita la conexión a 5 segundos y la respuesta a 10 segundos.
No se habilitan reintentos HTTP automáticos ni impresión de secretos.

La publicación web completa solamente las tareas humanas. No espera la
notificación automática: una falla posterior del conector no revierte la
publicación. El caso continúa a Cargar ofertas al terminar el conector.
Guardar lotes como borrador no ejecuta esa tarea ni llama a este endpoint.

Prueba aislada del backend, sin modificar los datos de la aplicación:
`docker exec web-app-server-1 node tests/notifications.integration.js`.
La prueba crea y elimina únicamente su esquema temporal.
