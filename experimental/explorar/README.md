# Explorar (extra independiente)

Pequeña simulación de exploración espacial para Planet X: se elige un sector en un campo estelar y se navega en
nave, por puntos de ruta predefinidos, por una escena 3D. **Es ilustrativa: no usa datos reales de SPHEREx.**

Vive aislado en `experimental/explorar/`, con su propio `package.json` y `pnpm-lock.yaml`, fuera de cualquier
workspace. No toca `web/`, `api/`, `infra/` ni Docker. No hace llamadas de red en ejecución (sin CDN, fuentes ni
texturas remotas): las texturas se generan en el navegador con canvas y el resto es geometría, así que funciona sin
conexión.

## Cómo correrlo

Requiere Node 24 y pnpm.

```bash
cd experimental/explorar
pnpm install
pnpm dev          # http://127.0.0.1:5174
```

| Comando          | Qué hace                                                  |
| ---------------- | --------------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo                                    |
| `pnpm typecheck` | `tsc --noEmit` (modo estricto)                            |
| `pnpm test`      | Vitest: grafo de ruta de β, máquina de navegación y datos |
| `pnpm build`     | Typecheck + build de producción en `dist/`                |
| `pnpm preview`   | Sirve `dist/` para probar el build                        |

## Uso

- **Selección de sector:** tres esferas (α, β, ε). Al pasar el cursor, enfocar con Tab o tocar una esfera aparece
  una tarjeta con su nombre y descripción. Click, toque o Enter/Espacio entran. Hoy solo β funciona; α y ε muestran
  «Próximamente».
- **Navegación:** `W`/`↑` avanza, `S`/`↓` retrocede, `A`/`←` y `D`/`→` van a los puntos laterales. También hay una
  cruceta en pantalla (abajo a la derecha) con el mismo manejador; un botón se deshabilita si no hay punto en esa
  dirección. Cada movimiento dura 1 s con suavizado y las entradas se ignoran mientras dura. `Esc` o «Volver a
  sectores» regresan a la selección.
- **Barra superior (solo app independiente):** el ícono de menú abre la lista de secciones: «Explorar» activa y dos
  marcadores «Próximamente» deshabilitados (sin contenido inventado).

## Estructura

```text
src/
  index.ts                  # único export público: <Explorar />
  Explorar.tsx              # alterna selección de sector ↔ navegación
  App.tsx, main.tsx, app.css  # SOLO la app independiente (barra superior y menú)
  explorar.css              # estilos del componente (todo bajo .explorar / ex-*)
  engine/                   # lógica pura, sin React ni three, con pruebas
    types.ts                # SectorConfig, Waypoint, SceneObject
    graph.ts                # buildGraph + validateGraph
    navigation.ts           # máquina de estados (requestMove, advance)
    pose.ts, easing.ts      # interpolación suave y alabeo en A/D
    controller.ts           # NavController: une la máquina con React y el render
    nearest.ts              # objeto «cercano» del HUD + validación
  sectors/
    index.ts                # registro: descubre src/sectors/*/index.ts solo
    beta/                   # index.ts (config), waypoints.ts, objects.ts
    alpha/, epsilon/        # solo config (Próximamente)
  screens/                  # SectorSelect, NavigationScreen, DPad, ErrorBoundary
  scene/                    # three: Ship, SceneObjects, Stars, textures, SectorScene (carga diferida)
```

## Decisiones

- **Dependencias mínimas:** `react`, `react-dom`, `three` y `@react-three/fiber`. No se usó `@react-three/drei`:
  la nave, los planetas y la estación son primitivas o geometría propia, y las texturas son canvas. Un solo
  componente de `three` (`SectorScene`) importa la librería y se carga con `React.lazy`: al entrar a un sector
  se descarga un chunk aparte (~930 kB, ~246 kB gzip); la pantalla de selección no carga `three`.
- **Sectores dirigidos por datos:** cada sector es una carpeta `src/sectors/<id>/index.ts` que exporta un
  `SectorConfig`. El motor no conoce ningún sector. Un sector es navegable si y solo si trae `scene`
  (puntos de ruta y objetos).
