# Atribuciones de «Explorar»

Recursos de terceros empaquetados en `src/scene/assets/`. Se descargaron solo durante el desarrollo
(con `tools/preparar_texturas.py`); la app no hace ninguna petición de red en ejecución. Cada licencia se
comprobó en la página de la fuente el 15 de noviembre de 2026.

Los planetas y la nave son **ilustrativos**. Las texturas reales solo dan detalle de superficie:
no se presentan como esos cuerpos.

## Texturas

| Archivo empaquetado | Origen | Autor | Licencia | URL | Descarga |
| --- | --- | --- | --- | --- | --- |
| `bandas-saturno.webp` (1024×512, 8 KB) | `2k_saturn.jpg` | Solar System Scope (INOVE) | CC BY 4.0 | https://www.solarsystemscope.com/textures/ | 2026-11-15 |
| `anillo-saturno.webp` (1024×64, 3 KB) | `2k_saturn_ring_alpha.png` | Solar System Scope (INOVE) | CC BY 4.0 | https://www.solarsystemscope.com/textures/ | 2026-11-15 |
| `luna-color.webp` (1024×512, 72 KB) | `lroc_color_poles_1k.jpg` (CGI Moon Kit) | NASA's Scientific Visualization Studio — Ernie Wright; datos LRO/LROC | Dominio público (NASA) | https://svs.gsfc.nasa.gov/4720/ | 2026-11-15 |
| `luna-relieve.webp` (512×256, 22 KB) | `ldem_3_8bit.jpg` (CGI Moon Kit) | NASA's Scientific Visualization Studio — Ernie Wright; datos LRO/LOLA | Dominio público (NASA) | https://svs.gsfc.nasa.gov/4720/ | 2026-11-15 |
| `cielo-spherex.webp` (1024×512, 80 KB) | Primer mapa infrarrojo de todo el cielo de SPHEREx (PIA26600), reproyectado de Mollweide a equirectangular | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/ | copia del repo |
| `vela-spherex.webp` (1024×512, 9 KB) | SPHEREx: región molecular de Vela (PIA26354), sin estrellas, suavizada en franjas y fundida en los bordes | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26354-spherex-vela-molecular-ridge/ | copia del repo |
| `plano-galactico.webp` (1024×512, 7 KB) | Mapa de todo el cielo de SPHEREx (PIA26600): perfil de color de la franja del plano galáctico, en franjas | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/ | copia del repo |
| `burbuja-spherex.webp` (1024×512, 41 KB) | Mapa de todo el cielo de SPHEREx (PIA26600): recorte de las burbujas azules, fundido en los bordes | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/ | copia del repo |
| `lazos-spherex.webp` (1024×512, 26 KB) | Mapa de todo el cielo de SPHEREx (PIA26600): recorte de los lazos sobre el centro galáctico, fundido en los bordes | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/ | copia del repo |
| `filamentos-spherex.webp` (1024×512, 40 KB) | Mapa de todo el cielo de SPHEREx (PIA26600): recorte de filamentos de polvo del sur, fundido en los bordes | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/ | copia del repo |
| `nebulosa-vela.webp` (1024×512, 12 KB) | SPHEREx: región molecular de Vela (PIA26354), recorte de la nebulosa naranja sin estrellas | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26354-spherex-vela-molecular-ridge/ | copia del repo |
| `marte-viking.webp` (1024×512, 68 KB) | `mar0kuu2.jpg`: mapa global de Marte en color (Viking) | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ | 2026-11-15 |
| `io-galileo.webp` (1024×512, 49 KB) | `jup1vss2.jpg`: mapa global de Ío (Voyager, color de Galileo) | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ | 2026-11-15 |
| `europa-voyager.webp` (1024×512, 62 KB) | `jup2vss2.jpg`: mapa global de Europa (Voyager) | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ | 2026-11-15 |
| `ganimedes-voyager.webp` (1024×512, 99 KB) | `jup3vss2.jpg`: mapa global de Ganímedes (Voyager) | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ | 2026-11-15 |
| `fobos-viking.webp` (1024×512, 69 KB) | `mar1kuu2.jpg`: mapa global de Fobos (Viking) | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ | 2026-11-15 |
| `venus-magellan.webp` (1024×512, 95 KB) | `ven0aaa2.jpg`: mapa global de Venus por radar (Magellan) | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ | 2026-11-15 |

Las siete últimas se generan sin red con `tools/texturas_spherex.py` a partir de
`docs/decisiones/prototipo-interfaces/assets/` (las mismas imágenes que muestra el visor).

## Imágenes de referencia de las fichas

| Archivo empaquetado | Origen | Autor | Licencia / crédito | URL | Copia |
| --- | --- | --- | --- | --- | --- |
| `src/sectors/beta/referencias/wise0855-2025-05-06.png` (64×64, 4 KB) | Recorte SPHEREx `2025W19_1B_0241_1` | NASA/JPL-Caltech (SPHEREx), datos de NASA/IPAC IRSA; procesado por el proyecto | Courtesy NASA/JPL-Caltech | https://irsa.ipac.caltech.edu/Missions/spherex.html | 2026-11-15 |
| `src/sectors/beta/referencias/wise0855-2025-10-31.png` (64×64, 4 KB) | Recorte SPHEREx `2025W44_2B_0322_1` | NASA/JPL-Caltech (SPHEREx), datos de NASA/IPAC IRSA; procesado por el proyecto | Courtesy NASA/JPL-Caltech | https://irsa.ipac.caltech.edu/Missions/spherex.html | 2026-11-15 |

Son copias de `docs/referencias/wise0855/products/` (procedencia y SHA-256 en su `README.md`).

| Archivo empaquetado | Origen | Autor | Licencia / crédito | URL |
| --- | --- | --- | --- | --- |
| `src/sectors/beta/referencias/cielo-spherex-original.webp` (480 px) | Mapa de todo el cielo de SPHEREx (PIA26600), reducido | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/ |
| `src/sectors/beta/referencias/vela-spherex-original.webp` (480 px) | Región molecular de Vela (PIA26354), reducida | NASA/JPL-Caltech (SPHEREx) | Courtesy NASA/JPL-Caltech | https://www.jpl.nasa.gov/images/pia26354-spherex-vela-molecular-ridge/ |
| `src/sectors/alpha/referencias/marte-viking-original.webp` (360×180) | `mar0kuu2.jpg` reducido | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ |
| `src/sectors/alpha/referencias/io-galileo-original.webp` (360×180) | `jup1vss2.jpg` reducido | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ |
| `src/sectors/alpha/referencias/europa-voyager-original.webp` (360×180) | `jup2vss2.jpg` reducido | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ |
| `src/sectors/alpha/referencias/ganimedes-voyager-original.webp` (360×180) | `jup3vss2.jpg` reducido | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ |
| `src/sectors/alpha/referencias/fobos-viking-original.webp` (360×180) | `mar1kuu2.jpg` reducido | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ |
| `src/sectors/alpha/referencias/venus-magellan-original.webp` (360×180) | `ven0aaa2.jpg` reducido | NASA/JPL-Caltech/USGS (Solar System Simulator de JPL) | Courtesy NASA/JPL-Caltech | https://maps.jpl.nasa.gov/tmaps/ |

Los mapas de α (las seis filas de JPL) se descargaron solo en desarrollo con `tools/alpha/texturas_nasa.py`. Política de uso de JPL: «Unless otherwise noted, images and video on JPL public web sites may be used for any purpose without prior permission» (https://www.jpl.nasa.gov/jpl-image-use-policy), con el crédito «Courtesy NASA/JPL-Caltech».

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
