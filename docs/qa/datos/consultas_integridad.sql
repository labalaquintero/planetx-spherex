-- =============================================================================
-- Planet X / SPHEREx · Consultas de Integridad del Catálogo Relacional (F01)
-- Rol: César (Calidad de datos, consultas de control y auditoría QA)
-- Rama: cesar/f01-calidad-datos
-- Esquema objetivo: 3FN definido en docs/datos/modelo/catalogo-f01.md
--   - prepared_regions(id, ra_deg, dec_deg, frame, fov_deg, science_version,
--                      status, reason, band_center_um, band_tolerance_um,
--                      checked_at, is_active)
--   - source_observations(id, observation_id, release, observed_at, source_url)
--   - derived_frames(id, region_id, source_observation_id, frame_id,
--                    frame_order, storage_key, quality_flags)
--
-- SEGURIDAD: Exclusivamente consultas SELECT de solo lectura (no destructivas).
-- Todas las consultas de control deben devolver 0 filas cuando el catálogo es íntegro.
-- =============================================================================

-- 0. Comprobación básica de conectividad de sesión
SELECT 1 AS conexion_ok;

-- =============================================================================
-- 1. DETECCIÓN DE DUPLICADOS (CLAVES DE REGIÓN, OBSERVATION_ID Y FRAME_ID)
-- =============================================================================

-- 1a. Regiones preparadas duplicadas para la misma tupla (ra_deg, dec_deg, fov_deg, science_version)
SELECT
    ra_deg,
    dec_deg,
    fov_deg,
    science_version,
    COUNT(*) AS total_duplicados
FROM prepared_regions
GROUP BY ra_deg, dec_deg, fov_deg, science_version
HAVING COUNT(*) > 1;

-- 1b. Identificadores de fotograma derivado (frame_id) duplicados en derived_frames
SELECT
    frame_id,
    COUNT(*) AS total_duplicados
FROM derived_frames
GROUP BY frame_id
HAVING COUNT(*) > 1;

-- 1c. Observaciones fuente duplicadas por (release, observation_id) en source_observations
SELECT
    release,
    observation_id,
    COUNT(*) AS total_duplicados
FROM source_observations
GROUP BY release, observation_id
HAVING COUNT(*) > 1;

-- 1d. Misma observación fuente (observation_id) repetida dentro de una misma región/secuencia
SELECT
    df.region_id,
    so.observation_id,
    COUNT(*) AS veces_en_secuencia
FROM derived_frames AS df
INNER JOIN source_observations AS so
    ON so.id = df.source_observation_id
GROUP BY df.region_id, so.observation_id
HAVING COUNT(*) > 1;

-- 1e. Posición de orden (frame_order) repetida dentro de la misma región
SELECT
    region_id,
    frame_order,
    COUNT(*) AS orden_duplicado
FROM derived_frames
GROUP BY region_id, frame_order
HAVING COUNT(*) > 1;

-- =============================================================================
-- 2. VALIDACIÓN DE RANGOS ICRS Y GEOMETRÍA DE CONSULTA
-- =============================================================================

-- 2a. Coordenadas fuera de rango ICRS [0, 360) y [-90, 90], valores NaN/Inf o fov_deg inválido
SELECT
    id AS region_id,
    ra_deg,
    dec_deg,
    frame,
    fov_deg,
    science_version
FROM prepared_regions
WHERE ra_deg IS NULL
   OR dec_deg IS NULL
   OR fov_deg IS NULL
   OR ra_deg IN ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)
   OR dec_deg IN ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)
   OR fov_deg IN ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)
   OR ra_deg < 0.0
   OR ra_deg >= 360.0
   OR dec_deg < -90.0
   OR dec_deg > 90.0
   OR fov_deg <= 0.0
   OR frame <> 'ICRS';

-- =============================================================================
-- 3. INTEGRIDAD REFERENCIAL Y COHERENCIA DE ESTADOS (READY / INSUFFICIENT / NO_COVERAGE)
-- =============================================================================

-- 3a. Fotogramas huérfanos sin región padre o sin observación fuente válida
SELECT
    df.id AS derived_frame_pk,
    df.frame_id,
    df.region_id,
    df.source_observation_id
FROM derived_frames AS df
LEFT JOIN prepared_regions AS pr
    ON pr.id = df.region_id
LEFT JOIN source_observations AS so
    ON so.id = df.source_observation_id
