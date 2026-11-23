# Guía de pruebas del ciclo completo

Cómo probar RescueSync de punta a punta con los valores de ejemplo, caso por
caso. Se asume que el entorno ya está levantado según el
[`README`](../README.md) (backend, cliente, Bonita con el proceso desplegado y
el Sistema Nacional accesible).

## Antes de empezar

### Usuarios (contraseña `123123123`)

| Usuario | Perfil | Participa en |
|---|---|---|
| `OperadorM` | Operador municipal | Registrar emergencia, adjudicar ofertas |
| `CoordinadorR` | Coordinador regional | Revisar, armar lotes, publicar convocatoria, decidir cómo continuar, confirmar cierre |
| `RescatistasUnidos` | ONG `rescatistas-unidos` | Cargar ofertas, finalizar su actividad, Mi inventario, Avisos |
| `Manos Solidarias` | ONG `manos-solidarias` | Ídem |
| `Dirección` | Auditor | Dashboard |

Tip: abrí dos navegadores (o una ventana privada) para tener a dos perfiles logueados a la vez.

### Datos de partida

Inventario base de las ONG de ejemplo en el Sistema Nacional (se ve y edita en **Mi inventario**):

| Recurso | `rescatistas-unidos` | `manos-solidarias` |
|---|---|---|
| Bomberos | 100 | 100 |
| Motobombas | 100 | 100 |
| Rescatistas | 100 | 100 |
| Carpas | 100 | 100 |
| Chalecos | 5 | 5 |
| Combustible | 10 | — |

