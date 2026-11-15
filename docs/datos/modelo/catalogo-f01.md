# Catálogo de casos preparados (F01) · Frontera y modelo de datos

**Responsable:** DeValle · **Rama:** `devalle/catalog-hardening-validation` · **Contrato:** Comparación v1 (`schema_version: "1"`).

## 1. Frontera de integración para API (`Isaac`)

```python
from planetx.catalog import get_prepared, CatalogIntegrityError, InvalidCatalogQueryError

payload = get_prepared(
    ra_deg=133.795129166667,
    dec_deg=-7.245147222222,
    fov_deg=0.1,
    science_version="v1",
)
```

* **Configuración por entorno:** `PLANETX_CATALOG_MANIFEST` (ruta al `manifest.json`) y `PLANETX_PRODUCTS_DIR` (directorio con `<frame_id>.png`). Si no hay manifiesto configurado, `get_prepared()` devuelve `None` sin fallar.
* **Coincidencia exacta:** índice por `(ra_deg, dec_deg, fov_deg, science_version)`. Nunca aproxima coordenadas vecinas.
* **Diferenciación de errores:**
  * `None`: región ausente o entrada revocada (`"revoked": true` / `"active": false`).
  * `InvalidCatalogQueryError`: parámetros fuera de rango o no finitos (`422` en HTTP).
  * `CatalogIntegrityError` (`ManifestNotFoundError`, `ManifestCorruptError`, `MissingProductError`): fallo explícito de integridad en despliegue o storage (`500`/`503` interno, nunca falso `no_coverage`).

## 2. Invariantes de calidad para validación (`César`)

1. **Clave única de región/versión:** no se permiten dos entradas en `entries` con la misma tupla `(ra_deg, dec_deg, fov_deg, science_version)`.
2. **Orden e identidad de épocas:** `frames` exige orden estricto `observed_at` UTC (`t_0 < t_1`), `id` único por producto derivado y `observation_id` único por secuencia (evita duplicar la misma visita).
3. **Revocación trazable:** para invalidar un caso sin perder historial, marcar `"revoked": true` o `"active": false` en la entrada del manifiesto.
4. **Integridad de productos:** cada `frame.id` debe existir como `<frame_id>.png` no vacío en storage antes de exponer el manifiesto.
5. **Formato de `frame.id`:** debe cumplir la expresión regular `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` (entre 1 y 128 caracteres; empieza con alfanumérico; el resto admite letras, dígitos, punto, guión bajo y guión medio; sin espacios, barras ni caracteres especiales). Esta regla está alineada con `FRAME_ID_RE` del módulo HTTP (`planetx.http.images`) para garantizar que todo `frame_id` emitido por `get_prepared()` sea directamente servible por `/api/v1/images/<frame_id>` sin conversión ni rechazo.
6. **Fechas UTC estrictas y coherencia temporal:** tanto `checked_at` como cada `observed_at` deben cumplir la expresión regular estricta `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$` (separador obligatorio `T`, sufijo `Z` y hasta 6 dígitos de microsegundos opcionales; se rechazan separadores con espacio, fechas sin hora u offsets numéricos como `+00:00` o `+02:00`). Asimismo, todo fotograma debe cumplir `observed_at <= checked_at` (no puede haberse observado después de la verificación del catálogo).
7. **Procedencia estricta (`release`, `source_url`, `observation_id`):**
   * `observation_id`: debe cumplir `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` (sin espacios ni símbolos de control).
   * En fotogramas con `release` oficial (`"dr1"`, `"qr3"`), `source_url` es obligatorio y debe ser una URL `https://` válida con host (netloc) no vacío.
   * En fotogramas con `release == "fixture"`, `source_url` puede ser `None` o una URL `http://` / `https://` válida (se rechazan esquemas no soportados como `ftp://` o URLs malformadas).
8. **Versionado estricto (`schema_version`, `science_version`):**
   * `science_version`: debe cumplir `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` (entre 1 y 64 caracteres, sin espacios al inicio/final ni símbolos no permitidos) tanto al consultarse en `get_prepared()` (`InvalidCatalogQueryError` ante valor inválido) como en cada entrada del manifiesto (`ManifestCorruptError`).
   * Si la raíz del manifiesto JSON declara `schema_version`, este debe ser exactamente `"1"`.

## 3. Ficha técnica oficial — Caso preparado WISE 0855

### 3.1 Coordenadas exactas obligatorias
* **`ra_deg`:** `133.795129166667`
* **`dec_deg`:** `-7.245147222222`
* **`fov_deg`:** `0.1`
* **`science_version`:** `"v1"`

> [!WARNING]
> **Advertencia para Frontend (`Santiago`) y QA/E2E (`Quintero`):**
> La coincidencia numérica en `get_prepared()` es estricta y exacta (punto flotante exacto). Redondear estas coordenadas a 6 decimales (`133.795129`, `-7.245147`) provocará un fallo de coincidencia (`None`), desviando la solicitud hacia el flujo de ciencia en vivo (`LiveGate` / IRSA). Los presets de la UI y los fixtures de prueba E2E deben utilizar obligatoriamente los valores de alta precisión indicados arriba.

### 3.2 Parámetros espectrales (Banda común)
* **`center_um`:** `0.9928165220816996`
* **`tolerance_um`:** `0.012909112710767471`

### 3.3 Fotogramas preparados (DR1)

| Época | `observation_id` | `observed_at` (UTC) | `id` (Hash SHA-256 de 64 caracteres) | `quality_flags` |
|---|---|---|---|---|
| 1 | `2025W19_1B_0241_1` | `2025-05-06T12:20:24.888Z` | `c80d7aae12e197e3f2678239871ca47d198813c567550ff12549b7cc6feddb9c` | `["masked_pixels"]` |
| 2 | `2025W44_2B_0322_1` | `2025-10-31T18:55:38.358Z` | `ec0f084def6975d7ddaac0af157ec0f0df5dbf01f46e183461939d8af33c4033` | `["masked_pixels"]` |

* Ambos fotogramas pertenecen al release `dr1`.
* Las URLs canónicas de imagen son `/api/v1/images/<id>`.

### 3.4 Recordatorio operativo de despliegue y almacenamiento
Los productos binarios PNG (`<frame_id>.png`) y el archivo de manifiesto `manifest.json` oficial de producción residen **fuera del repositorio Git**. Se resuelven en runtime a través de las variables de entorno:
* `PLANETX_CATALOG_MANIFEST`: ruta absoluta al archivo `manifest.json`.
* `PLANETX_PRODUCTS_DIR`: directorio que aloja los archivos `.png` derivados.

## 4. Evolución opcional a PostgreSQL (si se activa tras F01)

Si el equipo decide activar RDS/PostgreSQL en un corte posterior, la misma frontera `get_prepared()` se mantiene intacta respaldada por tres entidades en 3FN:

* `prepared_regions(id, ra_deg, dec_deg, frame, fov_deg, science_version, status, reason, band_center_um, band_tolerance_um, checked_at, is_active)` con `UNIQUE(ra_deg, dec_deg, fov_deg, science_version)`.
* `source_observations(id, observation_id, release, observed_at, source_url)` con `UNIQUE(release, observation_id)` y `TIMESTAMPTZ`.
* `derived_frames(id, region_id, source_observation_id, frame_id, frame_order, storage_key, quality_flags)` con `UNIQUE(frame_id)` y `UNIQUE(region_id, frame_order)`.
