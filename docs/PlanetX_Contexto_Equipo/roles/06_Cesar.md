# César · Datos, control de calidad, BD y apoyo al frontend

Lee el [contexto general](../00_Contexto_General.md). Tu primera entrega es **una matriz de evidencia que permita elegir y verificar el caso real del visor**. Puedes trabajar desde Data Explorer, recortes locales y el contrato sintético; no esperes al lector de DeValle, a FastAPI ni a la UI.

| Arranque | Acuerdo |
| --- | --- |
| Rama | `cesar/f01-calidad-datos`. |
| Primera Issue | F01 · Muestras trazables y prueba de consistencia; ir llenando los cinco casos para F02. |
| Revisión | Alexis valida criterios científicos; DeValle comprueba consultas y modelo; Quintero convierte evidencia en aceptación; Santiago revisa avisos si colaboras en frontend. |
| Herramientas | Git/VS Code, Excel/CSV o scripts locales según convenga; Python, Astropy/NumPy, notebooks IRSA, pytest para QA. PostgreSQL/psql y Docker local si hay BD. React/TypeScript/pnpm si entra el componente. |

## Qué haces primero

1. **Haz la matriz de los cinco casos.** Barnard, Epsilon Indi B, WISE 0855, RW Aurigae y R Draconis. Para cada uno anota RA/Dec y catálogo/componente/época, fuente, centro/campo usado, cantidad de candidatos, épocas válidas, IDs, extremos de banda, motivos y estado. WISE 0855 usa la coordenada oficial de §3; valida la conversión. No rellenes el supuesto resultado con lo que sabes del objeto.
2. **Construye controles reproducibles.** Mira faltantes, alcance de cobertura, fechas UTC, duplicados entre colecciones, banda efectiva y máscara. Crea fixtures pequeños para: dos épocas, fecha repetida, una época, incompatibilidad espectral y ausencia; marca sintético en los archivos que lo sean. Reporta a Alexis qué caso tiene dos exposiciones comparables y a Isaac/Quintero cómo recrear el fallo. No descargues ni consultes masivamente el catálogo sin un motivo; cuantificar y seleccionar muestras es el trabajo de datos de P0.
3. **Apoya administración y consultas.** Si DeValle activa PostgreSQL, comprueba con tu base/rol de prueba que no hay IDs o claves repetidas, que referencias región/observación/producto son válidas y que los ordenamientos/fechas coinciden con el manifiesto. Deja consultas no destructivas y resultado. Si no hay SQL, corre verificaciones equivalentes al manifiesto JSON. No haces migraciones ni trabajas en RDS con credenciales de otro.
4. **Apoya la experiencia, sin duplicar el visor.** Si Santiago necesita un aviso para banda aproximada, respaldo preparado, máscara o visualización insuficiente, crea `DataNotice` en tu ruta, con props de solo lectura y texto revisado por Alexis y Quintero. Santiago lo monta. Si el aviso básico ya existe, dedica ese tiempo a evidencia real o más casos, no a rediseñar navegación.
5. **Cierra con QA conjunto.** Pasa la matriz con IDs/fechas/fuentes y versiones a Quintero; él valida lo observable y el flujo de usuario, tú la consistencia de los datos de la misma URL y SHA. Compara un recorte real con el archivo fuente. Si se ve un artefacto o no hay movimiento aparente, registra exactamente eso.

## Permisos de escritura

- `docs/qa/datos/**`, `fixtures/data_qa/**` y `api/tests/data_qa/**`.
- `web/src/features/data-notice/**`, solo para un componente pedido por Santiago.

**No edites** adaptador IRSA, algoritmo de Alexis, modelos/migraciones de DeValle, fixtures canónicos, componentes compartidos, Playwright de Quintero ni manifiestos de paquetes. Adjunta sugerencias con una consulta o un ejemplo. No subas FITS grandes, datos personales o archivos con credenciales.

## Verificación y salida

Con pytest/dependencias aprobadas: `.\.venv\Scripts\python.exe -m pytest api/tests/data_qa` (Windows) o `.venv/bin/python -m pytest api/tests/data_qa` (Linux). Verifica en la comparación publicada que las fechas y fuentes coinciden con la evidencia y que los casos negativos se clasifican bien. Si agregas UI, prueba aviso con props simuladas, teclado/lectura y `pnpm --dir web run build` con Santiago.

**Listo cuando:** el equipo puede escoger/declarar un caso por evidencia, están asentados los cinco intentos o sus pendientes reales, y la prueba de catálogo o del aviso de datos no requiere editar otro módulo. Para F02, completar los cinco intentos y señalar la razón de cualquier resultado negativo.

**Prompt para tu IA:** «Rol César, calidad de datos de F01/F02. Lee el general y esta guía. Una tarea activa y solo mis paths. Usa fixtures marcados o fuentes IRSA comprobables, no inventes fechas/IDs/resultados; preserva trazabilidad. Da consultas seguras de verificación y avisa a los dueños en vez de corregir módulos ajenos».
