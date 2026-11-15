# Explorar (extra independiente)

Pequeña simulación de exploración espacial para Planet X. Se elige un sector en un campo estelar y se salta a él;
después se navega en nave, de punto en punto, por una escena 3D. **Es ilustrativa: no usa datos reales de SPHEREx.**

El proyecto vive aislado en `experimental/explorar/`, con su propio `package.json` y `pnpm-lock.yaml`, fuera de
cualquier workspace. No toca `web/`, `api/`, `infra/` ni Docker. **No hace llamadas de red en ejecución:** no usa
CDN, fuentes, texturas ni modelos remotos. Las superficies, la nebulosa y las esferas se generan con shaders y canvas
en el navegador, y la fuente es la del sistema, como en el visor. Funciona sin conexión.

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
| `pnpm test`      | Vitest (113 pruebas de lógica y de encapsulación del CSS)   |
| `pnpm build`     | Typecheck + build de producción en `dist/`                  |
| `pnpm preview`   | Sirve `dist/`                                               |

### Parámetros de URL

| Parámetro                  | Efecto                                                                         |
| -------------------------- | ------------------------------------------------------------------------------ |
| `?quality=low` / `?quality=high` | Fija la calidad y desactiva el ajuste automático. Otro valor = automático. |
| `?debug`                   | Muestra el contador de FPS y el nivel de calidad en la navegación.            |

Se pueden combinar: `?quality=low&debug`.

## Uso

- **Selección:** nebulosa y tres capas de estrellas con paralaje que siguen al cursor. Los sectores son cuerpos
  renderizados con halo y órbita. Con hover, foco (Tab) o toque aparece la tarjeta. Clic o Enter salta al sector.
  Hoy solo β es navegable; α y ε muestran «Próximamente».
- **Salto:** rayas de estrellas y acercamiento (cambio de campo de visión) hacia el sector, un destello, y la cámara
  llega desde atrás con un FOV amplio hasta el primer punto. Con `prefers-reduced-motion` solo hay un fundido.
- **Navegación:** `W`/`↑` avanza, `S`/`↓` retrocede, `A`/`←` y `D`/`→` van a los laterales. Cada tramo dura 1 s con
  suavizado y las entradas se ignoran mientras dura; mantener la tecla encadena el siguiente tramo. La cruceta
  (abajo a la derecha) usa el mismo manejador y muestra su atajo. Sus estados son deshabilitado (sin punto en esa
  dirección), activo (moviéndose en esa dirección) y pulsado. `Esc` o «Volver a sectores» regresan a la selección
  con el foco en el sector visitado.
- **HUD:** sector, punto actual, objeto cercano y su tipo, e indicador de ruta (plano cenital con el punto actual
  resaltado y el tramo en curso animado).
- **Sonido:** opcional, sintetizado con WebAudio (sin archivos). **Apagado por defecto.** No se crea el contexto de
  audio hasta pulsar el botón «Silencio/Sonido», así que nunca suena solo.

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
  backdrop/                 # fondo de la selección en WebGL puro (sin three) y esferas en canvas 2D
  screens/                  # SectorSelect, NavigationScreen, DPad, RouteMap, NoWebGL, sceneLoader, webgl
  audio/                    # motor de sonido WebAudio y botón
  scene/                    # three (chunk diferido): planetas, cielo, estación, cuerpos, nave, estela, bloom
    shaders/                # GLSL propio: ruido, planeta, atmósfera, anillo, cielo, estrellas, estela
  sectors/                  # datos: alpha/, beta/, epsilon/ y el registro
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
  pantalla completa) y las esferas son canvas 2D. El chunk de la escena empieza a descargarse al pasar el cursor o
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

| Archivo                  | Antes (etapa 1)       | Después               |
| ------------------------ | --------------------- | --------------------- |
| `index-*.js` (principal) | 234,26 kB / 74,03 gz  | 256,95 kB / 82,53 gz  |
| `index-*.css`            | 5,43 kB / 1,86 gz     | 15,80 kB / 4,28 gz    |
| `SectorScene-*.js` (three, diferido) | 928,59 kB / 246,11 gz | 963,59 kB / 255,53 gz |

