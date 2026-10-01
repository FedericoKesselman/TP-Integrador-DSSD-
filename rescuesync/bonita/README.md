# Bonita

El proyecto de Bonita (diagrama del proceso `GestionarEmergencia` y la
organización **RescueSync**) vive en un **repositorio aparte**, conectado
directamente desde Bonita Studio:


## Puesta en marcha

1. En Bonita Studio (2025.2), importar/clonar el proyecto desde ese repo.
2. En el Explorador, abrir `Organizaciones → RescueSync.xml` y
   **Desplegar** (tiene que quedar marcada como *activa*).
3. Abrir el proceso → **Configurar**: verificar el mapeo de actores
   (Municipio → `operador_municipal`, Coordinador → `coordinador_regional`,
   ONG → `representante_ong`, Sistema Nacional → `sistema_nacional`) y, en
   *Autenticación*, un usuario de la organización RescueSync.
4. Con Studio abierto, Bonita responde en `http://localhost:8080/bonita`.
   La app web lo usa para el login (ver `../README.md`, "Login con Bonita").

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
