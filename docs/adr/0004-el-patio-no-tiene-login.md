# ADR-0004: El patio no tiene login

Estado: Accepted
Fecha: 2026-11-11

## Context

El encargado registra equipos y mantenimientos desde la página. Esta versión tiene que poder usarse abriendo la URL, sin entregar una clave aparte.

## Decision

No hay cuentas ni sesión. Quien llega a la URL de la página usa el patio. La API acepta las mismas operaciones sin un token.

## Alternatives

**Un usuario y una contraseña fijos.** Descartado: la clave tendría que vivir en algún sitio, y la página dejaría de abrirse con solo la URL.

**Dejar la API cerrada y la página abierta.** Descartado: la página no podría registrar nada. Las dos URLs forman un solo patio.

## Trade-offs

Se gana una prueba que cualquiera puede recorrer. Se paga que cualquiera con las URLs puede crear, editar y borrar equipos.

## Consequences

No hay papeles de operador y auditor. El límite queda escrito en la arquitectura y en el README. Una versión con identidad sería otro ADR.
