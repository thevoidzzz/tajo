# ADR-0005: El despliegue es un comando

Estado: Accepted
Fecha: 2026-11-11

## Context

Publicar tiene que ser un solo comando de terminal, repetible, que verifique lo necesario, publique las dos piezas, migre y compruebe. Si un paso falla, el proceso termina con un error claro y un código de salida distinto de cero.

## Decision

`./deploy.sh` es el único camino que publica. Antes de tocar un servicio remoto revisa las herramientas y las variables. Al final pide la página y `/health`. Si `/health` falla después de publicar la API, vuelve a la imagen anterior y sale con error. GitHub Actions corre la suite de pruebas en el pull request y en `main`. No publica.

## Alternatives

**Publicar desde Actions en cada merge.** Descartado: habría dos caminos, y el comando dejaría de ser el que falla o el que deja el patio en línea.

**Un Makefile que solo construye en local.** Descartado: construir no es publicar, y el reto del patio es que las dos URLs queden respondiendo.

## Trade-offs

Se gana un camino explicable y una integración que no necesita secretos de publicación. Se paga operar el comando a mano cuando corresponde publicar.

## Consequences

Las pruebas del comando cubren el rechazo previo y la vuelta atrás. La publicación real se corre cuando las cuentas y las variables existen, y las URLs entran al README solo después de responder.
