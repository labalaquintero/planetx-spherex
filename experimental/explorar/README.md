# Explorar (extra independiente)

Pequeña simulación de exploración espacial para Planet X. Se elige un sector en un campo estelar y se salta a él;
después se **vuela libremente** en nave por todo el sector, en una escena 3D. **Es ilustrativa: no usa datos reales de SPHEREx.**

El proyecto vive aislado en `experimental/explorar/`, con su propio `package.json` y `pnpm-lock.yaml`, fuera de
cualquier workspace. No toca `web/`, `api/`, `infra/` ni Docker. **No hace llamadas de red en ejecución:** no usa
CDN, fuentes, texturas ni modelos remotos. La nebulosa, la nave y la galaxia de la selección se generan en el
navegador. Las cinco texturas de referencia (NASA y Solar System Scope, 140 KB) van empaquetadas y se sirven desde
el mismo origen. La fuente es la del sistema, como en el visor. Funciona sin conexión.

La composición de la escena y de la selección **sale de medir los bocetos**
(`docs/referencias/layout.json`); ver «Fidelidad a los bocetos».

## Cómo correrlo

Requiere Node 24 y pnpm.

```bash
cd experimental/explorar
pnpm install --frozen-lockfile
pnpm dev                  # desarrollo: http://127.0.0.1:5174
pnpm build && pnpm preview  # build de producción: http://localhost:4173
```

| Comando          | Qué hace                                                    |
| ---------------- | ----------------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo                                      |
| `pnpm typecheck` | `tsc --noEmit` (modo estricto)                              |
| `pnpm test`      | Vitest (167 pruebas: vuelo, proyección del boceto, créditos, CSS…) |
| `pnpm build`     | Typecheck + build de producción en `dist/`                  |
| `pnpm preview`   | Sirve `dist/`                                               |

### Parámetros de URL

| Parámetro                  | Efecto                                                                         |
| -------------------------- | ------------------------------------------------------------------------------ |
| `?quality=low` / `medium` / `high` | Fija la calidad y desactiva el ajuste automático. Otro valor = automático. |
| `?punto=<id>`              | Sale desde ese punto de ruta del sector (por ejemplo, `der_f`); sirve para capturas comparables y para la demo. |
| `?debug`                   | Muestra el contador de FPS y el nivel de calidad en la navegación.            |
| `?perfil=windows` / `general` | Fuerza el perfil de rendimiento (por defecto se detecta la plataforma). |

Se pueden combinar: `?quality=low&debug`.

**Perfil de Windows.** En Windows el navegador dibuja WebGL a través de Direct3D (ANGLE), y los portátiles
suelen tener escalado de pantalla y GPU integrada. Ahí, sobre cualquier nivel de calidad, se aplica un perfil algo
más ligero (`forPlatform` en `src/engine/quality.ts`):
- **Resolución:** dpr máximo de 1,25 y un 30 % menos de píxeles como tope.
- **Antialias y bloom:** MSAA de 2 como máximo y bloom a media resolución interna.
- **Lente:** sin aberración cromática.
- **Cielo:** una capa de nebulosa menos y cielo horneado a 768 px como máximo.
- **Partículas:** menos estrellas, partículas y rocas de relleno.

Además, baja de nivel por debajo de 50 FPS en vez de 46. En Linux y macOS no cambia nada. Con `?debug` se ve
«perfil Windows» junto a los FPS.

## Uso

- **Selección:** una galaxia espiral inclinada, procedural, que gira muy despacio sobre la nebulosa y tres capas
  de estrellas con paralaje que siguen al cursor. Cada sector es una **región** de la galaxia (una elipse en el
  plano del disco, en la posición medida del boceto). En reposo, la región tiene un brillo leve y un borde punteado
  que recorre un destello. Con el cursor, el foco (Tab) o un toque, la región se ilumina, el borde se vuelve
  continuo, sale un pulso y aparece la tarjeta. Clic o Enter salta al sector. α y β son navegables; ε muestra
  «Próximamente». La geometría (`backdrop/galaxy.ts`) la comparten el shader y el HTML, y tiene pruebas.
- **Salto:** rayas de estrellas y acercamiento (cambio de campo de visión) hacia el sector, un destello, y la cámara
  llega desde atrás con un FOV amplio hasta el primer punto. Con `prefers-reduced-motion` solo hay un fundido.
- **Vuelo libre:** se mantiene pulsada la tecla o el botón:

  | Acción | Teclas |
  | --- | --- |
  | Acelerar | `W` o `↑` |
  | Frenar o ir marcha atrás | `S` o `↓` |
  | Girar | `A`/`D` o `←`/`→` |
  | Subir | `E` o `Espacio` |
  | Bajar | `Q` o `C` |

  Con **clic derecho y arrastrar** se dirige la nave: arrastrar a los lados cambia el rumbo y arriba o abajo cambia
  el cabeceo (hasta ±60°). La nave sigue igual en pantalla; lo que cambia es hacia dónde avanza.

  La nave mira al frente y la cámara la sigue desde atrás. Se alabea al girar y se inclina al subir o bajar. Los
  controles en pantalla (abajo a la derecha, la cruz del boceto más «Subir» y «Bajar») funcionan igual y sirven en
  pantallas táctiles. `Esc` o «Volver a sectores» regresan a la selección con el foco en el sector visitado.
