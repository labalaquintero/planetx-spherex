# Comparación científica de WISE 0855

**Ver diferencias** visualiza la diferencia de brillo superficial en el campo entre el 6 de mayo y el 31 de octubre de 2025. Usa los FITS SPHEREx DR1 del [par preparado de WISE 0855](f01-par-wise0855.md), en la banda aproximada de 0.9928 ± 0.01291 µm.

El proceso reproyecta ambas exposiciones a la rejilla WCS del comparador, aplica su máscara común y calcula B − A en MJy/sr antes de convertir el resultado a PNG. La escala diverge alrededor de cero y satura a partir del percentil 99 de la magnitud de la diferencia. Si ese percentil es cero se usa el máximo. La cuadrícula del visor indica píxeles fuera de la máscara.

El par real tiene 3 285 de 4 096 píxeles en común (80.20 %). El ruido, las diferencias en el fondo, la resolución y la respuesta espectral también producen residuos. Medir variabilidad requiere ajustar esas diferencias entre las exposiciones y estimar la incertidumbre. [Productos de SPHEREx en IRSA](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/) · [Método de sustracción de imágenes de Zackay et al.](https://doi.org/10.3847/0004-637X/830/1/27).

## Generar el caso preparado

Ejecuta desde la raíz del repositorio con las [dependencias de la API](../../api/requirements.txt) instaladas. Necesitas el manifiesto con su carpeta `products` y los FITS del [par preparado](f01-par-wise0855.md).

```powershell
python -m api.planetx.science.prepare_difference `
  --manifest data/wise0855/manifest.json `
  --fits-a data/raw/f01/2025W19_1B_0241_1D1.fits `
  --fits-b data/raw/f01/2025W44_2B_0322_1D1.fits `
  --output data/wise0855-cientifico
```

El comando verifica la banda, las fechas y los píxeles del par. Copia los PNG de las épocas con sus IDs originales y agrega el PNG de diferencias. Para probar con Docker usa el manifiesto generado y sus productos.

```powershell
$env:PLANETX_CATALOG_MANIFEST = '/data/wise0855-cientifico/manifest.json'
$env:PLANETX_PRODUCTS_DIR = '/data/wise0855-cientifico/products'
docker compose up --build
```

Abre `http://localhost/#visor/wise-0855` y elige **Ver diferencias**. Los enlaces de las fechas abren las imágenes originales del par en el visor, desde donde se puede consultar su procedencia.
