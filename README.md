# Tajo

Registro de equipos de un tajo. Cada equipo tiene código, tipo y horómetro. Cuando el horómetro alcanza el intervalo de su tipo desde el inicio del ciclo, el patio lo muestra como **Requiere mantenimiento**.

Un mantenimiento deja historial y abre un ciclo nuevo. El horómetro no vuelve a cero.

La página y la API se publican por separado. El diseño del patio, del ciclo y de la publicación está en los documentos.

## Documentos

- [Glosario](GLOSSARY.md)
- [Arquitectura](docs/architecture/ARCHITECTURE.md)
- [Criterio de cada pieza](docs/architecture/STACK.md)
- [Datos](docs/architecture/DATA.md)
- [ADR](docs/adr/README.md)

## Herramientas

Este repositorio se escribe con Cursor. Quien lo mantiene tiene que poder explicar el ciclo, la API y, cuando exista, el comando de despliegue.

## Cambios

Un cambio entra por pull request contra `main`. El check `test` tiene que pasar antes del merge cuando el workflow ya esté en el repositorio.
