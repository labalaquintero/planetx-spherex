# WISE 0855 · par real de SPHEREx (copia de referencia)

Copia **de referencia** del caso preparado del visor: los dos recortes reales del campo de WISE 0855
y su manifiesto. Se versionan aquí (pesan unos 9 KB en total) para que quien trabaje en Explorar los
tenga con un `git pull`. La API del visor **no** los lee de aquí: sigue usando `data/wise0855/`, que
no está en Git.

| Campo | Valor |
| --- | --- |
| Origen de los datos | NASA/IPAC IRSA, misión SPHEREx, release `dr1`, nivel 2, detector 1 |
| Centro (ICRS) | `ra_deg = 133.795129166667`, `dec_deg = -7.245147222222` |
| Campo | `0.10° × 0.10°` |
| Banda | `0.992817 µm ± 0.012909 µm` |
| Época 1 | `obs_id 2025W19_1B_0241_1`, `2025-05-06T12:20:24.888Z` → `products/c80d7aae….png` |
| Época 2 | `obs_id 2025W44_2B_0322_1`, `2025-10-31T18:55:38.358Z` → `products/ec0f084d….png` |
| Separación | 178,27 días |
| Generado | `checked_at 2026-11-15T00:02:13Z`, `science_version v1` |

## Qué son estas imágenes

- Son **recortes de 64 × 64 píxeles en infrarrojo cercano**, en escala de grises con transparencia.
  No son los FITS originales: son PNG producidos por la regla científica v1 del proyecto. Esa regla
  reproyecta a una rejilla TAN con el norte arriba, aplica una máscara común de píxeles no válidos
  (811 píxeles transparentes, `quality_flags: masked_pixels`) y un contraste compartido entre los
  percentiles 1 y 99.
- Detalle completo, enlaces a los FITS de IRSA y cómo reproducirlo:
  [`docs/decisiones/f01-par-wise0855.md`](../../../../../docs/decisiones/f01-par-wise0855.md).
- Los nombres de archivo son el `frame_id` del manifiesto (SHA-256 del producto).

## Uso y crédito

- Úsalos como **referencia** (composición, brillo relativo de las fuentes, diferencia entre épocas).
  Si algo derivado de ellos se muestra en Explorar, debe seguir apareciendo el aviso «Representación
  ilustrativa, no son datos reales de SPHEREx», salvo que el equipo decida mostrar el dato tal cual.
- Crédito: «Courtesy NASA/JPL-Caltech» (política de uso de imágenes de SPHEREx). Agradecimiento
  estándar: *This publication makes use of data products from the Spectro-Photometer for the History
  of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the
  Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National
  Aeronautics and Space Administration.*
- Identificar WISE 0855 o medir su brillo o movimiento en estas imágenes requiere un análisis aparte;
  no lo hacen estas copias.

## SHA-256

| Archivo | SHA-256 |
| --- | --- |
| `products/c80d7aae12e197e3f2678239871ca47d198813c567550ff12549b7cc6feddb9c.png` | `0b6d7c4b23afe34b1b319c58c053d2201f46a9b13a46f94071141598e21c2f51` |
| `products/ec0f084def6975d7ddaac0af157ec0f0df5dbf01f46e183461939d8af33c4033.png` | `c41ceefaa8c2c97499eb443be52b4f811269b22f014ebd810c6542177bb3f19b` |
| `manifest.json` | `a6f076fdeb3328d65ca11d70bee4cf260b490d44aa706e03399025b2b3b52d94` |
