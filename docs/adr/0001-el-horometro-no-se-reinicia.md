# ADR-0001: El horómetro no se reinicia

Estado: Accepted
Fecha: 2026-11-11

## Context

Un equipo acumula horas de uso durante toda su vida. El mantenimiento tiene que dejar historial y abrir un ciclo nuevo. Si el horómetro volviera a cero, el patio perdería la vida de la máquina y un equipo que llega con horas ya trabajadas entraría como si acabara de salir de fábrica.

## Decision

El horómetro solo sube. El inicio del ciclo es otra marca: al dar de alta el equipo, el ciclo empieza en el horómetro con el que llega. Un mantenimiento guarda ese horómetro en el historial y mueve el inicio del ciclo hasta el horómetro actual. El equipo requiere mantenimiento cuando el horómetro alcanza el inicio del ciclo más el intervalo de su tipo. En el punto exacto, ya lo requiere.

Bajar el horómetro por debajo del inicio del ciclo vigente se rechaza.

## Alternatives

**Poner el horómetro en cero al mantener.** Descartado: borra la vida de la máquina. El historial tendría que reconstruir una cifra que el patio ya no tiene.

**Vencer contra un intervalo absoluto desde cero.** Descartado: un camión que llega con 1 200 horas y un intervalo de 250 entraría pidiendo mantenimiento. El corte de un ciclo de 250 horas, contado desde su llegada, es 1 450.

## Trade-offs

Se gana un historial que se puede leer y un alta que respeta las horas ya trabajadas. Se paga una marca más por equipo, y la disciplina de no editar el horómetro hacia atrás.

## Consequences

El estado no se guarda. Se calcula al leer. Cambiar el tipo cambia el intervalo al momento, y el mismo horómetro puede pasar a requerir mantenimiento si el intervalo nuevo ya se alcanzó.
