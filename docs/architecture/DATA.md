# DATA — Equipos y ciclos

Estado: Aprobada
Fecha: 2026-11-11

## Intervalos de esta versión

Son la política de esta versión. No son una ficha de fabricante. Viven en la tabla del tipo.

| Tipo | Código guardado | Intervalo |
| --- | --- | --- |
| Camión | `camion` | 250 h |
| Excavadora | `excavadora` | 500 h |
| Perforadora | `perforadora` | 200 h |

El código guardado no lleva tilde. El patio dice camión.

## Equipo

Un equipo tiene código único, tipo, horómetro e inicio del ciclo. Las horas son enteras y no negativas. El horómetro es mayor o igual que el inicio del ciclo.

Al darlo de alta, el inicio del ciclo es el horómetro con el que llega. Un camión que llega con 1 200 horas tiene el corte en 1 450. Uno que llega en 0 lo tiene en 250.

## Estado

No se guarda. Al leer:

- **Requiere mantenimiento** cuando el horómetro es mayor o igual que el inicio del ciclo más el intervalo.
- **Al día** en cualquier hora anterior.

Cambiar el tipo cambia el intervalo en la siguiente lectura. 220 horas de ciclo con un intervalo de 200 ya requieren mantenimiento.

## Mantenimiento

Una fila por evento: el equipo y el horómetro en el que se registró. Se registra al horómetro actual, no a una hora elegida. Después, el inicio del ciclo pasa a ser ese horómetro y el estado vuelve a Al día. El horómetro no cambia.

Borrar un equipo borra su historial.

## Migraciones

Archivos SQL en orden. Una tabla recuerda cuáles ya se aplicaron. Solo agregan. [ADR-0003](../adr/0003-la-migracion-solo-agrega.md).
