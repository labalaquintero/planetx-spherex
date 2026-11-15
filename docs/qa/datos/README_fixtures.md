# Fixtures de Control de Calidad de Datos (`fixtures/data_qa/`) — Esquema JSON v1

**Rol responsable:** César (`cesar/f01-calidad-datos`)  
**Referencia normativa:** `docs/contexto/00_Contexto_General.md` (§3 y §5) y `docs/contexto/roles/06_Cesar.md`  
**Alcance:** Archivos JSON deterministas y sintéticos (`"mode": "fixture"`, `"release": "fixture"`, `"source_url": null`) diseñados exclusivamente para pruebas de control de calidad de datos (`data_qa`), validación de invariantes científicos/temporales y pruebas de regresión sin tocar los fixtures canónicos de Alexis en `web/src/contracts/fixtures/`.

---

## 1. Catálogo de Fixtures y Reglas del Contrato v1 Cubiertas

| Archivo en `fixtures/data_qa/` | `status` | `reason` | `band` | `frames` | Qué valida y qué regla del contrato v1 (§5) cubre |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `qa_01_dos_epocas_ready.json` | `"ready"` | `null` | `{"center_um": 2.03, "tolerance_um": 0.05}` | `2` | **Secuencia comparable lista para reproducción (A/B).** Valida: (1) entre 2 y 6 fotogramas ordenados estrictamente de forma cronológica creciente por `observed_at` UTC (`2025-05-16T22:56:23Z` < `2026-05-13T05:55:57Z`); (2) misma banda aproximada con `center_um > 0` y `tolerance_um > 0`; (3) `query.fov_deg = 0.1` en marco `ICRS`; (4) `image_url` apuntando al mismo origen (`/api/v1/images/...`). Inspirado en las coordenadas ICRS verificadas de **R Draconis**. |
| `qa_02_fecha_repetida_dedup.json` | `"insufficient"` | `"single_epoch"` | `{"center_um": 1.25, "tolerance_um": 0.02}` | `1` | **Deduplicación de fecha/visita repetida.** Documenta y valida la salida esperada cuando la consulta cruda devuelve dos registros de la misma exposición/visita o duplicados entre colecciones/publicaciones con el mismo instante UTC (`2025-08-15T20:45:11Z`): tras deduplicar por observación independiente (§3.1), queda **1 sola época válida**, por lo que el servicio debe degradar a `status: "insufficient"` y `reason: "single_epoch"`, entregando el único fotograma consolidado sin habilitar el reproductor temporal. |
| `qa_03_una_epoca_insufficient.json` | `"insufficient"` | `"single_epoch"` | `{"center_um": 0.93, "tolerance_um": 0.02}` | `1` | **Única observación válida en la región.** Valida la regla de §5 para `insufficient` con `single_epoch`: se conserva como máximo `1` fotograma verificable con su `band` efectiva (`center_um: 0.93, tolerance_um: 0.02`) para visualización estática individual, pero sin permitir comparación A/B ni reproducción. |
| `qa_04_incompatibilidad_espectral.json` | `"insufficient"` | `"no_common_band"` | `null` | `0` (`[]`) | **Incompatibilidad espectral entre épocas.** Cubre el caso en que existen exposiciones en fechas UTC distintas pero ninguna pareja comparte longitud de onda efectiva dentro de la tolerancia acordada (§3.3 y §5). Cuando no hay grupo espectral comparable, el contrato exige `status: "insufficient"`, `reason: "no_common_band"`, `band: null` y `frames: []` (nunca mezclar bandas incompatibles como si fueran comparables). |
| `qa_05_sin_cobertura.json` | `"no_coverage"` | `"no_observations"` | `null` | `0` (`[]`) | **Ausencia de observaciones en el ámbito consultado.** Inspirado directamente en la ausencia verificada de **WISE 0855** (`ra_deg: 133.795129, dec_deg: -7.245147`) en la colección `spherex_qr3` (`docs/qa/datos/matriz_5_casos.md`). Valida que una consulta espacial válida sin exposiciones devuelva `200 OK` con `status: "no_coverage"`, `reason: "no_observations"`, `band: null` y `frames: []`, diferenciándose de un error `503` de servicio. |

