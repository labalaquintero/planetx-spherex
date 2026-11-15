# Caso preparado de R Draconis

El catálogo incorpora R Draconis en ICRS (RA 248.167611°, Dec 66.754979°) con un campo de 0.10° × 0.10°. Las dos exposiciones DR1 del detector D3 están separadas por 354 días. La banda local común es **1.65530 ± 0.01956 µm** y 3 799 de los 4 096 píxeles son válidos en ambas épocas (92.75 %).

| Época | Observación | UTC | FITS |
| --- | --- | --- | --- |
| A | `2025W20_2D_0243_1/D3` | 2025-05-16 22:56:23.637 | [DR1](https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W20_2D/l2b-v27-2026-198/3/level2_2025W20_2D_0243_1D3_spx_l2b-v27-2026-198.fits) |
| B | `2026W19_1A_0842_1/D3` | 2026-05-06 06:04:36.596 | [DR1](https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2026W19_1A/l2b-v27-2026-245/3/level2_2026W19_1A_0842_1D3_spx_l2b-v27-2026-245.fits) |

La selección parte de la [matriz de cobertura](../qa/datos/matriz_5_casos.md). El procesamiento verifica el solapamiento espectral en el campo mediante WCS-WAVE y aplica la máscara común antes de renderizar las dos épocas y B − A. Las mismas observaciones también pasan en D6 a 4.43775 ± 0.01779 µm, con 86.16 % de campo común. El catálogo sirve D3 por su mayor cobertura. [Acceso a los datos de SPHEREx en IRSA](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/).

## Generar el catálogo

Desde la raíz del repositorio, con las [dependencias de la API](../../api/requirements.txt) instaladas, descarga los recortes y agrega el caso al catálogo científico de WISE 0855.

```powershell
$archivoA = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W20_2D/l2b-v27-2026-198/3/level2_2025W20_2D_0243_1D3_spx_l2b-v27-2026-198.fits'
$archivoB = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2026W19_1A/l2b-v27-2026-245/3/level2_2026W19_1A_0842_1D3_spx_l2b-v27-2026-245.fits'
$recorte = '?center=248.16761100,66.75497900d&size=0.15'
New-Item -ItemType Directory -Path 'data/raw/r-draconis' -Force | Out-Null
$fitsA = 'data/raw/r-draconis/2025W20_2D_0243_1_D3_dr1.fits'
$fitsB = 'data/raw/r-draconis/2026W19_1A_0842_1_D3_dr1.fits'
curl.exe --fail --retry 2 --max-time 35 --max-filesize 8388608 --output $fitsA ($archivoA + $recorte)
curl.exe --fail --retry 2 --max-time 35 --max-filesize 8388608 --output $fitsB ($archivoB + $recorte)
python -m api.planetx.science.prepare_case `
  --ra-deg 248.167611 --dec-deg 66.754979 `
  --cutout '2025W20_2D_0243_1/D3' dr1 $archivoA $fitsA `
  --cutout '2026W19_1A_0842_1/D3' dr1 $archivoB $fitsB `
  --base data/wise0855-cientifico `
  --output data/casos-preparados
```

La carpeta generada contiene un manifiesto para los dos campos y seis PNG. Para probarla con Docker, usa estas rutas en el contenedor.

```powershell
$env:PLANETX_CATALOG_MANIFEST = '/data/casos-preparados/manifest.json'
$env:PLANETX_PRODUCTS_DIR = '/data/casos-preparados/products'
docker compose up --build
```

Abre [R Draconis en el visor local](http://localhost/#visor?ra=248.167611&dec=66.754979) y selecciona **Ver diferencias**. WISE 0855 se puede comprobar desde su acceso habitual.
