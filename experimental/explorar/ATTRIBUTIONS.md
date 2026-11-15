# Atribuciones de «Explorar»

Recursos de terceros empaquetados en `src/scene/assets/`. Se descargaron solo durante el desarrollo
(con `tools/preparar_texturas.py`); la app no hace ninguna petición de red en ejecución. Cada licencia se
comprobó en la página de la fuente el 15 de noviembre de 2026.

Los planetas, la estación y la nave son **ilustrativos**. Las texturas reales solo dan detalle de superficie:
no se presentan como esos cuerpos.

## Texturas

| Archivo empaquetado | Origen | Autor | Licencia | URL | Descarga |
| --- | --- | --- | --- | --- | --- |
| `bandas-saturno.webp` (1024×512, 8 KB) | `2k_saturn.jpg` | Solar System Scope (INOVE) | CC BY 4.0 | https://www.solarsystemscope.com/textures/ | 2026-11-15 |
| `anillo-saturno.webp` (1024×64, 3 KB) | `2k_saturn_ring_alpha.png` | Solar System Scope (INOVE) | CC BY 4.0 | https://www.solarsystemscope.com/textures/ | 2026-11-15 |
| `luna-color.webp` (1024×512, 72 KB) | `lroc_color_poles_1k.jpg` (CGI Moon Kit) | NASA's Scientific Visualization Studio — Ernie Wright; datos LRO/LROC | Dominio público (NASA) | https://svs.gsfc.nasa.gov/4720/ | 2026-11-15 |
| `luna-relieve.webp` (512×256, 22 KB) | `ldem_3_8bit.jpg` (CGI Moon Kit) | NASA's Scientific Visualization Studio — Ernie Wright; datos LRO/LOLA | Dominio público (NASA) | https://svs.gsfc.nasa.gov/4720/ | 2026-11-15 |

## Imágenes de referencia de las fichas

| Archivo empaquetado | Origen | Autor | Licencia / crédito | URL | Copia |
| --- | --- | --- | --- | --- | --- |
| `src/sectors/beta/referencias/wise0855-2025-05-06.png` (64×64, 4 KB) | Recorte SPHEREx `2025W19_1B_0241_1` | NASA/JPL-Caltech (SPHEREx), datos de NASA/IPAC IRSA; procesado por el proyecto | Courtesy NASA/JPL-Caltech | https://irsa.ipac.caltech.edu/Missions/spherex.html | 2026-11-15 |
| `src/sectors/beta/referencias/wise0855-2025-10-31.png` (64×64, 4 KB) | Recorte SPHEREx `2025W44_2B_0322_1` | NASA/JPL-Caltech (SPHEREx), datos de NASA/IPAC IRSA; procesado por el proyecto | Courtesy NASA/JPL-Caltech | https://irsa.ipac.caltech.edu/Missions/spherex.html | 2026-11-15 |

Son copias de `docs/referencias/wise0855/products/` (procedencia y SHA-256 en su `README.md`).

**Texto de las licencias, tal como aparece en cada fuente:**

- **Solar System Scope:** «Distributed under Attribution 4.0 International license: You may use, adapt, and share
  these textures for any purpose, even commercially.» (https://creativecommons.org/licenses/by/4.0/)
- **NASA SVS:** «All of our content is in the public domain (unless otherwise noted)»
  (https://svs.gsfc.nasa.gov/help/). La página del CGI Moon Kit pide el crédito «NASA's Scientific Visualization
  Studio».

**Cambios (CC BY 4.0 exige indicarlos):** las texturas se redujeron a 1024 px (512 px el relieve) y se
convirtieron a WebP. En la escena, las de Saturno se tiñen en parte hacia la paleta de Orun (planeta
ilustrativo), y las lunares se usan como luminancia coloreada con otra paleta y como mapa de relieve.

## Software

three.js, React y @react-three/fiber (MIT). La lista completa de dependencias y licencias está en el README.