---

## 2. Invariantes del Esquema JSON v1 Verificados en los 5 Archivos

1. **Trazabilidad de prueba sintética:** Todos los archivos declaran explícitamente `"schema_version": "1"`, `"mode": "fixture"`, `"science_version": "v1"` y, cuando contienen fotogramas, `"release": "fixture"` y `"source_url": null`, cumpliendo §3.5 y §5 (nunca presentar un fixture sintético como captura real de NASA/IRSA).
2. **Coordenadas y campo estándar:** Todos los objetos `query` cumplen `0 <= ra_deg < 360`, `-90 <= dec_deg <= 90`, `"frame": "ICRS"` y `"fov_deg": 0.1`.
3. **Coherencia entre `band` y `frames`:**
   - Cuando `frames` tiene elementos (`qa_01`, `qa_02`, `qa_03`), `band` es un objeto con `center_um > 0` y `tolerance_um > 0`.
   - Cuando `frames` es vacío (`qa_04`, `qa_05`), `band` es estrictamente `null`.
4. **Rutas de imagen del mismo origen:** Cada fotograma utiliza `image_url` con formato `/api/v1/images/<frame_id>`, donde `<frame_id>` coincide con `frame.id`.

---

## 3. Guía de Uso por Rol (Sin Alterar Fixtures Canónicos)

Los fixtures canónicos de contrato en `web/src/contracts/fixtures/` pertenecen únicamente a **Alexis**. Los archivos de `fixtures/data_qa/` se consumen en modo solo lectura desde las pruebas de cada módulo:

### Para Alexis (`alexis/f01-ciencia` — `api/tests/science/**`)
- **Deduplicación y filtro espectral:** Puedes cargar `qa_01_dos_epocas_ready.json`, `qa_02_fecha_repetida_dedup.json` y `qa_04_incompatibilidad_espectral.json` como oráculos de salida esperada para verificar que `planetx.science.build_sequence()`:
  1. Ordena fotogramas por `observed_at` ascendente (`qa_01`).
  2. Colapsa exposiciones duplicadas del mismo instante UTC en un único fotograma y degrada el estado a `insufficient` / `single_epoch` (`qa_02`).
  3. Rechaza pares con distinta longitud de onda efectiva devolviendo `insufficient` / `no_common_band` con `band: null` y `frames: []` (`qa_04`).

### Para Isaac (`isaac/f01-api` — `api/tests/http/**`)
- **Serialización HTTP y respuestas `200` por estado de negocio:** En tus pruebas de `GET /api/v1/comparisons`, puedes inyectar estos 5 payloads desde `Path("fixtures/data_qa/...")` mediante `monkeypatch` o dependencias de FastAPI para validar que el router serializa sin pérdida los tres estados HTTP `200` (`ready`, `insufficient` con 1 o 0 fotogramas, y `no_coverage`) y respeta las rutas `/api/v1/images/{frame_id}` del mismo origen.

### Para Quintero (`quintero/f01-aceptacion` — `web/e2e/**`)
- **Interceptación en Playwright (`page.route`):** En las pruebas E2E puedes interceptar `**/api/v1/comparisons*` y responder directamente con cualquiera de los 5 archivos desde `../fixtures/data_qa/*.json` sin tocar `web/src/contracts/fixtures/`:
  - `qa_01_dos_epocas_ready.json`: verificar que el reproductor A/B se habilita, muestra las 2 épocas en UTC y etiqueta el modo de prueba.
  - `qa_02_fecha_repetida_dedup.json` y `qa_03_una_epoca_insufficient.json`: verificar que con 1 solo fotograma se muestra la imagen estática, el motivo `single_epoch` es legible y los controles Play/A-B permanecen deshabilitados.
  - `qa_04_incompatibilidad_espectral.json`: verificar el mensaje explicativo cuando no existe banda común comparable (`no_common_band`).
  - `qa_05_sin_cobertura.json`: verificar el estado visual de ausencia de observaciones en la región consultada (`no_observations`).