- **Navegación lineal:** el grafo de puntos de ruta (id, posición, yaw/pitch en grados y vínculos
  adelante/atrás/izquierda/derecha) se valida: ids únicos, vínculos a nodos reales, regreso coherente
  (`A.forward = B` ⇒ `B.back = A`; igual con izquierda/derecha) y todo alcanzable. Una prueba genérica valida
  automáticamente cualquier sector con escena que se añada.
- **Rendimiento:** pocos polígonos (esferas 48×32, cuerpos pequeños de 80 caras), `dpr` limitado a `[1, 2]`,
  sin sombras ni postproceso, texturas de 512×256. Con `prefers-reduced-motion` los desplazamientos son
  instantáneos, no hay giros ni vaivén y el render pasa a «bajo demanda».
- **Accesibilidad:** esferas como `<button>` con `aria-label`; las tarjetas se muestran por hover y por foco
  (`:focus-within`) y están vinculadas con `aria-describedby`; el HUD anuncia cada punto en una región
  `aria-live`; el lienzo 3D es `aria-hidden`. Si WebGL no está disponible se muestra un aviso en lugar de una
  pantalla en blanco.
- **Tema:** azul marino oscuro; textos en español.

## Interpretaciones de los bocetos (ambigüedades)

1. **Menú y «Exp»:** el menú hamburguesa de la imagen 1 se implementó en la barra superior de la **app
   independiente** (`App.tsx`), no dentro de `<Explorar />`: el visor ya tendrá su propio menú. La flecha
   «Menú → Exp» se interpretó como «el menú lleva a la sección Explorar».
2. **Textos inventados (neutros):** descripciones de sectores y nombres de objetos (Ilmara, Veshta, Orun,
   Estación Ancla, Esfera menor) son marcadores ilustrativos, no nombres reales.
3. **Objetos blancos de la imagen 2** → composición de β: dos planetas grandes arriba a la izquierda (uno de bandas
   anaranjadas y otro rocoso azul grisáceo con cráteres); ocho cuerpos pequeños irregulares dispersos (sin
   etiqueta); un planeta de bandas con anillo inclinado arriba a la derecha; una estación (cilindro con paneles y
   ventanas, tapas en los extremos y un anillo con radios) a la derecha al medio; y una esfera pequeña cerca del
   centro-derecha. No hay otros tipos de entidad. La posición de cada objeto se declara con `fromView(x, y, profundidad)`
   («dónde se ve desde la entrada») y se reproduce la composición del boceto desde el primer punto de ruta.
4. **Nave:** modelo procedural visto desde atrás, ligeramente cabeceada hacia arriba para que se vea la nariz;
   fuselaje hexagonal, alas barridas, bloque de motor con tobera brillante y franjas azules en las puntas.
5. **Cruceta:** el boceto muestra una cruz de triángulos; se hizo una cruz de cuatro botones (adelante arriba,
   atrás abajo, izquierda y derecha a los lados).
6. **Ruta de β:** 7 puntos en una rejilla (entrada, corredor central, dos miradores, fondo y dos puntos finales).
   El «objeto cercano» del HUD lo fija cada punto con `focusId` (si falta, se usa el etiquetado más próximo).
7. **Botones durante un movimiento:** se calculan con el punto de destino; las pulsaciones se ignoran igualmente
   hasta llegar.
8. **Esc:** en la selección no hace nada. Con el menú de la app abierto, Esc solo cierra el menú.
9. **α y ε:** son enfocables (`aria-disabled`, no `disabled`) para que su tarjeta «Próximamente» sea alcanzable con
   teclado; activarlas no hace nada.
10. **Posición de las esferas de selección:** tomada de las proporciones del boceto (α arriba a la izquierda,
    β arriba a la derecha, ε al centro abajo), expresada en % del campo.

## Cómo añadir o activar α y ε