Si usás el SN de Render, ya está cargado. Con un SN local, ver [SN local](#sn-local-crear-las-ong-y-su-inventario).

### Reglas del juego que conviene tener presentes

- **Ventana de la convocatoria:** al publicarla el coordinador elige la duración en minutos. Para probar usá **2 minutos**. Cuando vence, Bonita cierra sola la convocatoria, consulta las ofertas y las valida contra el SN.
- **Validación:** para cada ítem de una oferta, el SN habilita `min(ofrecido, disponible de las ONG de la oferta)`. La cobertura de un lote es lo habilitado sobre lo pedido. La validación **no reserva** stock; el stock se **compromete** recién al adjudicar.
- **Si todos los lotes quedan cubiertos**, el caso salta a la adjudicación. Si no, el coordinador decide: **continuar** (adjudicar lo que hay), **reabrir** (nueva ventana) o **reformular** (volver a armar los lotes).
- **Inventario:** `disponible = total − comprometido`. El comprometido solo lo mueve el SN (al adjudicar y al cerrar).
- Después de cada acción esperá unos segundos: Bonita avanza el proceso en segundo plano (y el primer pedido al SN de Render puede tardar ~1 minuto).

Para ver qué hizo Bonita: Portal (http://localhost:8080/bonita, usuario `Dirección`) → **Administrator → Task list** → filtrar por *Case ID* → pestañas *Pending tasks*, *Done tasks* y *Failed flow nodes*.

---

## Caso 1 — Ciclo completo feliz (cobertura total)

Es la prueba principal: recorre todo el proceso, de la alta al cierre.

| # | Quién | Acción | Resultado esperado |
|---|---|---|---|
| 1 | `OperadorM` | Registrar una emergencia (datos de ejemplo: tipo *Inundación*, gravedad *Alta*, ubicación *La Plata*, descripción y damnificados a elección) | Estado `registrada`. Se crea el caso en Bonita |
| 2 | `CoordinadorR` | Abrir la emergencia, armar los lotes **Bomberos: 10** y **Motobombas: 3** y publicar la convocatoria con **2 minutos** | Estado `convocatoria_abierta`. Las ONG reciben un aviso de **convocatoria** |
| 3 | `RescatistasUnidos` | Cargar una oferta: **Bomberos 6** y **Motobombas 2** | Oferta registrada |
| 4 | `Manos Solidarias` | Cargar una oferta: **Bomberos 4** y **Motobombas 1** | Oferta registrada |
| 5 | — | Esperar que venza la ventana (2 min) | Estado `convocatoria_cerrada` y aviso de cierre; luego `validada`. Los dos lotes quedan cubiertos al 100 % |
| 6 | `OperadorM` | Entrar a la emergencia, ver las dos ofertas validadas y **adjudicar ambas** | Estado `adjudicada` y enseguida `en_ejecucion` |
| 7 | ambas ONG | Mirar **Avisos** | Cada una recibe el aviso de **adjudicada** |
| 8 | ambas ONG | **Mi inventario** | **Comprometido** distinto de 0 (Bomberos y Motobombas), disponible reducido |
| 9 | `CoordinadorR` | Intentar **confirmar el cierre** de la ejecución | **Rechazado**: "Todavía hay ONGs que no marcaron su actividad como finalizada" |
| 10 | ambas ONG | Marcar su oferta como **finalizada** | Oferta `finalizada` |
| 11 | `CoordinadorR` | **Confirmar el cierre** | Estado `finalizada` |
| 12 | ambas ONG | **Mi inventario** | **Comprometido vuelve a 0**; el stock queda liberado |
| 13 | Portal de Bonita | Done tasks del caso | Todas las tareas hechas, incluidas "Notificar Compromiso a las ONGs", "Etapa Ejecución", "Confirmar cierre de ejecución", "Informar Cierre" y "Liberar recursos"; sin pendientes ni fallidas |

## Caso 2 — Cobertura parcial → **continuar**

| Quién | Acción |
|---|---|
| `OperadorM` / `CoordinadorR` | Nueva emergencia; lote **Bomberos: 50**; publicar con 2 minutos |
| `RescatistasUnidos` | Oferta de **Bomberos 10** |
| — | Esperar el cierre: el lote queda cubierto al 20 %, el caso va a **"Decidir como Continuar"** |
| `CoordinadorR` | Ver las ofertas con su perfil y cobertura; decidir **continuar** |
| `OperadorM` | Adjudicar la oferta |

Esperado: emergencia `adjudicada` → `en_ejecucion` y el caso queda esperando en **"Confirmar cierre de ejecución"**. Se cierra como en el caso 1 (pasos 9 a 13).

## Caso 3 — Cobertura parcial → **reabrir**

| Quién | Acción |
|---|---|
| `CoordinadorR` | Nueva emergencia con lote **Motobombas: 20**; publicar con 2 minutos |
| `RescatistasUnidos` | Oferta de **Motobombas 5** |
| `CoordinadorR` | Tras el cierre, decidir **reabrir** (con una nueva duración de 2 minutos) |

Esperado: vuelve a `convocatoria_abierta` (ronda 2), la oferta anterior se conserva, las ONG reciben **un nuevo aviso** de convocatoria y empieza una ventana nueva. Si en la segunda ronda otra ONG oferta lo que falta, la emergencia llega a la adjudicación.

## Caso 4 — Cobertura parcial → **reformular**

| Quién | Acción |
|---|---|
| `CoordinadorR` | Nueva emergencia con lote **Rescatistas: 30**; publicar con 2 minutos |
| `RescatistasUnidos` | Oferta de **Rescatistas 5** |
| `CoordinadorR` | Tras el cierre, decidir **reformular** |

Esperado: las ofertas pasan a `retirada` (queda el historial), las ONG reciben un aviso de **oferta retirada**, la emergencia vuelve a `registrada` y el caso a **"Generar Lotes de Necesidades"** para armar lotes nuevos.

## Caso 5 — Sin ofertas

| Quién | Acción |
|---|---|
| `CoordinadorR` | Nueva emergencia con lote **Carpas: 10**; publicar con 2 minutos |
| ONG | **No** ofertar nada |

Esperado: al vencer la ventana la validación corre con 0 ofertas, el caso va a **"Decidir como Continuar"** y **reabrir** funciona.

## Caso 6 — Consorcio de ONG

| Quién | Acción |
|---|---|
| `CoordinadorR` | Nueva emergencia con lote **Chalecos: 10**; publicar con 2 minutos |
| `RescatistasUnidos` | Oferta de **Chalecos 10** como ONG **principal**, sumando a `manos-solidarias` como **apoyo** |

Cada ONG solo tiene 5 chalecos. Esperado: la validación habilita **10** (5 + 5) y, al adjudicar, el **reparto** del compromiso es 5 y 5. Se ve en **Mi inventario** de cada ONG (comprometido 5).

## Caso 7 — Conflicto de stock (el SN rechaza el compromiso)

Prueba que, si el stock ya fue comprometido por otra emergencia, el compromiso falla de forma controlada.

| Quién | Acción |
|---|---|
| `CoordinadorR` | **Emergencia A**: lote **Combustible: 8**; publicar con 2 minutos |
| `RescatistasUnidos` | Oferta de **Combustible 8** (tiene 10) |
| `OperadorM` | Adjudicar. Dejar la emergencia **en ejecución** (no la cierres todavía) |
| `CoordinadorR` | **Emergencia B**: lote **Combustible: 8**; publicar con 2 minutos |
| `RescatistasUnidos` | Oferta de **Combustible 8** (la validación todavía la ve habilitada: no reserva) |
| `OperadorM` | Adjudicar |

Esperado en la emergencia B: el SN responde **409** (solicitado 8, disponible 2, faltan 6). La tarea "Informar Compromiso Fallido" corre, el caso **vuelve a "Adjudicar Ofertas"** con una tarea nueva, y la pantalla del municipio muestra el **detalle del conflicto**. La emergencia sigue `validada`. Después se puede cerrar la emergencia A y reintentar la B.

## Caso 8 — Oferta sin cantidades habilitadas

| Quién | Acción |
|---|---|
| `CoordinadorR` | Nueva emergencia con lote **Camiones: 5**; publicar con 2 minutos |
| `RescatistasUnidos` | Oferta de **Camiones 5** (la ONG no tiene camiones en su inventario) |
| `CoordinadorR` | Tras el cierre, decidir **continuar** |
| `OperadorM` | Intentar adjudicar esa oferta |

Esperado: la validación habilita 0 y la adjudicación se **rechaza** con un mensaje claro ("Hay ofertas elegidas sin cantidades habilitadas por el Sistema Nacional; no se pueden adjudicar"). La selección no se guarda y el caso de Bonita no falla. (Este comportamiento también está cubierto por `npm test`.)

## Caso 9 — Reglas de inventario

| Quién | Acción | Esperado |
|---|---|---|
| ONG | Con stock comprometido (caso 1 en el paso 8), bajar el **total** de un recurso por debajo de lo comprometido | Rechazo `409` |
| ONG | Subir el total | Se acepta y aumenta el disponible |

## Caso 10 — Edición de ofertas

| Quién | Acción | Esperado |
|---|---|---|
| ONG | Con la convocatoria abierta, editar su oferta | Se guarda una nueva versión y queda el historial |
| ONG | Intentar editar **después** de que venció la ventana | Rechazo |

## Caso 11 — Dashboard

Con `Dirección`, abrir el dashboard (ver [`../dashboard/README.md`](../dashboard/README.md)). Tras correr los casos anteriores deberían aparecer emergencias en distintos estados y los **tiempos por etapa**, incluida la **etapa de ejecución** (entre "Etapa Ejecución" y "Liberar recursos").

---

## SN local: crear las ONG y su inventario

Solo si levantaste el Sistema Nacional en local (ver [`../sistema-nacional/README.md`](../sistema-nacional/README.md)). Las ONG no vienen precargadas:

```bash
SN=http://localhost:5000
TOKEN=$(curl -s -X POST $SN/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"rescuesync-integracion","password":"<SN_INTEGRATION_PASSWORD>"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl -s -X POST $SN/ongs -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "ref": "rescatistas-unidos", "nombre": "Rescatistas Unidos", "nivelOperativo": 3,
  "username": "rescatistas-unidos", "password": "ClaveOng123",
  "recursos": [
    {"recursoCodigo":"bomberos","cantidadTotal":100},
    {"recursoCodigo":"motobombas","cantidadTotal":100},
    {"recursoCodigo":"rescatistas","cantidadTotal":100},
    {"recursoCodigo":"carpas","cantidadTotal":100},
    {"recursoCodigo":"chalecos","cantidadTotal":5},
    {"recursoCodigo":"combustible","cantidadTotal":10}
  ]}'

curl -s -X POST $SN/ongs -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "ref": "manos-solidarias", "nombre": "Manos Solidarias", "nivelOperativo": 3,
  "username": "manos-solidarias", "password": "ClaveOng123",
  "recursos": [
    {"recursoCodigo":"bomberos","cantidadTotal":100},
    {"recursoCodigo":"motobombas","cantidadTotal":100},
    {"recursoCodigo":"rescatistas","cantidadTotal":100},
    {"recursoCodigo":"carpas","cantidadTotal":100},
    {"recursoCodigo":"chalecos","cantidadTotal":5}
  ]}'
```

El `ref` tiene que coincidir con el **grupo** del usuario en la organización de Bonita (`/rescuesync/ongs/<ref>`): de ahí la app saca la ONG de cada sesión.

## Volver a empezar

Para borrar las emergencias de prueba, liberar el stock y limpiar Bonita, seguir la sección
[Dejar el entorno limpio](../README.md#dejar-el-entorno-limpio-volver-a-empezar) del README.
