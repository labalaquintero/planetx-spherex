# Matriz de Evidencia Real en IRSA SIA2 — 5 Casos del Reto (Planet X / SPHEREx)

**Rol:** César (Calidad de datos, consultas y apoyo QA)  
**Servicio consultado:** `https://irsa.ipac.caltech.edu/SIA` ( protocolo IVOA SIAv2 )  
**Colecciones evaluadas:** `spherex_dr1`, `spherex_qr3`  
**Geometría de búsqueda:** Campo de `0.10° × 0.10°` (`POS=CIRCLE <ra> <dec> 0.071`)  
**Script reproducible:** `docs/qa/datos/consultar_irsa_5_casos.py`  
**Evidencia cruda:** `docs/qa/datos/evidencia_cruda_irsa.csv` (2,119 registros totales; 2,118 exposiciones FITS reales `calib_level=2` + 1 registro `no_observations` para WISE 0855 en `spherex_qr3`)

---

## 1. Coordenadas ICRS Resueltas y Fuente de Catálogo

| Caso | Objeto | Identificador de consulta | RA ICRS (°) | Dec ICRS (°) | Fuente / Catálogo |
| :--- | :--- | :--- | ---: | ---: | :--- |
| **a** | Estrella de Barnard | `Barnard's Star` | `269.452077` | `+4.693365` | CDS Sesame / SIMBAD (`SkyCoord.from_name("Barnard's Star")`, Gaia DR3 / ICRS J2000) |
| **b** | Epsilon Indi B | `eps Ind B` | `331.044147` | `-56.782844` | CDS Sesame / SIMBAD (`SkyCoord.from_name("eps Ind B")`, entrada SIMBAD `* eps Ind B` / Scholz et al. 2003 / Gaia-2MASS ICRS) |
| **c** | WISE 0855 | `08h55m10.831s, -07d14m42.53s` | `133.795129` | `-7.245147` | Posición oficial fija del reto en marco ICRS (`WISE J085510.83-071442.5`) |
| **d** | RW Aurigae | `RW Aur` | `76.956526` | `+30.401438` | CDS Sesame / SIMBAD (`SkyCoord.from_name("RW Aur")`, Gaia DR3 / ICRS) |
| **e** | R Draconis | `R Dra` | `248.167611` | `+66.754979` | CDS Sesame / SIMBAD (`SkyCoord.from_name("R Dra")`, Gaia DR3 / ICRS) |

---

## 2. Metodología de Deduplicación y Clasificación

1. **Estructura por exposición en SPHEREx Level 2 (`l2b`):** Cada `obs_id` (ej. `2025W33_2C_0321_1`) toma simultáneamente dos detectores dicróicos (pares `D1+D4`, `D2+D5` o `D3+D6`), generando 2 filas `image/fits` con el mismo `obs_id` y `t_min`, pero diferente banda (`energy_bandpassname`, `em_min`, `em_max`).
2. **Deduplicación temporal y espectral:**
   - **Por exposición/banda:** clave única `(obs_collection, obs_id, energy_bandpassname)`.
   - **Por época exacta UTC (`t_min_utc`):** conversión de `t_min` (MJD UTC) a ISO-8601 UTC mediante `astropy.time.Time(..., format='mjd', scale='utc')`.
   - **Por día calendario UTC (`YYYY-MM-DD`):** para verificar separación multi-época real (meses/semanas de línea base, no solo dithers consecutivos de la misma órbita).
3. **Bandas espectrales SPHEREx detectadas en SIA2 (`em_min` – `em_max` en micrómetros):**
   - `SPHEREx-D1`: `0.7455 – 1.1167 µm`
   - `SPHEREx-D2`: `1.1033 – 1.6499 µm`
   - `SPHEREx-D3`: `1.6301 – 2.4346 µm`
   - `SPHEREx-D4`: `2.4027 – 3.8473 µm`
   - `SPHEREx-D5`: `3.8113 – 4.4300 µm`
   - `SPHEREx-D6`: `4.4115 – 5.0096 µm`

---

## 3. Matriz Resumen de Clasificación por Caso y Colección

