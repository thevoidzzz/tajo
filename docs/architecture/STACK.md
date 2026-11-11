# STACK — Criterio de cada pieza

Estado: Aprobada
Fecha: 2026-11-11

Cada pieza dice para qué está, por qué se eligió y qué otra opción se dejó de lado. El costo es el de esta versión, no una cotización cerrada.

## TypeScript en la API y en la página

El contrato de un equipo se recorre en un solo lenguaje, del formulario a la tabla. Java en la API habría partido esa lectura en dos mundos para cinco rutas y una página.

## Express y Zod

La API es alta, listado, edición, baja, mantenimiento y `/health`. Express se lee sin un manual del framework. Zod rechaza un cuerpo inválido antes de que llegue a la tabla. Fastify junta el servidor y la validación; aquí la validación ya tiene su propia pieza.

## Vite y React

La página es un sitio estático con su propia URL. Vite produce esa carpeta. Next habría empujado la página y la API al mismo proceso, y esta versión necesita dos URLs. [ADR-0002](../adr/0002-un-repositorio-dos-urls.md).

## PostgreSQL

Hace falta una base relacional. Postgres es la que el entorno local ya sabe levantar con Docker, y el proveedor de la base habla el mismo SQL.

## Archivos SQL, sin ORM

El comando tiene que aplicar migraciones como un paso visible. Un archivo numerado es ese paso. Un ORM lo sustituye por un diff generado. [ADR-0003](../adr/0003-la-migracion-solo-agrega.md).

## Vitest

Es la suite que GitHub Actions ejecuta. Cubre el corte del ciclo, el rechazo de un horómetro imposible, `/health`, la revisión previa del comando y la vuelta atrás.

## Docker

La imagen de la API es lo que se publica. Compose levanta en local la base, la API y la página con esa misma imagen de API. No hay una imagen de desarrollo y otra de publicación.

## GitHub Actions

El job `test` corre en Ubuntu, en el pull request y al entrar a `main`. No publica. Publicar es `./deploy.sh`. [ADR-0005](../adr/0005-el-despliegue-es-un-comando.md). Las actions se fijan por el SHA del commit, no por una etiqueta móvil.

## Vercel para la página

La página se queda despierta y tiene URL propia. El plan gratuito alcanza. El comando la publica.

## Fly para la API

La API queda en una máquina pequeña encendida, para que `/health` responda cuando alguien abre el patio después. La vuelta atrás vuelve a publicar la imagen anterior. El orden de costo, con la máquina prendida, es de unos pocos dólares al mes. El Postgres administrado del mismo proveedor empieza en 38 dólares al mes, y por eso la base no va ahí.

## Neon para Postgres

La base queda fuera de la imagen. Una publicación mala no se lleva los mantenimientos. El comando aplica el SQL pendiente contra `DATABASE_URL`. El plan gratuito alcanza para esta versión.

## Sin AWS en esta versión

El peso está en el comando, las dos URLs y la regla del ciclo. Una base administrada que empieza en 38 dólares al mes no cambia esa regla.

## Sin login

El patio se usa abriendo la URL. [ADR-0004](../adr/0004-el-patio-no-tiene-login.md).
