# F01 · Par SPHEREx en el campo de WISE 0855

El ensayo local del 14 de noviembre de 2026 produjo dos fotogramas `ready` de DR1 y detector 1. El centro ICRS es RA `133.795129166667°`, Dec `−7.245147222222°`, convertido desde la posición del [contexto general](../contexto/00_Contexto_General.md#3-datos-y-criterio-científico). El campo de salida es de `0.10° × 0.10°`.

| Observación | Inicio de exposición UTC (`DATE-OBS`) | Recorte IRSA |
| --- | --- | --- |
| `2025W19_1B_0241_1` | `2025-05-06T12:20:24.888Z` | [FITS de mayo](https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W19_1B/l2b-v27-2026-197/1/level2_2025W19_1B_0241_1D1_spx_l2b-v27-2026-197.fits?center=133.795129166667,-7.245147222222d&size=0.15deg) |
| `2025W44_2B_0322_1` | `2025-10-31T18:55:38.358Z` | [FITS de octubre](https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W44_2B/l2b-v27-2026-246/1/level2_2025W44_2B_0322_1D1_spx_l2b-v27-2026-246.fits?center=133.795129166667,-7.245147222222d&size=0.15deg) |

Las épocas están separadas por 178.27 días. La consulta inicial de candidatos usó SIA2 con un círculo de radio `0.071°` y un máximo de 100 filas por colección. La respuesta de `spherex_dr1` llegó a ese límite y `spherex_qr3` devolvió 0 filas para la consulta. Las fechas y los IDs de la tabla se comprobaron en los encabezados de los recortes. Los recortes de entrada miden `0.15°` para dar margen a las esquinas durante la rotación a la rejilla común. [Acceso a SPHEREx en IRSA](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/).

## Regla científica v1

1. Reproyectar `IMAGE` de ambos FITS mediante su WCS celeste a una rejilla TAN de 64 × 64 con centro ICRS fijo, norte arriba y este a la izquierda. Usar interpolación bilineal en unidades de MJy/sr.
2. Excluir los valores no finitos y todo píxel con flags salvo `SOURCE` solo (bit 21), que marca la posición de una fuente conocida. Exigir al menos 75 % de píxeles válidos por fotograma para garantizar al menos 50 % de superficie común en un par. Aplicar la misma máscara de intersección a los dos PNG, con transparencia en los huecos. [Suplemento de SPHEREx, tabla 16](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf#page=34).
3. Interpolar `WCS-WAVE` en los píxeles de la máscara común. Si `λmin` y `λmax` son los extremos de las longitudes centrales y `wmin` es el menor ancho, aceptar el par cuando `λmax − λmin < wmin`. Así existe solapamiento incluso usando el ancho más estrecho para todos los píxeles. Informar el punto medio de esos extremos como `center_um` y `wmin/2` como `tolerance_um`. Entre pares válidos con IDs e instantes distintos, priorizar la mayor separación temporal y desempatar por cobertura y solapamiento. [Producto espectral y WCS-WAVE](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/#main-science-data-product-spectral-image-multi-extension-fits-files-mef).
4. Usar los percentiles 1 y 99 de las intensidades combinadas en la máscara común como extremos de contraste de ambos PNG. Guardar la fracción visible y los extremos de contraste con la evidencia. El resultado permite comparar visualmente dos épocas del campo. Identificar WISE 0855 o medir su brillo o movimiento requiere un análisis aparte.

| Medida en el par | Resultado |
| --- | --- |
| Banda y tolerancia | `0.992817 µm ± 0.012909 µm` |
| Solapamiento espectral conservador | `0.009369 µm` |
| Superficie visible compartida | 3 285 de 4 096 píxeles (80.20 %) |
| Contraste compartido | `0.207354` a `1.029985` MJy/sr |

La inspección visual de los PNG muestra las mismas fuentes de referencia en las dos épocas. Para una fuente compacta cerca de la fila 39, columna 30, la posición del centro de luminosidad dentro de una ventana local coincide a menos de un píxel de salida. El resultado científico usa el [contrato v1](../contratos/comparacion-v1.md) para estados y procedencia.

## Reproducir desde el clon

Guarda los dos recortes enlazados en la tabla como `data/raw/f01/2025W19_1B_0241_1D1.fits` y `data/raw/f01/2025W44_2B_0322_1D1.fits`. Los SHA-256 del ensayo fueron, en ese orden, `d92561de58fdc9e233163b7e8b9ae159e3721fa6ff763ecc4c20b63e5dd7f2b7` y `01b5d0766c762633b1226ccdc27bad1f9442406c3b617d71da3f0a247be03e06`.

Desde la raíz del repositorio, prepara un entorno local y ejecuta las pruebas.

```powershell
py -3.13 -m venv data/processed/f01/.venv
$F01Python = '.\data\processed\f01\.venv\Scripts\python.exe'
& $F01Python -m pip install astropy==8.0.2 numpy==2.5.4 reproject==0.21.0 Pillow==13.0.0 pytest==9.2.0
& $F01Python -m pytest api/tests/science
```

Con ese mismo Python, el siguiente ejemplo genera la evidencia y un respaldo con `manifest.json` y sus dos PNG.

```python
from dataclasses import asdict
from datetime import UTC, datetime
import json
from pathlib import Path

from api.planetx.science import Cutout, build_sequence

raw = Path("data/raw/f01")
output = Path("data/processed/f01/wise0855")
prepared = output / "respaldo"
products = prepared / "products"
archive = "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2"
cutouts = []
for observation_id, build in [
    ("2025W19_1B_0241_1", "l2b-v27-2026-197"),
    ("2025W44_2B_0322_1", "l2b-v27-2026-246"),
]:
    period = observation_id.rsplit("_", 2)[0]
    detector_id = f"{observation_id}D1"
    url = f"{archive}/{period}/{build}/1/level2_{detector_id}_spx_{build}.fits"
    cutouts.append(Cutout(observation_id, "dr1", url, raw / f"{detector_id}.fits"))

result, pngs = build_sequence(
    ra_deg=133.795129166667, dec_deg=-7.245147222222, fov_deg=0.1, cutouts=cutouts
)
assert result.status == "ready", result
products.mkdir(parents=True, exist_ok=True)
for frame_id, png in pngs.items():
    (products / f"{frame_id}.png").write_bytes(png)
(output / "evidencia.json").write_text(
    json.dumps(asdict(result), indent=2) + "\n", encoding="utf-8"
)
entry = {
    "schema_version": "1",
    "status": result.status,
    "reason": result.reason,
    "mode": "prepared",
    "query": {"ra_deg": 133.795129166667, "dec_deg": -7.245147222222,
              "frame": "ICRS", "fov_deg": 0.1},
    "band": result.band,
    "checked_at": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
    "science_version": result.science_version,
    "warnings": [],
    "frames": [
        {**frame, "image_url": f"/api/v1/images/{frame['id']}"} for frame in result.frames
    ],
}
(prepared / "manifest.json").write_text(
    json.dumps({"manifest_version": "1", "entries": [entry]}, indent=2, allow_nan=False) + "\n",
    encoding="utf-8",
)
```

## Servir el respaldo en la API

Usa la API con el PR #3 integrado y ejecuta desde la raíz del repositorio. Las rutas apuntan al manifiesto y a su carpeta `products`.

```powershell
$respaldo = 'data/processed/f01/wise0855/respaldo'
$env:PLANETX_CATALOG_MANIFEST = (Resolve-Path "$respaldo/manifest.json").Path
$env:PLANETX_PRODUCTS_DIR = (Resolve-Path "$respaldo/products").Path
& $F01Python -m pip install -r api/requirements.txt
& $F01Python -m uvicorn app:app --app-dir api --host 127.0.0.1 --port 8000
```

Desde otra terminal, consulta el centro exacto. La respuesta esperada es HTTP `200`, `mode: "prepared"`, `status: "ready"` y dos `image_url` que devuelven PNG.

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/comparisons?ra_deg=133.795129166667&dec_deg=-7.245147222222'
```

El preset debe enviar esos valores de RA y Dec completos para que coincidan con la clave del catálogo. La prueba contra `main` en `34a2381` devolvió `200 prepared/ready` y los dos PNG exactos. El verificador de César reportó cero errores con ambos productos presentes. [PR #3 de la API](https://github.com/natwDX/planetx-spherex/pull/3) · [PR #4 de QA](https://github.com/natwDX/planetx-spherex/pull/4).

## Traspaso para integración

- **Isaac.** Con `api` en la ruta de importación, usar `from planetx.science import Cutout, build_sequence`. El módulo acepta la clave de producto `<obs_id>/D<n>` del adaptador tras contrastarla con el FITS. El `observation_id` devuelto es el `OBSID` de exposición. Dos detectores de una misma exposición cuentan como una época. El módulo entrega `(ScienceResult, dict[frame_id, bytes])`. El servicio HTTP convierte ese par a su `SequenceResult`, agrega `image_url` y los campos de la consulta y resume el estado de la búsqueda. Reservar `common_valid_fraction` y `contrast_mjy_sr` para la evidencia. A las dependencias de la API actual les faltan Reproject y Pillow para integrar este módulo.
- **DeValle.** Usar la entrada de `manifest.json` y los PNG por ID. Conservar las coordenadas exactas y la versión científica `v1`.
- **César.** Contrastar `OBSID` y `DATE-OBS` en cada FITS, revisar la máscara y reproducir cobertura y banda con los recortes enlazados.

Usar `SearchSummary` en la integración en vivo. Una consulta espacial completada en todas las colecciones y sin filas da `no_coverage`. Si se agotó el límite de candidatos antes de obtener un par, usar `insufficient/search_limit_reached`. Un fallo de archivo o un plazo agotado que impida comprobar la comparación conserva el `503` correspondiente.

Datos de SPHEREx DR1 Spectral Images, del archivo NASA/IPAC IRSA. [DOI 10.26131/IRSA678](https://doi.org/10.26131/IRSA678) · [Reconocimiento solicitado por IRSA](https://irsa.ipac.caltech.edu/Missions/spherex.html).