| Objeto | Colección | Filas FITS (`image/fits`) | `obs_id` únicos | Épocas `t_min_utc` únicas | Días UTC distintos | Rango temporal UTC | Bandas con ≥ 2 épocas | Clasificación por colección | Clasificación global del caso |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- | :--- | :--- | :--- |
| **Estrella de Barnard** | `spherex_dr1` | 259 | 132 | 133 | 29 | `2025-08-15` a `2026-05-05` | `D1..D6` (0.7455–5.0096 µm) | `verificado` | **`verificado`** |
| **Estrella de Barnard** | `spherex_qr3` | 128 | 64 | 64 | 15 | `2026-08-16` a `2026-09-22` | `D1..D6` (0.7455–5.0096 µm) | `verificado` | **`verificado`** |
| **Epsilon Indi B** | `spherex_dr1` | 371 | 195 | 195 | 50 | `2025-04-24` a `2026-05-04` | `D1..D6` (0.7455–5.0096 µm) | `verificado` | **`verificado`** |
| **Epsilon Indi B** | `spherex_qr3` | 120 | 60 | 60 | 10 | `2026-09-22` a `2026-10-02` | `D2, D3, D5, D6` (1.1033–5.0096 µm) | `verificado` | **`verificado`** |
| **WISE 0855** | `spherex_dr1` | 297 | 150 | 151 | 28 | `2025-05-05` a `2026-05-14` | `D1..D6` (0.7455–5.0096 µm) | `verificado` | **`verificado`** (solo en `spherex_dr1`) |
| **WISE 0855** | `spherex_qr3` | 0 | 0 | 0 | 0 | Sin registros | Ninguna | `sin cobertura` (`no_observations`) | `sin cobertura` en `spherex_qr3` |
| **RW Aurigae** | `spherex_dr1` | 237 | 119 | 120 | 27 | `2025-09-01` a `2026-03-12` | `D1..D6` (0.7455–5.0096 µm) | `verificado` | **`verificado`** |
| **RW Aurigae** | `spherex_qr3` | 120 | 63 | 63 | 10 | `2026-09-02` a `2026-09-16` | `D1..D6` (0.7455–5.0096 µm) | `verificado` | **`verificado`** |
| **R Draconis** | `spherex_dr1` | 456 | 231 | 232 | 63 | `2025-05-16` a `2026-05-13` | `D1..D6` (0.7455–5.0096 µm) | `verificado` | **`verificado`** |
| **R Draconis** | `spherex_qr3` | 130 | 67 | 67 | 18 | `2026-05-16` a `2026-07-16` | `D1..D6` (0.7455–5.0096 µm) | `verificado` | **`verificado`** |

---

## 4. Detalle de Evidencia Real por Objeto (Secuencias Multi-Época Comprobables)

