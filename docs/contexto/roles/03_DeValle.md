# DeValle · Catálogo, bases de datos y panel de observación

Lee el [contexto general](../00_Contexto_General.md). Tu primera entrega es **que Isaac pueda recuperar una comparación preparada con sus fechas y fuentes**. Puedes empezar con un manifiesto local y una interfaz de lectura; no hace falta RDS para contribuir a F01. Tu segunda área es mejorar la lectura de los metadatos junto a Santiago.

| Arranque | Acuerdo |
| --- | --- |
| Rama | `devalle/f01-catalogo`. Mantén la tarea de catálogo y la de UI en PRs separados si se ejecutan. |
| Primera Issue | F01 · Lector `get_prepared()`, manifiesto de prueba y validación de integridad del replay. |
| Revisión | Isaac prueba integración; César revisa claves y consultas; Santiago evalúa el panel si se necesita. |
| Herramientas | Python/pytest y JSON; PostgreSQL, SQLAlchemy, Alembic, psycopg y Docker Compose si se activa la implementación SQL; React/TypeScript/pnpm si tomas el panel. |

## Qué haces primero

1. **Alinea la frontera con Isaac.** `planetx.catalog.get_prepared()` toma centro/ángulo/versión y devuelve payload `prepared` compatible con el contrato o `None`. Diferencia ausencia de una entrada de un manifiesto roto o imagen ausente. Acuerda ubicación local y storage; no escribas el adaptador S3 ni el router de Isaac. El lector no inventa una secuencia para la región más cercana.
2. **Empieza con datos de prueba.** Construye el lector JSON con un caso chico en tu carpeta de tests: región exacta, fechas, orden, IDs, existencia de productos y procedencia. El mock puede tener los campos del contrato canónico sin convertirse en un segundo contrato. Coteja con César duplicados, referencias, índice de versiones y formas de invalidar un registro. En producción se reemplaza con el manifiesto y productos de un par real aprobado.
3. **Deja la opción relacional lista para decidir.** Si SQL es útil y cabe, modela **región** (centro ICRS/campo), **observación** (fuente/release/ID/instante) y **producto comparado** (región, tiempo, banda y versión/identidad de render). Separa identidad de observación y PNG derivado; usa tiempos con zona y claves únicas/índice de consulta temporal. Deja una migración inicial y un modelo probado solo si el equipo activa esta vía. No anticipes tablas de usuarios, blog ni badges. Isaac administra el acceso/infra; César hace consultas de control y validación local. No se corre Alembic en una BD compartida/de producción sin coordinación.
4. **Apoya UI dentro de tu componente.** Si Santiago lo solicita, ofrece un `ObservationDetails` en tu carpeta; props de solo lectura para fecha UTC, banda, fuente/ID/avisos. Úsalo sobre un fixture aislado. Asegura etiquetas, jerarquía y legibilidad en móvil. Santiago decide y realiza el montaje; no dupliques el visor ni edites rutas web comunes.

## Permisos de escritura

- `api/planetx/catalog/**` · `api/migrations/**` · `api/alembic.ini` · `api/tests/catalog/**` · `docs/datos/modelo/**`.
- `web/src/features/observation-details/**`, **solo** si la Issue incluye ese componente.

**Deja a sus dueños** `api/app.py`, dependencias Python, Compose, configuración de la app, fixtures canónicos, ciencia, matriz de César, rutas de Santiago y config de pnpm. Si necesitas un paquete, pide a Isaac o Santiago el cambio de manifiesto. Si PostgreSQL no está accesible, continúa con el lector y deja el esquema como nota o issue posterior.

## Verificación y salida

Con la `.venv` de §7: `.\.venv\Scripts\python.exe -m pytest api/tests/catalog` (Windows) o `.venv/bin/python -m pytest api/tests/catalog` (Linux). Prueba encontrado y no encontrado, orden e IDs únicos, vínculo a producto y error explícito ante archivo faltante. Si se activó SQL: levanta una BD desechable, verifica `SELECT 1` y aplica/valida la migración en esa BD según la configuración existente; entrega también una consulta que demuestre la equivalencia con el manifiesto. Para el panel, usa `pnpm --dir web run build` y el script unitario disponible, junto a revisión visual.

**Listo cuando:** Isaac llama tu interfaz con la región del fixture sin copiar tu lógica, César puede verificar la consistencia y el replay real solo cambia la fuente de datos. Si sale el panel, el PR incluye un ejemplo de props y evidencia de teclado/lectura.

**Prompt para tu IA:** «Rol DeValle, Issue F01 catálogo o Issue específica del panel. Lee el general y esta guía. Usa el contrato v1; el dueño integra tu lector/componente. No edites entrypoints, Compose, requirements, archivos web comunes, fixtures canónicos o scripts de terceros. Prioriza el manifiesto local y deja evidencia de integridad. Cualquier cambio de esquema compartido se propone en la Issue».
