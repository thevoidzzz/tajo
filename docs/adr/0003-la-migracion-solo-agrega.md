# ADR-0003: La migración solo agrega

Estado: Accepted
Fecha: 2026-11-11

## Context

El comando de despliegue tiene que aplicar la base y, si la API nueva no responde, volver a la imagen anterior. Una migración que borra o renombra una columna deja a esa imagen anterior sin poder leer.

## Decision

Las migraciones son archivos SQL numerados. El comando aplica las que todavía no están registradas, y una segunda corrida no las repite. Solo agregan tablas o columnas. La vuelta atrás vuelve a publicar la imagen anterior de la API y no ejecuta un retroceso del esquema.

## Alternatives

**Un ORM que genere el diff del esquema.** Descartado: el paso de migrar dejaría de ser un archivo que se puede leer, y el comando ocultaría lo que aplica.

**Rebobinar el esquema junto con la imagen.** Descartado: un retroceso destructivo puede borrar el historial de mantenimientos que la corrida mala ya escribió.

## Trade-offs

Se gana una vuelta atrás que la imagen anterior puede arrancar. Se paga que una columna sobrante se quede, y que corregir un error de esquema sea una migración nueva.

## Consequences

Cada archivo SQL se puede explicar línea por línea. El registro de archivos aplicados vive en la misma base.