### a) Estrella de Barnard (`Barnard's Star`) — Estado: `verificado`
- **Cobertura `spherex_dr1`:** 259 exposiciones FITS (132 `obs_id` únicos, 133 `t_min_utc`, 29 días UTC entre `2025-08-15` y `2026-05-05`) en las 6 bandas `D1..D6` (`44, 43, 43, 42, 44, 43` exposiciones por banda).
- **Cobertura `spherex_qr3`:** 128 exposiciones FITS (64 `obs_id` únicos, 15 días UTC entre `2026-08-16` y `2026-09-22`) en las 6 bandas `D1..D6`.
- **Par multi-época real comprobado en `SPHEREx-D1` (`0.7455–1.1167 µm`) y `SPHEREx-D6` (`4.4115–5.0096 µm`):**
  - Época 1 (`spherex_dr1`, `SPHEREx-D6`): `obs_id=2025W33_2C_0321_1` | `t_min=60902.864715` (`2025-08-15T20:45:11.376`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W33_2C/l2b-v27-2026-228/6/level2_2025W33_2C_0321_1D6_spx_l2b-v27-2026-228.fits`
  - Época 2 (`spherex_dr1`, `SPHEREx-D6`): `obs_id=2026W19_1A_0403_1` | `t_min_utc=2026-05-05T01:59:28.781`
  - Época 3 (`spherex_qr3`, `SPHEREx-D6`): `obs_id=2026W33_2A_0594_4` | `t_min=61268.630812` (`2026-08-16T15:08:22.157`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/level2/2026W33_2A/l2b-v27-2026-241/6/level2_2026W33_2A_0594_4D6_spx_l2b-v27-2026-241.fits`

### b) Epsilon Indi B (`eps Ind B`) — Estado: `verificado`
- **Cobertura `spherex_dr1`:** 371 exposiciones FITS (195 `obs_id` únicos, 195 `t_min_utc`, 50 días UTC entre `2025-04-24` y `2026-05-04`) en las 6 bandas `D1..D6` (`51, 76, 67, 49, 65, 63` exposiciones).
- **Cobertura `spherex_qr3`:** 120 exposiciones FITS (60 `obs_id` únicos, 10 días UTC entre `2026-09-22` y `2026-10-02`) en las bandas `D2, D3, D5, D6` (`24, 36, 24, 36` exposiciones; sin `D1/D4` en `qr3`).
- **Par multi-época real comprobado en `SPHEREx-D6` (`4.4115–5.0096 µm`):**
  - Época 1 (`spherex_dr1`): `obs_id=2025W18_1B_0081_1` | `t_min=60794.06332` (`2025-04-29T01:31:10.848`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W18_1B/l2b-v27-2026-196/6/level2_2025W18_1B_0081_1D6_spx_l2b-v27-2026-196.fits`
  - Época 2 (`spherex_dr1`): `obs_id=2026W19_1A_0041_1` | `t_min_utc=2026-05-04T02:48:24.480`
  - Época 3 (`spherex_qr3`): `obs_id=2026W39_1A_0276_2` | `t_min=61305.228398` (`2026-09-22T05:28:53.587`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/level2/2026W39_1A/l2b-v27-2026-268/6/level2_2026W39_1A_0276_2D6_spx_l2b-v27-2026-268.fits`

### c) WISE 0855 (`08h55m10.831s, -07d14m42.53s`) — Estado: `verificado` en `spherex_dr1` / `sin cobertura` en `spherex_qr3`
- **Cobertura `spherex_dr1`:** 297 exposiciones FITS (150 `obs_id` únicos, 151 `t_min_utc`, 28 días UTC entre `2025-05-05` y `2026-05-14`) en las 6 bandas `D1..D6` (`51, 50, 46, 53, 51, 46` exposiciones).
- **Cobertura `spherex_qr3`:** `0` filas (`no_observations`).
- **Par multi-época real comprobado en `SPHEREx-D6` (`4.4115–5.0096 µm`, banda clave donde las enanas Y como WISE 0855 emiten su pico térmico ~4.5–5.0 µm):**
  - Época 1 (`spherex_dr1`): `obs_id=2025W19_1B_0116_1` | `t_min=60800.700028` (`2025-05-05T16:48:02.419`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W19_1B/l2b-v27-2026-197/6/level2_2025W19_1B_0116_1D6_spx_l2b-v27-2026-197.fits`
  - Época 2 (`spherex_dr1`): `obs_id=2026W20_1A_0033_1` | `t_min_utc=2026-05-11T02:18:44.640`

### d) RW Aurigae (`RW Aur`) — Estado: `verificado`
- **Cobertura `spherex_dr1`:** 237 exposiciones FITS (119 `obs_id` únicos, 120 `t_min_utc`, 27 días UTC entre `2025-09-01` y `2026-03-12`) en las 6 bandas `D1..D6` (`43, 38, 38, 42, 38, 38` exposiciones).
- **Cobertura `spherex_qr3`:** 120 exposiciones FITS (63 `obs_id` únicos, 10 días UTC entre `2026-09-02` y `2026-09-16`) en las 6 bandas `D1..D6`.
- **Par multi-época real comprobado en `SPHEREx-D1` (`0.7455–1.1167 µm`):**
  - Época 1 (`spherex_dr1`): `obs_id=2025W36_1A_0095_1` | `t_min=60919.419647` (`2025-09-01T10:04:17.501`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W36_1A/l2b-v27-2026-232/1/level2_2025W36_1A_0095_1D1_spx_l2b-v27-2026-232.fits`
  - Época 2 (`spherex_dr1`): `obs_id=2026W11_1A_0645_1` | `t_min_utc=2026-03-12T00:03:00.317`
  - Época 3 (`spherex_qr3`): `obs_id=2026W36_1A_0476_1` | `t_min=61285.097169` (`2026-09-02T02:19:55.402`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/level2/2026W36_1A/l2b-v27-2026-252/1/level2_2026W36_1A_0476_1D1_spx_l2b-v27-2026-252.fits`

### e) R Draconis (`R Dra`) — Estado: `verificado`
- **Cobertura `spherex_dr1`:** 456 exposiciones FITS (231 `obs_id` únicos, 232 `t_min_utc`, 63 días UTC entre `2025-05-16` y `2026-05-13`) en las 6 bandas `D1..D6` (`69, 78, 83, 69, 75, 82` exposiciones).
- **Cobertura `spherex_qr3`:** 130 exposiciones FITS (67 `obs_id` únicos, 18 días UTC entre `2026-05-16` y `2026-07-16`) en las 6 bandas `D1..D6` (`24, 19, 21, 25, 19, 22` exposiciones).
- **Par multi-época real comprobado en `SPHEREx-D3` (`1.6301–2.4346 µm`) y `SPHEREx-D6` (`4.4115–5.0096 µm`):**
  - Época 1 (`spherex_dr1`, `SPHEREx-D3`): `obs_id=2025W20_2D_0243_1` | `t_min=60811.955829` (`2025-05-16T22:56:23.626`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W20_2D/l2b-v27-2026-198/3/level2_2025W20_2D_0243_1D3_spx_l2b-v27-2026-198.fits`
  - Época 2 (`spherex_dr1`, `SPHEREx-D3`): `obs_id=2026W20_1A_0795_3` | `t_min_utc=2026-05-13T05:55:56.957`
  - Época 3 (`spherex_qr3`, `SPHEREx-D3`): `obs_id=2026W20_2A_0294_4` | `t_min=61176.366728` (`2026-05-16T08:48:05.299`) | `access_url=https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/level2/2026W20_2A/l2b-v27-2026-267/3/level2_2026W20_2A_0294_4D3_spx_l2b-v27-2026-267.fits`

---

## 5. Caso Recomendado para F01 (Entrega a Alexis e Isaac)

1. **Recomendación principal para volumen/cadencia multi-época y fotometría diferencial (variabilidad):** **`R Draconis` (`R Dra`)**
   - Es el objeto con mayor densidad temporal en ambas colecciones: **586 exposiciones FITS totales** (456 en `spherex_dr1` a lo largo de 63 días UTC + 130 en `spherex_qr3` a lo largo de 18 días UTC), cubriendo las **6 bandas completas (`SPHEREx-D1` a `SPHEREx-D6`, `0.7455–5.0096 µm`)** con una línea base continua desde mayo de 2025 hasta julio de 2026. Al ser una variable Mira brillante de gran amplitud infrarroja cerca del polo eclíptico norte (zona de cobertura profunda de SPHEREx), garantiza relación señal/ruido alta y cambio de flujo evidente entre épocas para validar el pipeline de Isaac y los fixtures de Alexis.
2. **Recomendación principal para movimiento propio rápido (astrometría / blinking F01):** **`Estrella de Barnard` (`Barnard's Star`)**
   - Cuenta con **387 exposiciones FITS totales** (259 en `spherex_dr1` en 29 días UTC + 128 en `spherex_qr3` en 15 días UTC) en las **6 bandas (`D1..D6`)** entre `2025-08-15` y `2026-09-22` (~13 meses de línea base temporal, lo que equivale a ~11.2 arcsec de desplazamiento propio real frente al tamaño de píxel de SPHEREx de ~6.2 arcsec).
3. **Advertencia técnica importante para QA:**
   - `WISE 0855` solo tiene cobertura en `spherex_dr1` (297 FITS) y **0 observaciones en `spherex_qr3`**, por lo que cualquier prueba que consulte exclusivamente `spherex_qr3` debe manejar el estado `no_observations` sin romper el flujo.