1. Abre `src/sectors/alpha/index.ts` (o `epsilon/`). Hoy solo tiene `id`, `symbol`, `name`, `description`,
   `order` y `selector`.
2. Añade `scene: { startId, waypoints, objects }`, siguiendo `src/sectors/beta/` (archivos `waypoints.ts` y
   `objects.ts`). Para sectores nuevos, crea la carpeta `src/sectors/<id>/index.ts` con un `export default`.
3. `pnpm test`: la prueba genérica valida el grafo y los `focusId` de todo sector con escena. No hay que tocar
   `engine/`, `screens/` ni `scene/`; el registro descubre la carpeta solo.

## Cómo lo montaría Santiago

`<Explorar />` ocupa el 100 % de su contenedor (necesita una altura definida) y es lo único que se exporta:

```tsx
import { lazy, Suspense } from 'react'
const Explorar = lazy(() => import('../features/explorar').then((m) => ({ default: m.Explorar })))

// en el menú del visor:
<div style={{ height: 'calc(100dvh - 56px)' }}>
  <Suspense fallback={null}>
    <Explorar />
  </Suspense>
</div>
```

Pasos: copiar `src/` (sin `App.tsx`, `main.tsx` y `app.css`) a `web/src/features/explorar/` (o importarlo desde
esta carpeta), añadir `three`, `@react-three/fiber` y `@types/three` a `web/package.json` (mismas versiones que aquí)
y listo. El proyecto usa `verbatimModuleSyntax` y `erasableSyntaxOnly` como `web/`, y `import.meta.glob` de Vite.
Los estilos están autocontenidos en `explorar.css` (clases `ex-*` bajo `.explorar`). Mientras la navegación está
abierta escucha `keydown` en `window` (WASD, flechas y Esc); se ignora si el foco está en un campo de texto.

## Límites conocidos

- La verificación visual se hizo en Chrome sin interfaz con render por software (SwiftShader). **No se midió el
  rendimiento en una GPU real**; se espera que sea fluido por la baja carga, pero conviene comprobarlo antes de la demo.
- En pantallas verticales (teléfono) la nave resulta grande y se ve menos escena: el campo de visión vertical es
  fijo. La demo está pensada para laptop.
- Las pruebas cubren la lógica (grafo, navegación, pose, datos y registro). No hay pruebas de componentes DOM;
  la interfaz se verificó a mano.
- `@react-three/fiber` 9.8.2 emite en consola el aviso «THREE.Clock has been deprecated» (interno de la librería).
- La nave y los modelos son sencillos a propósito. Las texturas se generan al entrar a un sector.

## Licencias

Todo lo que se usa es MIT, Apache-2.0 o similar. No se incluyen modelos, imágenes, fuentes ni texturas de terceros:
la nave, los objetos y las texturas son procedurales (código propio de este proyecto).

Dependencias de ejecución (en el navegador):

| Librería                                                                                        | Licencia |
| ----------------------------------------------------------------------------------------------- | -------- |
| [react](https://github.com/facebook/react), react-dom (19.3.1)                                  | MIT      |
| [three](https://github.com/mrdoob/three.js) (0.187.0)                                           | MIT      |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) (9.8.2)                       | MIT      |
| Transitivas de fiber: zustand, its-fine, suspend-react, react-use-measure, scheduler, @babel/runtime, use-sync-external-store, buffer, base64-js | MIT |
| Transitiva de fiber: ieee754                                                                    | BSD-3-Clause |

Solo de desarrollo (no se distribuyen): typescript 7.0.2 (Apache-2.0), vite 8.3.8 y @vitejs/plugin-react 6.3.0
(MIT), vitest 5.1.0 (MIT), @types/react, @types/react-dom y @types/three (MIT). Entre las transitivas de desarrollo
hay `lightningcss` (MPL-2.0, minificador de CSS que usa Vite en el build; es la única licencia copyleft débil y no
se incluye en el resultado, igual que en `web/`) y `@dimforge/rapier3d-compat` (Apache-2.0, solo tipos vía
`@types/three`).
