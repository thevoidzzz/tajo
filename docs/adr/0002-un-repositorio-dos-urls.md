# ADR-0002: Un repositorio, dos URLs

Estado: Accepted
Fecha: 2026-11-11

## Context

La página y la API tienen que publicarse por separado, cada una con su URL. El despliegue es un solo comando, y el historial de la regla de mantenimiento tiene que leerse en un solo lugar.

## Decision

Un repositorio. Dos procesos publicados: la página estática y la API. El comando publica los dos, aplica las migraciones y comprueba las dos URLs.

## Alternatives

**Dos repositorios.** Descartado: el comando, las migraciones y la regla quedarían partidos. Un cambio de contrato exigiría dos historiales.

**Una sola aplicación que sirva la página y la API.** Descartado: sería una sola URL. La página y la API tienen que poder publicarse y caer cada una por su lado.

## Trade-offs

Se gana un comando y un historial. Se paga un repositorio con dos empaquetados y dos destinos de publicación.

## Consequences

La API no sirve el HTML. La página llama a la URL pública de la API. El estado de mantenimiento se calcula en la API, y la página lo muestra.
