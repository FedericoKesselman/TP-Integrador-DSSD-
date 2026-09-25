# Bonita

El proyecto de Bonita (diagrama del proceso `GestionarEmergencia` y la
organización **RescueSync**) vive en un **repositorio aparte**, conectado
directamente desde Bonita Studio:

**Repo:** `<URL del repo de Bonita>`

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