- **Área visitable:** es la caja que contiene todo el sector (todos los objetos, con margen), así que se puede
  llegar a cualquiera. Cerca del borde la nave frena sola, aparece el aviso «Límite del sector» y el borde del mapa
  se pone amarillo. Planetas y rocas no se atraviesan, pero uno se puede acercar mucho: solo muy cerca de
  la superficie la nave frena poco a poco y se desvía por el borde, con un destello muy leve del escudo y una
  pequeña sacudida. Los anillos sí se cruzan, porque son partículas (de canto y pegados a la cámara se desvanecen).
- **Solo cuerpos naturales en β:** la estación del boceto se retiró de la escena. En su sitio del boceto está
  «Cielo infrarrojo», un planeta cuya superficie es el primer mapa de todo el cielo de SPHEREx. Fuera de la vista
  inicial hay siete más hechos con imágenes de SPHEREx: «Vela», «Polvo de Vela» y «Nebulosa de Vela» (región
  molecular de Vela), «Plano galáctico» (el perfil de la Vía Láctea en el mapa del cielo) y «Burbuja», «Lazos
  galácticos» y «Filamentos» (recortes del mismo mapa).
  Las texturas salen de `tools/texturas_spherex.py`. Las tablas de medición del boceto de más abajo siguen
  describiendo el dibujo, que sí tiene la estación. El área de vuelo deja 170 u de margen alrededor de todo.
- **Cometas, estrellas fugaces y asteroides:** aparecen al azar alrededor de la nave y cruzan en cualquier
  dirección, casi siempre de lado y a distancias variadas. Solo unos pocos (3–6 %) vienen en rumbo de choque: la
  nave recibe un impacto (empujón, sacudida, destello y aviso) y se estabiliza sola en unos segundos. Es solo un
  efecto: no hay daño ni puntuación.
- **Ficha del objeto:** a menos de 120 u de un objeto con nombre, el panel izquierdo muestra su contexto y, si la
  hay, la imagen de la que se sacó (por ejemplo, las dos épocas de WISE 0855 para Ilmara).
- **HUD:** muestra el sector, el objeto con nombre más cercano (tipo y distancia) y la velocidad. El **mapa del
  área** (200 px; 120 px en pantallas estrechas) es una vista cenital del rectángulo visitable con los objetos a
  escala y con nombre, la nave como flecha con su cono de visión, y una barra de altura.
- **Sonido:** opcional, sintetizado con WebAudio (sin archivos). **Apagado por defecto.** No se crea el contexto de
  audio hasta pulsar el botón «Silencio/Sonido», así que nunca suena solo.

## Fidelidad a los bocetos

Los bocetos están en `docs/referencias/` (`boceto-seleccion.png`, `boceto-navegacion.png`; no se versionan). Todo
lo que se mide de ellos va a **`docs/referencias/layout.json`**, que sí se versiona y es la única fuente de la
composición. Lo leen `src/boceto.ts`, los objetos de β, la nave y la selección.

### Método de extracción (`tools/analizar_bocetos.py`)

1. **Franja de captura.** Se recorta la franja superior de cada imagen (filas cuyo fondo no es el del dibujo): 9 px
   en la navegación y 3 px en la selección.
2. **Segmentación por color.**
   - Navegación: blanco (mín(R,G,B) > 170, cierre de 7 px) para los objetos y azul (B > R+45 y B > G+60) para la
     nave y la cruceta.
   - Selección: trazo oscuro (< 200, cierre de 4 px para cerrar los círculos hechos a mano).
3. **Medidas por objeto.** Componentes conexas y contornos de OpenCV. De cada uno salen centroide y caja
   normalizados (0–1), área relativa, redondez 4πA/P², aspecto, solidez, ángulo y elongación por momentos, y huecos
   (contornos hijos). Las estrellas del fondo (≤ 40 px) se descartan con un área mínima de 80 px.
4. **Clasificación por reglas explícitas.**
   - Con hueco y alargado → estación.
   - Las dos mayores arriba a la izquierda → planetas.
   - La mayor e irregular arriba a la derecha → planeta con anillo.
   - La redonda más cercana al centro-derecha → esfera.
   - El resto → cuerpos pequeños.

   Cada objeto lleva una nota de confianza.
5. **Ancla por objeto.** Es el punto de pantalla donde debe caer su centro 3D y su diámetro aparente:
   - **Veshta** está recortado por el borde superior (punto ciego). Se completa como esfera del mismo ancho apoyada
     en su borde inferior; no cambia de tipo.
   - En la **estación**, el ancla es el centro del cilindro sin el asa; el asa se mide aparte.
6. **Nave.** Se miden en el trazo azul la nariz, las puntas de ala, la base de la nariz (hombro) y las líneas de la
   caja del motor. La geometría y el encuadre de la nave se ajustan por mínimos cuadrados (scipy) para que su
   silueta proyectada coincida con esos 6 puntos en una pantalla 16:9, conservando las proporciones del dibujo.
7. **Selección.** Se miden el marco (por recorridos de línea), el ícono de menú, los tres círculos (lazo cerrado,
   solidez ≥ 0,9) y la llamada (trazos que salen del círculo hacia la derecha).

### Cómo regenerar `layout.json` y volver a medir

