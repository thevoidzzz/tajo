# Tajo

El patio donde el encargado ve los equipos del tajo y el ciclo de mantenimiento de cada uno.

## Language

**Equipo**:
Una máquina del tajo identificada por un código.
_Avoid_: activo, unidad, vehículo

**Código**:
La identificación que el patio le da a un equipo.
_Avoid_: placa, tag

**Tipo**:
Camión, excavadora o perforadora.
_Avoid_: clase, categoría

**Horómetro**:
Las horas de uso acumuladas de un equipo. No vuelve a cero.
_Avoid_: odómetro, contador

**Intervalo**:
Las horas que dura un ciclo para un tipo.
_Avoid_: frecuencia, periodo

**Ciclo**:
El tramo de horas desde el inicio del ciclo hasta el corte de mantenimiento.
_Avoid_: vuelta, turno

**Inicio del ciclo**:
El horómetro en el que empezó el ciclo vigente.
_Avoid_: baseline, reset

**Mantenimiento**:
Un evento que deja constancia del horómetro y abre un ciclo nuevo.
_Avoid_: servicio, reparación

**Requiere mantenimiento**:
El estado de un equipo cuyo horómetro ya alcanzó el corte del ciclo.
_Avoid_: vencido, alerta

**Al día**:
El estado de un equipo que todavía no alcanza el corte del ciclo.
_Avoid_: operativo, disponible

**Patio**:
El conjunto de equipos que el encargado tiene a la vista.
_Avoid_: flota, inventario
