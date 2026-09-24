# RescueSync

Monorepo del TP integrador de DSSD (grupo de 5 integrantes). RescueSync es un
sistema de coordinación de operaciones de rescate compuesto por 3 sistemas
activos y 1 pieza reservada para una entrega futura.

## Roadmap de la etapa actual

El plan de implementación de la Entrega 2 (fases, orden de trabajo y la
aclaración del profesor sobre autenticación vía el login service de Bonita)
está documentado en [`rescuesync/roadmapfase2.md`](./rescuesync/roadmapfase2.md).
Leer ese archivo antes de tocar autenticación, roles, o el orden en que se
implementan emergencias/lotes/ofertas/Bonita — tiene el contexto y las
decisiones ya tomadas para esta etapa.

## Sistemas del proyecto

### 1. `web-app/` — Aplicación web principal
Sistema central de la aplicación: registro y gestión de operaciones/recursos
vía interfaz web.

- **Stack:**
  - `client/`: React + Vite
  - `server/`: Node.js + Express
  - Base de datos: PostgreSQL
- **Estado:** en desarrollo activo.

### 2. `sistema-nacional/`
API externa que expone/consume información a nivel nacional, protegida con
JWT. Se integra con `web-app/server` como servicio externo autenticado.

- **Stack:** a definir (API con autenticación JWT).
- **Estado:** aún no se codea — solo carpeta reservada por ahora.

### 3. `dashboard/`
Carpeta reservada para la **Entrega 4/5**. Combinará datos propios del
proyecto con la API de Bonita para mostrar gráficos e indicadores
interactivos de las operaciones de rescate.

- **Stack:** sin definir todavía.
- **Estado:** no iniciado, placeholder de carpeta.

### 4. `bonita/`
Contiene el diagrama de proceso BPM (Bonita) y los conectores/integraciones
necesarios para que Bonita se comunique con `web-app` y, más adelante, con
`dashboard`.

- **Estado:** diagrama y conectores, sin lógica de aplicación propia.

### `docs/`
Documentación general del proyecto (diagramas, decisiones de arquitectura,
minutas, etc.) que no pertenece a un sistema en particular.

## Estructura de carpetas

```
rescuesync/
├── web-app/
│   ├── client/          # React + Vite
│   ├── server/          # Node + Express
│   ├── shared/          # Validaciones/constantes compartidas client ↔ server
│   └── docker-compose.yml
├── sistema-nacional/     # API JWT (pendiente)
├── dashboard/            # Entrega 4/5 (stack a definir)
├── bonita/               # Diagrama BPM + conectores
└── docs/                 # Documentación general
```

## Convenciones de código

### Naming
- Archivos y carpetas: `kebab-case` (ej: `user-profile.js`).
- Componentes React: `PascalCase` (ej: `UserProfile.jsx`).
- Variables y funciones: `camelCase`.
- Constantes globales: `UPPER_SNAKE_CASE`.
- Tablas y columnas de Postgres: `snake_case`.

### Lint y formato
- `client/` y `server/` usan **ESLint** (base Airbnb) + **Prettier**.
- Antes de commitear, correr `npm run lint:fix` y `npm run format` en el
  paquete modificado.
- No mezclar reglas de estilo distintas entre integrantes: si el linter no
  cubre un caso, se discute y se agrega la regla al `.eslintrc`, no se
  resuelve por consenso informal.

### Commits (Conventional Commits)
Formato: `tipo(alcance opcional): descripción breve en imperativo`.

Tipos permitidos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Ejemplos:
- `feat(client): agregar formulario de alta de operativo`
- `fix(server): corregir validación de coordenadas`
- `chore(docker): actualizar imagen de postgres`

Alcance sugerido = nombre del sistema (`client`, `server`,
`sistema-nacional`, `dashboard`, `bonita`, `docs`).

## Evitar código duplicado entre `client` y `server`

- Las reglas de validación de datos (formatos, rangos, campos requeridos)
  se definen **una sola vez** en `web-app/shared/` y se reutilizan desde
  ambos lados (ver `web-app/shared/emergency-validation.js`) — no se
  reescriben ni en `client` ni en `server`.
- Los tipos/contratos de datos que viajan entre `client` y `server` (forma
  de los objetos de la API) se documentan en un solo lugar (ej:
  `docs/api-contracts.md` o un paquete compartido de tipos) y ambos lados
  se referencian a esa fuente, no la reinventan.
- No copiar constantes (códigos de estado, enums de dominio) entre `client`
  y `server`: definirlas en un módulo compartido cuando exista, o en su
  defecto documentarlas en `docs/` hasta que se justifique extraerlas.
- Esta misma lógica aplica a futuro entre `web-app` y `dashboard` cuando
  `dashboard` empiece a consumir los mismos datos.

## Cómo levantar el entorno local

1. Copiar `web-app/server/.env.example` a `web-app/server/.env` y completar
   los valores (nunca commitear el `.env` real).
2. Desde `web-app/`, levantar backend + Postgres:
   ```bash
   docker compose up
   ```
3. Instalar dependencias del cliente y levantarlo aparte (Vite no corre en
   Docker en esta etapa):
   ```bash
   cd client
   npm install
   npm run dev
   ```
4. El cliente queda disponible en `http://localhost:5173` (default de Vite)
   y el server en `http://localhost:4000` (o el puerto definido en `.env`).

## Alcance actual

Hay lógica de negocio real implementada, aunque el backend todavía no
expone endpoints propios:

- **Cliente**: formulario completo de alta de emergencia
  (`EmergencyFormPage` y componentes asociados), con mapa, validación,
  vista previa y confirmación. Corre en modo mock (`localStorage`) porque
  el server todavía no tiene rutas.
- **Server**: conexión a Postgres armada, pero sin endpoints propios
  todavía (eso es la Fase 2 del roadmap).
- **Base de datos**: esquema completo aplicado vía migraciones
  (`emergencies`, `lotes`, `ongs`, `ofertas`, `oferta_ongs`,
  `oferta_lotes`, `oferta_historial`).
- **`web-app/shared/`**: reglas de validación del dominio "emergencias",
  compartidas entre client y server.
- **Routing**: esqueleto de rutas en el cliente con React Router.

Ver [`rescuesync/roadmapfase2.md`](./rescuesync/roadmapfase2.md) para el
estado fase por fase y qué sigue.