```bash
cd experimental/explorar
python3 -m venv /tmp/explorar-venv                                   # venv desechable, fuera del repo
/tmp/explorar-venv/bin/pip install -r tools/requirements-analisis.txt
/tmp/explorar-venv/bin/python tools/analizar_bocetos.py --debug /tmp/explorar-analisis   # escribe layout.json
pnpm test                                                            # prueba de proyección (tolerancia 0,05)
pnpm build && pnpm preview &                                         # luego, comparación sobre el render real:
/tmp/explorar-venv/bin/python tools/comparar_vista.py --url http://localhost:4173/ --salida /tmp/explorar-comparacion.png
```

`comparar_vista.py` abre la vista inicial de β en Chrome sin interfaz, a 1280×720 y sin HUD, con todo DNS externo
bloqueado. Genera en `/tmp` una imagen lado a lado (boceto | escena) con las anclas y lo detectado, y la tabla de
error. Las imágenes no se versionan.

### Boceto vs escena (vista inicial de β, pantalla 16:9)

La «proyección» es la prueba pura (`src/sectors/beta/composicion.test.ts`, con la cámara de three como
implementación independiente). El «render» es lo medido en la captura real: se toma la componente brillante más
cercana al ancla. Tolerancia: 0,05 en coordenadas normalizadas.

| Objeto | Clase (confianza) | Boceto (u, v) | Proyección | Render (u, v) | Error en el render |
| --- | --- | --- | --- | --- | --- |
| Ilmara | planeta (alta) | 0,100, 0,143 | 0,0000 | 0,114, 0,146 | 0,015 |
| Veshta | planeta, recortado (media) | borde inferior 0,090, 0,055 | 0,0000 | 0,117, 0,067 | 0,030 |
| Orun | planeta con anillo (media) | 0,818, 0,327 | 0,0000 | 0,836, 0,319 | 0,019 |
| Estación Ancla | estación (alta) | 0,787, 0,673 | 0,0000 | 0,792, 0,621 | 0,053 ¹ |
| Esfera menor | esfera (media) | 0,722, 0,562 | 0,0000 | 0,729, 0,558 | 0,008 |
| c1 | cuerpo pequeño | 0,639, 0,341 | 0,0000 | 0,655, 0,335 | 0,016 |
| c2 | cuerpo pequeño | 0,198, 0,298 | 0,0000 | 0,207, 0,300 | 0,010 |
| c3 | cuerpo pequeño (irregular) | 0,334, 0,259 | 0,0000 | 0,341, 0,251 | 0,011 |
| c4 | cuerpo pequeño | 0,180, 0,224 | 0,0000 | 0,184, 0,228 | 0,006 |

¹ En la estación, el detector toma la franja de ventanas iluminadas (la parte alta del cilindro), no el cilindro
entero; en la imagen lado a lado la cruz del boceto cae sobre la estación. Hay además un sesgo de unas +0,01 en u
en casi todos los objetos: la luz llega por la derecha y el lado iluminado desplaza la caja detectada.

La proyección da 0 por construcción: la posición 3D se calcula invirtiendo la cámara de entrada. La prueba sirve
para comprobar que los datos llegan bien a la escena y que el encuadre de la app es el supuesto (FOV 50°, 16:9,
cabeceo 4° del punto de entrada). Los **tamaños aparentes** quedan a menos del 15 % de lo medido y conservan su
orden.

**Nave.** Por decisión posterior (la nave debe mirar al frente), ya no se reproduce la vista casi en planta del
boceto (el ajuste daba un cabeceo de 66°). Se conservan las proporciones medidas de la geometría y, en la primera
vista, su posición y su envergadura en pantalla: 0,292 frente a 0,2745 del boceto, centrada en el tercio inferior
(prueba en `composicion.test.ts`). El ajuste original, con un error de 0,009 a 0,020 en los 6 puntos de la
silueta, sigue en `layout.json` como referencia. Proporciones medidas:

- envergadura/largo 1,20;
- nariz 30 % del largo;
- cuerpo 25 % de la envergadura;
- motor 14 % del largo;
- punta de ala al 76 % del largo;
- barrido del borde de ataque 46°.

El ajuste daba un cabeceo de 66° porque el boceto es casi una vista en planta. Ahora la nave vuela horizontal.

**Selección** (centro en el marco): α 0,323, 0,270 · β 0,652, 0,353 · ε 0,457, 0,652, con un error ≤ 0,0005. Los
diámetros dibujados son ε > β > α (8,8 %, 8,1 % y 6,3 % del ancho del marco). Se conserva ese orden, escalado ×1,6
para que se puedan señalar con comodidad.

### Interpretaciones revisadas con los datos

