# Sector α · campo de WISE 0855

α se compone **sobre las fuentes reales de dos recortes de SPHEREx** alrededor de WISE 0855. Es un sector
«de observación»: cuatro cuerpos grandes, rocas sobre el resto de fuentes y mucho campo abierto. Usa el
mismo motor que β (vuelo libre, cámara de persecución, mapa, límites y colisiones) y mantiene el aviso
**«Representación ilustrativa, no son datos reales de SPHEREx»**.

## Procedencia

| Qué | Dónde |
| --- | --- |
| Recortes reales (64 × 64 px, 2 épocas, banda 0,9928 ± 0,0129 µm) | `docs/referencias/wise0855/` (manifiesto, PNG y SHA-256) |
| Época 1 | `2025W19_1B_0241_1`, 2025-05-06T12:20:24.888Z |
| Época 2 | `2025W44_2B_0322_1`, 2025-10-31T18:55:38.358Z (178,27 días después) |
| Medición | `tools/alpha/analizar_wise0855.py` → `docs/referencias/alpha/campo-wise0855.json` |
| Detalle científico de los recortes | `docs/decisiones/f01-par-wise0855.md` (raíz del repo) |

## Método

1. **Medición** (`tools/alpha/analizar_wise0855.py`, determinista). Sobre los 3 285 píxeles válidos de la
   máscara común:
   - **Fondo** de cada época: mediana, dispersión robusta, percentiles y longitud de correlación (2 px).
   - **Fuentes**: se detectan en la media de las dos épocas, suavizada con σ = 1 px, por encima de mediana + 3σ
     y con al menos 3 píxeles. Hay 25 candidatas y se conservan las 24 más brillantes (`f01`…`f24`), con
     centroide, pico, flujo, área y flujo por época.
   - **Cambio entre épocas**: correlación de píxeles de 0,947, y las 24 fuentes tienen un cociente de flujo
     entre 0,5 y 2. El fondo cambia de nivel entre épocas porque el contraste de los PNG es compartido; no
     se interpreta como cambio físico.
2. **Escena** (`campo.ts`, `objects.ts`). El recorte cuadrado se centra en la vista de entrada (16:9),
   ocupa el 84 % del alto y no se estira. Cada fuente da un objeto con su mismo id, colocado con
   `screenToWorld` para que, visto desde la entrada, su centro caiga en el centroide medido.
   - **`f01`** (la más brillante) es el **objeto focal**: «Óxido», con el mapa en color de Marte (Viking).
   - **`f02`**: «Hielo rayado», con anillo y el mapa de Europa (Voyager) en azules.
   - **`f03`** y **`f04`**: las lunas «Azufre» (Ío, Voyager con color de Galileo) y «Surcos» (Ganímedes, Voyager).
   - **`f05`…`f24`**: rocas, más cercanas cuanto más brillante es la fuente.
   - **Fuera del recorte** (detrás de la entrada, no son fuentes medidas): «Radar», con el mapa de Venus por
     radar (Magellan), y su luna «Cráter», con el de Fobos (Viking).
   - Cada cuerpo con nombre tiene ficha en el HUD (`info.ts`) con el mapa original y su crédito. Los mapas son
     mosaicos globales de NASA/JPL/USGS (`tools/alpha/texturas_nasa.py`), distintos de las texturas de β.
3. **Relleno** (`index.ts`, `FIELD`), con semilla fija 855. La cantidad sale de la densidad medida: el
   recorte ocupa el 39,7 % de la vista de entrada, así que fuera caben 24 × (1 − 0,397) / 0,397 ≈ 36 cuerpos.
   Los tamaños van de la roca más pequeña a la más grande colocadas sobre fuentes. El motor descarta el
   relleno dentro de la vista inicial, así que el campo real queda limpio.
4. **Ruta** (`waypoints.ts`). Es una cruz: entrada → centro → fondo, con dos miradores laterales
   orientados a `f01` y `f02` (`aimAt`). Los vínculos son de ida y vuelta, y se recorre con W/S, A/D,
   E/Q, flechas y los botones en pantalla.

## Qué es dato y qué es ilustración