WHERE pr.id IS NULL
   OR so.id IS NULL;

-- 3b. Secuencias con status = 'ready' que tienen menos de 2 épocas UTC distintas,
--     más de 6 fotogramas, o reason distinto de NULL
SELECT
    pr.id AS region_id,
    pr.ra_deg,
    pr.dec_deg,
    pr.status,
    pr.reason,
    COUNT(df.id) AS total_frames,
    COUNT(DISTINCT so.observed_at) AS epocas_utc_distintas
FROM prepared_regions AS pr
LEFT JOIN derived_frames AS df
    ON df.region_id = pr.id
LEFT JOIN source_observations AS so
    ON so.id = df.source_observation_id
WHERE pr.status = 'ready'
GROUP BY pr.id, pr.ra_deg, pr.dec_deg, pr.status, pr.reason
HAVING pr.reason IS NOT NULL
    OR COUNT(df.id) < 2
    OR COUNT(df.id) > 6
    OR COUNT(DISTINCT so.observed_at) < 2
    OR COUNT(DISTINCT so.observed_at) <> COUNT(df.id);

-- 3c. Secuencias con status = 'insufficient' con reason inválido o más de 1 fotograma
SELECT
    pr.id AS region_id,
    pr.status,
    pr.reason,
    COUNT(df.id) AS total_frames
FROM prepared_regions AS pr
LEFT JOIN derived_frames AS df
    ON df.region_id = pr.id
WHERE pr.status = 'insufficient'
GROUP BY pr.id, pr.status, pr.reason
HAVING pr.reason IS NULL
    OR pr.reason NOT IN ('single_epoch', 'no_common_band', 'no_usable_frames', 'search_limit_reached')
    OR COUNT(df.id) > 1;

-- 3d. Secuencias con status = 'no_coverage' que no tienen reason = 'no_observations'
--     o que contienen fotogramas asociados
SELECT
    pr.id AS region_id,
    pr.status,
    pr.reason,
    COUNT(df.id) AS total_frames
FROM prepared_regions AS pr
LEFT JOIN derived_frames AS df
    ON df.region_id = pr.id
WHERE pr.status = 'no_coverage'
GROUP BY pr.id, pr.status, pr.reason
HAVING pr.reason IS DISTINCT FROM 'no_observations'
    OR COUNT(df.id) > 0;

-- =============================================================================
-- 4. VERIFICACIÓN DE ORDEN CRONOLÓGICO (OBSERVED_AT) Y CONSISTENCIA DE BANDA
-- =============================================================================

-- 4a. Violaciones al orden cronológico estricto (observed_at <= época previa según frame_order)
WITH secuencia_ordenada AS (
    SELECT
        df.region_id,
        df.frame_id,
        df.frame_order,
        so.observed_at,
        LAG(so.observed_at) OVER (
            PARTITION BY df.region_id
            ORDER BY df.frame_order ASC
        ) AS prev_observed_at
    FROM derived_frames AS df
    INNER JOIN source_observations AS so
        ON so.id = df.source_observation_id
)
SELECT
    region_id,
    frame_id,
    frame_order,
    prev_observed_at,
    observed_at
FROM secuencia_ordenada
WHERE prev_observed_at IS NOT NULL
  AND observed_at <= prev_observed_at;

-- 4b. Inconsistencia de parámetros espectrales (band_center_um y band_tolerance_um):
--     - Si hay fotogramas (> 0), ambos deben ser no nulos y estrictamente positivos (> 0).
--     - Si no hay fotogramas (= 0), ambos deben ser NULL.
SELECT
    pr.id AS region_id,
    pr.status,
    pr.band_center_um,
    pr.band_tolerance_um,
    COUNT(df.id) AS total_frames
FROM prepared_regions AS pr
LEFT JOIN derived_frames AS df
    ON df.region_id = pr.id
GROUP BY pr.id, pr.status, pr.band_center_um, pr.band_tolerance_um
HAVING (
    COUNT(df.id) > 0
    AND (
        pr.band_center_um IS NULL
        OR pr.band_tolerance_um IS NULL
        OR pr.band_center_um <= 0.0
        OR pr.band_tolerance_um <= 0.0
    )
)
OR (
    COUNT(df.id) = 0
    AND (
        pr.band_center_um IS NOT NULL
        OR pr.band_tolerance_um IS NOT NULL
    )
);