| # | Interpretación anterior | Qué dicen los datos | Cambio |
| --- | --- | --- | --- |
| 1 | Menú hamburguesa en la barra de la app | Ícono dentro del marco, arriba a la izquierda (0,07, 0,09) | Se mantiene: es la esquina superior izquierda de la pantalla |
| 2 | Textos inventados neutros | — | Sin cambio |
| 3 | «Ocho cuerpos pequeños dispersos» | **Cuatro** cuerpos pequeños (uno triangular) más una esfera; c1 también es redondo | Corregido: 4 cuerpos con su posición medida. El relleno sembrado no aparece en la vista inicial |
| 4 | Estación con anillo **alrededor del centro** y radios | El asa sale **del extremo derecho** (hueco medido a la derecha del cilindro) | Corregido: anillo de atraque en el extremo, en el plano de la pantalla, con el largo y alto medidos |
| 5 | Nave cabeceada 29°, a contraluz | Silueta casi en planta, con la envergadura 1,2 veces el largo | Corregido: geometría y cabeceo ajustados a 6 puntos |
| 6 | Ruta de 7 puntos | — | **Sustituido por vuelo libre** (petición posterior). Los puntos siguen en los datos: la entrada es el punto de salida y el resto marca zonas despejadas para el relleno de rocas |
| 7 | Botones según el destino durante el movimiento | — | Sustituido: los botones se mantienen pulsados, como las teclas |
| 8 | Esc en la selección no hace nada | — | Sin cambio |
| 9 | α y ε enfocables | — | Sin cambio |
| 10 | Posición de las esferas «según proporciones» | Medidas: α, β y ε a ≤ 0,05 de lo que había | Corregido: posición exacta medida y orden de tamaños ε > β > α (antes β era la mayor) |
| — | Tarjeta **debajo** del sector | La llamada del boceto va **a la derecha**, centrada, con líneas guía | Corregido: tarjeta a la derecha con línea guía (a la izquierda si el sector está muy a la derecha; debajo en pantallas estrechas) |
| — | Anillo de Orun inclinado 24° | Eje mayor medido a 11° | Corregido: 11°. Proporción del anillo de Saturno (1,24–2,27 radios) |
| — | Esfera menor (ancla de la esfera) | Dos manchas redondas a la derecha: (0,64, 0,34) y (0,72, 0,56) | La esfera es la más cercana al «centro-derecha» (confianza media); la otra es un cuerpo pequeño |
| — | Cruceta abajo a la derecha | En cruz, centro ≈ (0,96, 0,80), el botón derecho cortado por el borde | Sin cambio: la cruz ya coincide |

## Texturas y fuentes

Se usan cinco texturas de fuentes con licencia verificada en su propia página (detalle en **ATTRIBUTIONS.md**;
panel «Créditos» en la interfaz):

- Solar System Scope (CC BY 4.0): Saturno y su anillo con transparencia para Orun.
- Ilmara no usa textura: es un mundo frío procedural inspirado en WISE 0855 (ver más abajo).
- NASA SVS, CGI Moon Kit (dominio público): color y relieve lunares para Veshta y la esfera menor, coloreados con
  su propia paleta y con relieve por derivadas.

Se descargan y reducen con `tools/preparar_texturas.py` (los originales quedan en `/tmp`). Los cuerpos siguen
siendo ilustrativos.

| Recurso | Peso |
| --- | --- |
| `bandas-saturno.webp` | 8,4 KB |
| `anillo-saturno.webp` | 3,0 KB (va incrustado en el chunk) |
| `luna-color.webp` | 73,9 KB |
| `luna-relieve.webp` | 22,1 KB |
| **Total** | **≈ 107 KB**, solo al entrar en un sector; presupuesto fijado en 300 KB |

**Cielo real de SPHEREx (etapa 4): omitido.** El registro de HiPS del CDS (MocServer) anuncia
`CDS/P/SPHEREx/QR2/color` en `https://alasky.cds.unistra.fr/SPHEREx/color` con teselas PNG. Sin embargo, el
servidor devolvió 404 a todo (`properties`, `Norder3/Allsky.png`, teselas de orden 0 y 3, e incluso un HiPS de
control) y el espejo `alaskybis` no respondió. Además, la ficha no declara ODbL: dice «Courtesy NASA/JPL-Caltech» con
la política de uso de imágenes de SPHEREx (`hips_copyright` CNRS/Unistra). Si se retoma, hay que revisar esa
licencia antes.

## Estructura

```text
src/
  index.ts                  # único export público: <Explorar />
  Explorar.tsx              # fases: selección → salto → navegación; sonido
  explorar.css              # estilos del componente (todo bajo .explorar / ex-*), tokens del visor
  App.tsx, main.tsx, app.css  # SOLO la app independiente (barra superior); no se exportan
  params.ts                 # ?quality y ?debug
  engine/                   # lógica pura, sin React ni three, con pruebas
    types.ts, graph.ts, navigation.ts, pose.ts, controller.ts, nearest.ts
    quality.ts              # presets y calidad adaptativa por FPS
    motion.ts               # salto, llegada, empuje de FOV, ajuste a pantalla vertical, empuje del motor
    dpad.ts, routeMap.ts    # estados de la cruceta y plano de la ruta
    scatter.ts, noise.ts, random.ts, easing.ts
  backdrop/                 # fondo de la selección en WebGL puro (sin three): nebulosa, estrellas y galaxia
  screens/                  # SectorSelect, NavigationScreen, DPad, RouteMap, NoWebGL, sceneLoader, webgl
  audio/                    # motor de sonido WebAudio y botón
  scene/                    # three (chunk diferido): planetas, cielo, estación, cuerpos, nave, estela, bloom
    shaders/                # GLSL propio: ruido, planeta, atmósfera, anillo, cielo, estrellas, estela
  sectors/                  # datos: alpha/, beta/ (objetos desde layout.json), epsilon/, registro y selector.ts
  boceto.ts                 # acceso tipado a docs/referencias/layout.json
  credits.ts                # créditos del panel (y prueba contra ATTRIBUTIONS.md)
  scene/assets/             # texturas empaquetadas (WebP)
tools/                      # medición de bocetos, comparación con el render y preparación de texturas (Python)
docs/referencias/           # layout.json (versionado) y los bocetos (sin versionar)
```