| Dato (medido en los recortes) | Ilustración (elección de diseño) |
| --- | --- |
| Posición relativa de las 24 fuentes en el recorte | Que sean planetas, lunas o rocas: son fuentes puntuales vistas por el instrumento, no discos |
| Orden de brillo (cuál es el objeto focal y quién está más cerca) | Profundidad de cada objeto |
| Tamaño relativo de las manchas de las rocas (× 0,45) | Tamaño de los cuatro cuerpos grandes, exagerado para que se lean como planetas |
| Densidad de fuentes, usada para la cantidad de relleno | Colores, atmósferas y anillo; las superficies son mapas reales de otros cuerpos (Marte, Ío, Europa, Ganímedes, Venus y Fobos) usados como textura |
| Estabilidad entre épocas (sin cambios marcados) | Posición de cada cuerpo de relleno y todo lo que queda fuera del recorte |

**Límite:** son recortes de 64 × 64 px en infrarrojo cercano, sin discos de planeta ni paisajes. Identificar
WISE 0855 o medir su brillo o movimiento requiere un análisis aparte; aquí no se hace.

## Pruebas (`alpha.test.ts`)

- El campo viene de los dos recortes y está ordenado por brillo.
- El grafo de ruta y los `focusId` son válidos. También los valida `sectors.test.ts`, que cubre cualquier
  sector con escena.
- Cada objeto, visto desde la entrada, cae en el centroide de su fuente con una tolerancia de **±0,5 px
  del recorte**.
- El objeto focal es la fuente más brillante. Hay como máximo cuatro cuerpos grandes y solo tipos
  permitidos.
- Ningún objeto se solapa con otro ni tapa un punto de ruta.
- El relleno es determinista y no invade la vista del recorte.
- Los cuerpos con nombre usan texturas empaquetadas distintas de las de β y tienen ficha con imagen y crédito;
  los de fuera del recorte no asoman en la vista de entrada ni se solapan con nada.

## Cómo correrlo

```bash
cd experimental/explorar
pnpm install --frozen-lockfile
pnpm dev                      # http://127.0.0.1:5174 → elige α
pnpm typecheck && pnpm test && pnpm build
```

Para regenerar la medición, usa un entorno fuera del repo:

```bash
python -m venv <tmp>/alphavenv
<tmp>/alphavenv/Scripts/python -m pip install numpy==2.5.4 pillow==13.0.0 scipy==1.18.1
<tmp>/alphavenv/Scripts/python tools/alpha/analizar_wise0855.py   # desde experimental/explorar
```

## Créditos

- **Recortes de WISE 0855:** SPHEREx, NASA/IPAC IRSA. «Courtesy NASA/JPL-Caltech». *This publication makes
  use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization
  and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California
  Institute of Technology, and is funded by the National Aeronautics and Space Administration.*
- **Superficies de los planetas:** mapas globales del Solar System Simulator de JPL (https://maps.jpl.nasa.gov/tmaps/),
  mosaicos de Caltech/JPL/USGS con imágenes de Viking, Voyager, Galileo y Magellan. «Courtesy NASA/JPL-Caltech»
  (política de uso de imágenes de JPL). Se regeneran con `tools/alpha/texturas_nasa.py --cache <carpeta temporal>`.
- **Anillo de «Hielo rayado»:** anillo de Saturno de Solar System Scope (CC BY 4.0), el mismo que usa β.

## Propuestas para el motor (para Isaac; no se tocó el motor)

1. **Paleta de las rocas con nombre.** Los `smallBody` de `objects` se dibujan con la paleta del `field`, no
   con la suya (`scene/SectorScene.tsx` pasa una sola paleta a `SmallBodies`). En α coinciden, así que no se
   nota.
2. **Ver el dato junto a la escena.** Un panel opcional del sector que muestre los dos PNG reales (con fecha y
   crédito) al lado del HUD dejaría ver de dónde sale la composición. Hoy no hay forma de hacerlo desde un
   sector.
3. **Peso del JSON.** `campo-wise0855.json` (~12 kB) entra en el bundle principal porque los sectores se
   registran con `import.meta.glob` en modo `eager`. Si crece, conviene cargar la escena de forma diferida.
