# Dashboard (indicadores para Dirección)

El dashboard **no es una aplicación aparte**: es un módulo de la web-app, decisión
confirmada con la cátedra. Esta carpeta solo explica dónde está cada parte.

| Parte | Dónde |
|---|---|
| Pantalla (`/dashboard`, solo rol `auditor`) | `web-app/client/src/pages/DashboardPage.jsx` y `web-app/client/src/features/dashboard/` |
| API (`/api/dashboard/*`) | `web-app/server/src/routes/dashboard-routes.js` y `web-app/server/src/dashboard/` |
| Contrato | `docs/api-contracts.md`, sección "Dashboard" |
| Datos de demo | `web-app/server/scripts/demo.js` |

## Qué combina

- **Datos propios (Postgres):** suministros movilizados por mes y recurso, % de emergencias
  resueltas con consorcios, estado de proyectos y cobertura promedio de lotes.
- **Datos de Bonita (API REST):** tiempo promedio por etapa de la emergencia, calculado con
  las tareas cerradas de cada caso. El backend los consulta con la sesión de Bonita del
  usuario de Dirección (perfil Administrador en Bonita); el navegador nunca habla con Bonita.
- **Indicador cruzado:** tiempos por etapa según el tipo de emergencia (tiempo de Bonita +
  tipo de la base local, unidos por `emergencies.bonita_case_id`).

Filtros por período (filtra todo) y por recurso (solo suministros), gráficos interactivos y
exportación en JSON o CSV.

## Datos de demo

Con la app levantada (`docker compose up` en `web-app/`):

```bash
docker compose exec server npm run demo:cargar
docker compose exec server npm run demo:borrar
```

Cargan o borran 8 emergencias marcadas con `[DEMO]` en la descripción. Los tiempos de Bonita
no se siembran: salen solo de los casos que pasaron por el proceso.