## Identidad visual (tomada del visor, sin paleta nueva)

Leí `web/src/index.css` y `web/src/App.css` (visor F01 de Santiago, PR #9, `ae983c9`) y copié sus tokens como
variables `--ex-*` en `.explorar`. Son el fondo `#030712`, las superficies `#0f172a`/`#111827`, los bordes
`#1e293b`/`#334155`, el texto `#e2e8f0`/`#f8fafc`/`#94a3b8`/`#64748b`, el acento sky `#38bdf8`, el botón primario
`#0284c7` y el aviso `#facc15`. También los radios 12/10/8/6 px y la píldora, la sombra `0 4px 6px -1px` y el anillo
de foco `0 0 0 3px rgba(56,189,248,.4)`. La fuente es la del sistema (`system-ui`) y la monoespaciada
`ui-monospace`, igual que en el visor, así que no hay fuente que empaquetar. El chip «PLANET X / SPHEREX» es el
`.header-badge` del visor. La nebulosa usa los mismos azules (`#0f172a`, `#0369a1`, `#38bdf8`).

**Encapsulación:** todos los selectores de `explorar.css` empiezan por `.explorar` o por una clase `ex-*`, y las
animaciones llevan prefijo `ex-`. No hay resets ni reglas para `:root`, `html`, `body` o elementos sueltos. Una
prueba (`src/styles.test.ts`) lo verifica. `app.css` sí tiene estilos globales, pero solo lo carga la app
independiente (`main.tsx`) y no viaja con `<Explorar />`.

## Rendimiento

- **Un solo chunk diferido para three.** La selección no carga three: su fondo es WebGL puro (un triángulo a
  pantalla completa) y dibuja también la galaxia y sus regiones. El chunk de la escena empieza a descargarse al pasar el cursor o
  enfocar β, así que el salto se solapa con la descarga.
- **Instancias y pocos draw calls.** Las estrellas son un único `Points`; los cuerpos pequeños, tres
  `InstancedMesh` (uno por forma base); la estela, otro `Points`. Los planetas usan esferas de 64×48 y la nave unos mil
  triángulos.
- **dpr limitado:** 1 en baja, 1,5 en media y 2 en alta. El bloom trabaja en mips de media resolución o menos.
- **Calidad adaptativa** (`engine/quality.ts`, probada). Mide los FPS por ventanas de 2 s e ignora los primeros
  1,5 s, las pausas largas y los tirones aislados. Con menos de 42 FPS baja un nivel (alta → media → baja) y espera
  4 s antes de otro cambio. Con 57 FPS o más durante 10 s vuelve a subir, nunca por encima del nivel inicial. Bajar
  de nivel quita el bloom, reduce la estela y los cuerpos de relleno, y baja el dpr y las octavas de ruido. El fondo
  de la selección usa el mismo mecanismo con su propia resolución.
- **`prefers-reduced-motion`.** El render es «bajo demanda» (solo cuando algo cambia). No hay giros, oscilación,
  estela animada, paralaje ni salto: los tramos son instantáneos y la entrada es un fundido.

### Tamaños de los chunks (build de producción)

| Archivo                  | Etapa 1               | Etapa 2 (pulido)      | Fidelidad             | Vuelo libre (esta)    |
| ------------------------ | --------------------- | --------------------- | --------------------- | --------------------- |
| `index-*.js` (principal) | 234,26 kB / 74,03 gz  | 256,95 kB / 82,53 gz  | 268,37 kB / 87,19 gz  | 271,99 kB / 88,66 gz  |
| `index-*.css`            | 5,43 kB / 1,86 gz     | 15,80 kB / 4,28 gz    | 17,57 kB / 4,62 gz    | 19,13 kB / 4,95 gz    |
| `SectorScene-*.js` (three, diferido) | 928,59 kB / 246,11 gz | 963,59 kB / 255,53 gz | 970,71 kB / 260,60 gz | 975,56 kB / 262,23 gz |
| Texturas (diferidas)     | —                     | —                     | 139,9 kB + anillo     | igual                 |

El chunk principal crece por `layout.json` (~10 kB): la selección y los datos de β lo leen.

## Etapa de calidad visual (β)

- **Nave nueva** (procedural, sin modelos externos):
  - casco PBR con paneles generados y cabina con reflejo;
  - alas con diedro y aletas;
  - dos motores con brillo y estela;
  - luces de navegación.
- **Ilmara deja de parecer Júpiter:** ahora es un mundo frío inspirado en WISE 0855, con vórtices, brillo
  propio tenue y atmósfera fina. Se retiró la textura de bandas de Júpiter del paquete y de los créditos.
- **Render:**
  - contraluz para la nave, bloom más suave y pase de lente (aberración cromática, grano y viñeta);
  - estrellas cercanas con paralaje y capas de nebulosa;
  - polvo sin rayas en reposo;
  - cámara con inclinación y anticipación.
- **Calidad:** nuevos campos por nivel (`chromatic`, `grain`, `nebulaLayers`, `nearStars`).
  - En «baja» no hay bloom, lente ni nebulosa extra.
  - La degradación automática no cambió.
- **Sin dependencias nuevas.** El chunk diferido de la escena pasa de 975,56 kB (262,23 kB gzip) a 985,13 kB
  (265,67 kB gzip), y las texturas bajan de ≈143 KB a ≈107 KB.

Detalle del sector en `src/sectors/beta/README.md`.

## Decisiones

- **No se añadieron dependencias.** El bloom usa `EffectComposer`, `RenderPass`, `UnrealBloomPass` y `OutputPass`,
  que vienen con `three` (`three/examples/jsm`, MIT). El ruido GLSL, los shaders, la estela y la nave son código
  propio. No uso `@react-three/drei` ni `postprocessing`: todo cupo en +35 kB del chunk diferido, frente a los
  cientos de kB que habrían añadido.
- **Una sola estrella clave ilumina todo.** La luz direccional (nave, estación, cuerpos), los shaders de planetas,
  atmósferas y anillo, y el disco de la estrella en el cielo usan la misma dirección (`scene/light.ts`). La nave
  tiene además un relleno suave desde atrás, porque se ve a contraluz.
- **Planetas:** primero, superficie por ruido en GPU (sin costuras); cuando llega su textura de referencia (carga
  progresiva), color de la textura teñido hacia su paleta (gigantes) o su luminancia coloreada con la paleta
  (rocosos), con relieve por derivadas y detalle fino de ruido encima. Si una textura falla, sigue la procedural. El terminador es suave y hay
  una atmósfera aditiva con fresnel, más intensa del lado iluminado. El anillo tiene bandas, una división y
  transparencia, recibe la sombra del planeta y proyecta la suya sobre el planeta.
- **Cuerpos pequeños:** los 4 medidos en el boceto más un relleno sembrado (hasta 40). El relleno **nunca queda a
  menos de 14 unidades de la ruta** ni dentro de planetas, anillos o la estación (probado), y no aparece en la vista
  inicial, para que esta reproduzca el boceto. Al bajar la calidad solo se quitan cuerpos, no se mueven.
- **Vuelo** (`engine/flight.ts`, puro y probado):
  - El modelo es «arcade»: rumbo, empuje, altura y un cabeceo que solo se dirige con clic derecho (hasta ±60°).
  - Velocidad máxima 30 u/s y 9 u/s marcha atrás; giro de hasta 60°/s con respuesta suave.
  - La nave no derrapa (sigue su morro) y se frena sola al soltar.
  - Límites con margen suave de 30 u y tope duro.
  - Acercamiento suave a los obstáculos: la velocidad hacia el objeto se reduce poco a poco solo dentro de una
    franja muy cercana a la superficie (el 20 % del radio, mínimo 8 u), y se conserva la tangencial, así que la nave
    se desvía en lugar de pararse en seco.
  - Impactos (`applyImpact`): empujón y giro breves que se disipan solos en unos segundos.
- **Visitantes** (`engine/visitors.ts`, puro, determinista y probado): un cometa cada 35–60 s y un meteorito cada
  12–22 s. Entran por delante de la nave y cruzan la vista; un 35 % viene directo y choca.
- **Cámara de persecución** (`scene/chase.ts`):
  - Detrás y arriba de la nave (2,5 u arriba, 8 u atrás), mirando 6° hacia abajo; la nave queda en el tercio
    inferior.
  - Sigue a la nave con suavizado: al girar, la nave se adelanta y la cámara la alcanza.
  - El FOV se abre hasta 9° con la velocidad.
  - El punto de salida se define con esta misma cámara, así la **primera vista sigue siendo la del boceto**.
- **Realismo, sin dependencias nuevas:**
  - Mapa de entorno generado del propio cielo (PMREM), con el que la nave y la estación reflejan la nebulosa y la
    estrella.
  - Tono fílmico AgX, MSAA en el composer, viñeta suave y bloom contenido.
  - Polvo espacial que se estira en rayas con la velocidad (efecto de referencia de movimiento, no un objeto).
  - Estela en el espacio del mundo (queda atrás al avanzar) y brillo de la tobera que sigue al empuje.
  - Luces de navegación (roja a babor, verde a estribor, estroboscópica en la cola).
  - Rocas con forma de ruido suave y la textura lunar de NASA (color y relieve).
- **Pantallas verticales:** se conserva el campo de visión horizontal del encuadre 16:9 (hasta 92° vertical) y la
  nave se reduce y baja (`cameraFit`, probado). El HUD se apila y la cruceta crece para el tacto.
- **Sin WebGL:** se comprueba antes de montar la escena y se muestra un aviso con el estilo de error del visor y un
  botón para volver. Si la escena falla después, un ErrorBoundary muestra el mismo aviso. La selección sigue
  funcionando con un fondo SVG.

## Interpretaciones (ambigüedades)

1. **Identidad «del visor»:** tomé los tokens de `web/` (sky, slate, sistema), como pediste. El prototipo de Alexis
   en `docs/decisiones/prototipo-interfaces/` usa otra identidad (dorado, Instrument Serif); no la usé.
2. **«Botón WISE 0855»:** el visor de `main` (`web/`, PR #9) **no lo tiene**. Sus ejemplos son «Ejemplo listo»,
   «Insuficiente», «Sin cobertura» y «Error temporal». Lo tomé como referencia tal cual.
3. **Estrella clave:** es una fuente de luz en el cielo (núcleo con halo), no un objeto navegable. No añade ningún
   tipo de entidad del boceto.
4. **Detalle de la estación:** paneles con ventanas iluminadas, tapas, puertos de atraque, anillo con radios y luces
   de posición que parpadean. Sigue siendo el cilindro con anillo del boceto.
5. **Nave:** procedural (fuselaje torneado, cabina, alas barridas con franja luminosa, bloque de motor con tobera).
   Respeta la silueta del boceto: nariz, alas barridas y motor. No hay modelos glTF.
6. **«Objeto cercano»:** lo fija cada punto con `focusId`. El HUD muestra también el tipo («Planeta con anillo»,
   «Estación», etc.).
7. **Tarjeta de sector:** además de nombre y descripción muestra datos derivados de la configuración (puntos de
   ruta y objetos con nombre), sin inventar contenido.
8. **Sonido:** zumbido grave del motor, un barrido de ruido en cada tramo y un barrido ascendente en el salto. No se
   guarda la preferencia: siempre empieza apagado.
9. **Las 10 interpretaciones de la primera etapa** se revisaron contra las medidas. Las correcciones están en
   «Interpretaciones revisadas con los datos»; en particular, la estación (punto 4 de arriba) ahora lleva el asa en
   un extremo, no un anillo en el centro.

## Cómo añadir o activar α y ε

1. En `src/sectors/alpha/index.ts` (o `epsilon/`) añade `scene: { startId, waypoints, objects, field? }`, siguiendo
   `src/sectors/beta/`. Para un sector nuevo, crea `src/sectors/<id>/index.ts` con `export default`.
2. `pnpm test`: la prueba genérica valida el grafo, los `focusId` y que el relleno respete la ruta. No hay que tocar
   `engine/`, `screens/` ni `scene/`.

## Integración en `web/` (recomendación para Santiago)

> **Ya integrado.** El componente vive en `web/src/features/explorar/` y se entra desde el menú ☰ de secciones
> del visor (`web/src/app/Shell.tsx`), que también vuelve a «Inicio». Esta carpeta queda como laboratorio
> (app independiente, herramientas de medición y bocetos). Mientras convivan las dos copias, conviene hacer los
> cambios de producto en `web/` y retirar `experimental/explorar/src` en un PR posterior.

`<Explorar />` ocupa el 100 % de su contenedor (necesita una altura definida) y es lo único que se exporta:

```tsx
import { lazy, Suspense } from 'react'
const Explorar = lazy(() => import('../features/explorar').then((m) => ({ default: m.Explorar })))

<div style={{ height: 'calc(100dvh - 56px)' }}>
  <Suspense fallback={null}>
    <Explorar />
  </Suspense>
</div>
```

1. Copia `src/` sin `App.tsx`, `main.tsx` ni `app.css` a `web/src/features/explorar/`, junto con
   `docs/referencias/layout.json`. Ajusta la ruta de importación en `src/boceto.ts` y activa `resolveJsonModule`
   en el tsconfig de `web/`. `src/scene/assets/` viaja con `src/`.
2. Añade a `web/package.json` `three@0.187.0`, `@react-three/fiber@^9.8.2` y `@types/three@0.187.0`, con las mismas
   versiones que aquí.
3. Carga `Explorar` con `lazy`, como arriba. Así ni el componente ni three pesan en el visor hasta que se abre la
   sección.
4. En `web/vite.config.ts`, `test.css: true` solo si quieres conservar la prueba de encapsulación; `web/` ya usa
   `jsdom`, y estas pruebas son de lógica y corren igual.
5. Mientras la navegación está abierta escucha `keydown`/`keyup` en `window` (WASD, flechas, Esc). Se ignora con
   modificadores o con el foco en un campo de texto.
6. Ten en cuenta que `?quality` y `?debug` se leen de la URL del visor.

## Lista de comprobación para la laptop de la demo (GPU real)

Prepárala con `pnpm install --frozen-lockfile && pnpm build && pnpm preview`, abre `http://localhost:4173/?debug`
en Chrome y, ya cargada, **desconecta la red** (Wi-Fi apagado) y recarga.

| #  | Qué hacer                                   | Qué mirar                                                                                  |
| -- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1  | Mover el cursor en la selección             | Las estrellas y la nebulosa se desplazan con suavidad, sin tirones                         |
| 2  | Tab hasta β, luego Enter                    | Aparece la tarjeta; rayas, destello y llegada fluida (~1,1 s + ~1,5 s)                     |
| 3  | Leer el contador `?debug` en el vuelo       | **≥ 55 FPS en «alta»: ideal. 45–55: aceptable. < 42 sostenidos:** a los ~4 s debe bajar sola a «media» |
| 4  | Volar con W/A/S/D, E/Q y con los botones    | Aceleración y frenado suaves, giro con alabeo, cámara que sigue sin tirones, polvo y estela con la velocidad |
| 4b | Ir hasta el borde del mapa y hacia un planeta | Frena sola en el borde («Límite del sector»); junto al planeta frena despacio y se desvía, sin atravesarlo |
| 4d | Esperar unos 10–20 s en vuelo               | Un cometa cruza la vista; un meteorito que viene directo empuja la nave y ella se recupera |
| 4c | Mirar hacia la estrella clave (arriba a la derecha) | Brillo y reflejos en la nave sin quemar la imagen |
| 5  | Pulsar Esc                                  | Vuelve a la selección con el foco en β                                                     |
| 6  | Botón «Silencio» → «Sonido»                 | Zumbido bajo; barrido en cada tramo y en el salto; vuelve a silencio al pulsarlo           |
| 7  | Pantalla completa (F11) y ventana estrecha  | El HUD no tapa la nave; en vertical, la cruceta crece y la nave se reduce                  |
| 8  | Activar «reducir animaciones» en el sistema | Sin salto ni oscilación: fundido, tramos instantáneos, sin paralaje                        |
| 9  | `?quality=low&debug`                        | «calidad low (fija)», sin bloom. Si «alta» no llega a 45 FPS, usa este modo en la demo     |
| 10 | Pestaña Red de DevTools                     | Ninguna petición fuera de `localhost`                                                      |

Si el contador queda en «low» y por debajo de 30 FPS, la GPU integrada no da para esta escena: usa
`?quality=low` y avísame con el modelo de la laptop.

### Qué verifiqué y qué NO pude medir

Verificado con Chrome sin interfaz y render **por software** (SwiftShader), con capturas guardadas en `/tmp`:

- La selección, la tarjeta, el salto y la llegada.
- W/S/A/D y la cruceta (estados `active`, `disabled` e `idle` leídos del DOM).
- Esc con el foco devuelto a β y el botón de sonido (se enciende y se apaga).
- El modo de movimiento reducido (fundido y tramos instantáneos) y `?quality=low` y `?quality=high` con `?debug`.
- La pantalla vertical (390×844) y Chrome con WebGL desactivado (aviso).
- Cero peticiones fuera de `localhost`, con un DNS que bloquea todo lo externo.

**No pude medir:**

- **Los FPS en una GPU real.** Con SwiftShader marca 7 FPS en alta y 14 en baja; esos números no dicen nada de una
  laptop.
- El efecto visual del bloom en hardware real.
- El sonido por altavoces: solo probé con un `AudioContext` falso y sin errores de consola.
- Pantallas táctiles reales, Firefox y Safari, pantallas HiDPI reales, consumo de batería y calentamiento.

## Límites conocidos

- Las pruebas cubren la lógica (204): **vuelo libre** (aceleración, frenado, giro, cabeceo, altura, límites,
  acercamiento suave, impactos, cometas y meteoritos, obstáculos,
  determinismo), controles, mapa del área, área visitable del sector, calidad adaptativa, parámetros de URL,
  dispersión, curvas de movimiento, ruido, sonido, encapsulación del CSS, proyección del boceto (objetos, tamaños,
  nave en la primera vista, selección) y créditos. El motor de puntos de ruta (`graph`, `navigation`, `pose`,
  `controller`, `dpad`, `routeMap`) sigue en `engine/` con sus pruebas, pero β ya no lo usa. No hay pruebas de componentes
  DOM. El render se compara con `tools/comparar_vista.py`, fuera de `pnpm test`.
- La vista inicial reproduce el boceto en 16:9. En pantallas más anchas, los objetos se acercan al centro en
  horizontal; en más estrechas, se alejan (el FOV vertical es fijo en horizontal).
- `@react-three/fiber` 9.8.2 escribe en consola «THREE.Clock: This module has been deprecated». Es interno de la
  librería.
- En vertical muy estrecho, los objetos de los bordes del encuadre del boceto quedan parcialmente fuera.
- El salto espera al chunk de three. Con una red local muy lenta, el destello final puede alargarse un poco.

## Licencias

**No se añadió ninguna librería.** Las únicas piezas de terceros que no son código son las cinco texturas
empaquetadas de NASA SVS (dominio público) y Solar System Scope (CC BY 4.0), detalladas en **ATTRIBUTIONS.md**. La
nave, la estación, el ruido y los shaders son código propio. Las herramientas de `tools/` usan numpy, OpenCV,
Pillow, scipy y websocket-client en un venv desechable fuera del repo (`tools/requirements-analisis.txt`). No son
dependencias de la app.

Dependencias de ejecución (en el navegador):

| Librería                                                                    | Licencia     |
| --------------------------------------------------------------------------- | ------------ |
| [react](https://github.com/facebook/react), react-dom (19.3.1)              | MIT          |
| [three](https://github.com/mrdoob/three.js) (0.187.0), incluidos los pases de postproceso de `three/examples/jsm` | MIT |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) (9.8.2)   | MIT          |
| Transitivas de fiber: zustand, its-fine, suspend-react, react-use-measure, scheduler, @babel/runtime, use-sync-external-store, buffer, base64-js | MIT |
| Transitiva de fiber: ieee754                                                | BSD-3-Clause |

Solo de desarrollo (no se distribuyen): typescript 7.0.2 (Apache-2.0), vite 8.3.8 y @vitejs/plugin-react 6.3.0
(MIT), vitest 5.1.0 (MIT), @types/react, @types/react-dom y @types/three (MIT). Entre las transitivas de desarrollo
hay dos casos que conviene nombrar:

- **`lightningcss` (MPL-2.0):** minificador de CSS que usa Vite en el build. No se incluye en el resultado, igual que
  en `web/`.
- **`@dimforge/rapier3d-compat` (Apache-2.0):** solo tipos, vía `@types/three`.