## Decisiones

- **No se añadieron dependencias.** El bloom usa `EffectComposer`, `RenderPass`, `UnrealBloomPass` y `OutputPass`,
  que vienen con `three` (`three/examples/jsm`, MIT). El ruido GLSL, los shaders, la estela y la nave son código
  propio. No uso `@react-three/drei` ni `postprocessing`: todo cupo en +35 kB del chunk diferido, frente a los
  cientos de kB que habrían añadido.
- **Una sola estrella clave ilumina todo.** La luz direccional (nave, estación, cuerpos), los shaders de planetas,
  atmósferas y anillo, y el disco de la estrella en el cielo usan la misma dirección (`scene/light.ts`). La nave
  tiene además un relleno suave desde atrás, porque se ve a contraluz.
- **Planetas:** superficie por ruido en GPU, calculado en el espacio del objeto, así que no tiene costuras. Hay dos
  tipos: bandas torcidas por turbulencia (gigantes) y roca con crestas y depresiones. El terminador es suave y hay
  una atmósfera aditiva con fresnel, más intensa del lado iluminado. El anillo tiene bandas, una división y
  transparencia, recibe la sombra del planeta y proyecta la suya sobre el planeta.
- **Cuerpos pequeños:** los 8 del boceto más un relleno sembrado (hasta 40) que **nunca queda a menos de 7 unidades
  de la ruta** ni dentro de planetas, anillos o la estación (probado). Al bajar la calidad solo se quitan cuerpos,
  no se mueven.
- **Movimiento:** sigue siendo lineal por puntos de ruta. Al pose del grafo se le suman la llegada, el empuje de FOV
  (+7° a mitad de tramo), una leve oscilación de cámara y el alabeo de la nave en A/D.
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
9. **Las 10 interpretaciones de la primera etapa** siguen vigentes: menú solo en la app independiente, α y ε
   enfocables con `aria-disabled`, rejilla de 7 puntos, Esc en la selección no hace nada, etc.

## Cómo añadir o activar α y ε

1. En `src/sectors/alpha/index.ts` (o `epsilon/`) añade `scene: { startId, waypoints, objects, field? }`, siguiendo
   `src/sectors/beta/`. Para un sector nuevo, crea `src/sectors/<id>/index.ts` con `export default`.
2. `pnpm test`: la prueba genérica valida el grafo, los `focusId` y que el relleno respete la ruta. No hay que tocar
   `engine/`, `screens/` ni `scene/`.

## Integración en `web/` (recomendación para Santiago)

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

1. Copia `src/` sin `App.tsx`, `main.tsx` ni `app.css` a `web/src/features/explorar/`.
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
| 3  | Leer el contador `?debug` en la navegación  | **≥ 55 FPS en «alta»: ideal. 45–55: aceptable. < 42 sostenidos:** a los ~4 s debe bajar sola a «media» |
| 4  | Recorrer con W/A/S/D y con la cruceta       | Tramos de ~1 s, estela más larga al avanzar, nave inclinada en A/D, botones con estado correcto |
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

- Las pruebas cubren la lógica (113): grafo, navegación, pose, calidad adaptativa, parámetros de URL, estados de la
  cruceta, plano de ruta, dispersión, curvas de movimiento, ruido, sonido y encapsulación del CSS. No hay pruebas de
  componentes DOM ni de render.
- `@react-three/fiber` 9.8.2 escribe en consola «THREE.Clock: This module has been deprecated». Es interno de la
  librería.
- En vertical muy estrecho, los objetos de los bordes del encuadre del boceto quedan parcialmente fuera.
- El salto espera al chunk de three. Con una red local muy lenta, el destello final puede alargarse un poco.

## Licencias

**No se añadió ninguna librería en esta etapa.** No se incluyen modelos, imágenes, fuentes ni texturas de
terceros: la nave, los objetos, el ruido, los shaders y las texturas son código propio de este proyecto.

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
