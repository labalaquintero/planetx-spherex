# Catálogo de casos preparados (F01) · Frontera y modelo de datos

**Responsable:** DeValle · **Rama:** `devalle/f01-catalogo` · **Contrato:** Comparación v1 (`schema_version: "1"`).

## 1. Frontera de integración para API (`Isaac`)

```python
from planetx.catalog import get_prepared, CatalogIntegrityError, InvalidCatalogQueryError

payload = get_prepared(
    ra_deg=133.795129,
    dec_deg=-7.245147,
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

## 3. Evolución opcional a PostgreSQL (si se activa tras F01)

Si el equipo decide activar RDS/PostgreSQL en un corte posterior, la misma frontera `get_prepared()` se mantiene intacta respaldada por tres entidades en 3FN:

* `prepared_regions(id, ra_deg, dec_deg, frame, fov_deg, science_version, status, reason, band_center_um, band_tolerance_um, checked_at, is_active)` con `UNIQUE(ra_deg, dec_deg, fov_deg, science_version)`.
* `source_observations(id, observation_id, release, observed_at, source_url)` con `UNIQUE(release, observation_id)` y `TIMESTAMPTZ`.
* `derived_frames(id, region_id, source_observation_id, frame_id, frame_order, storage_key, quality_flags)` con `UNIQUE(frame_id)` y `UNIQUE(region_id, frame_order)`.
