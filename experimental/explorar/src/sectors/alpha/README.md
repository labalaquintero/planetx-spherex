# Sector α · brief para construirlo

Hoy α es un marcador «Próximamente»: `index.ts` solo tiene la configuración de la pantalla de
selección y **no tiene `scene`**. Este documento reúne lo necesario para construir su escena sin depender
de nadie. Lo marcado como **pendiente de Isaac** todavía no está decidido; pregúntale o propón algo en
tu PR.

## 1. Objetivo y cómo debe sentirse

**Ya decidido (está en el código o en los bocetos):**

- α aparece **arriba a la izquierda** en la pantalla de selección. Su posición y tamaño ya se miden del
  boceto (`selectorFromSketch('alpha')` en `index.ts`); no hay que tocarlos.
- Mientras no tenga `scene`, la tarjeta dice «Próximamente» y no se puede entrar. Con `scene`, se entra
  igual que a β.
- Usa **el mismo motor que β**: vuelo libre en nave (W/S, A/D, E/Q), cámara de persecución, mapa del área,
  límites del sector y colisiones. No hay que programar nada de eso.
- Mismo estilo que el visor: sobrio, azul marino, con el aviso **«Representación ilustrativa, no son
  datos reales de SPHEREx»** (ya lo pone el HUD).

**Propuesta, pendiente de que Isaac la confirme:**

- α es el sector que **parte de datos reales**: su composición se guía por el campo real de WISE 0855 (los
  dos recortes de SPHEREx en `docs/referencias/wise0855/`). Las fuentes brillantes de esas imágenes marcan
  dónde y de qué tamaño relativo van los cuerpos.
- Sensación: más tranquilo y «de observación» que β (menos objetos grandes, más campo abierto), sin
  perder la belleza de β.

## 2. Material disponible (todo en el repo)

| Qué | Dónde |
| --- | --- |
| Boceto de la selección (α arriba a la izquierda) | `experimental/explorar/docs/referencias/boceto-seleccion.png` |
| Boceto de la navegación (composición de referencia de β) | `experimental/explorar/docs/referencias/boceto-navegacion.png` |
| Medidas de los bocetos (incluye la posición de α en la selección) | `experimental/explorar/docs/referencias/layout.json` |
| Imágenes reales de WISE 0855 (64 × 64, 2 épocas) y su manifiesto | `experimental/explorar/docs/referencias/wise0855/` (lee su `README.md`) |
| Detalle científico de esas imágenes | `docs/decisiones/f01-par-wise0855.md` |
| Ejemplo completo de sector | `experimental/explorar/src/sectors/beta/` |
| Herramientas de medición de β (para inspirarte) | `experimental/explorar/tools/` |
| Documentación general de Explorar | `experimental/explorar/README.md` |
| Cómo se pasa un sector al visor | `experimental/explorar/docs/SINCRONIZACION.md` |

## 3. Qué espera el motor: formato de la escena

Tipos en `src/engine/types.ts`. Un sector es un `export default` de tipo `SectorConfig`. El registro
(`src/sectors/index.ts`) descubre la carpeta solo; no hay que registrarla en ningún sitio.

```ts
// src/sectors/alpha/index.ts (esqueleto)
const alpha: SectorConfig = {
  id: 'alpha', symbol: 'α', name: 'Sector α', description: '…', order: 1,
  selector: { ...selectorFromSketch('alpha'), colors: [...], surface: 'rocky', seed: 5, glow: '…' },
  scene: {
    startId: 'entry',     // id del punto de salida
    waypoints: [...],     // Waypoint[]: al menos el de salida
    objects: [...],       // SceneObject[]: los cuerpos del sector
    field: { ... },       // opcional: relleno de cuerpos pequeños sembrado
  },
}
```

- **`waypoints`** (`Waypoint`: `id`, `name`, `position`, `yawDeg`, `pitchDeg`, `links`, `focusId?`). Con
  el vuelo libre, el que importa es el de salida (`startId`):
  - La nave aparece delante de él y la cámara se coloca en ese punto.
  - Usa `pitchDeg: -6` (el cabeceo de la cámara de persecución, `src/scene/chase.ts`), como hace la entrada
    de β en `beta/waypoints.ts`. Así lo que proyectes desde ese punto es lo que se ve al entrar.
  - El resto de puntos es opcional. Sirven para alejar el relleno de cuerpos de zonas de paso (`field.clearance`).
  - Si pones `links`, deben ser de ida y vuelta (`A.forward = B` ⇒ `B.back = A`); una prueba lo valida.
- **`objects`** (`SceneObject`): `id`, `kind`, `position`, `radius`, `seed`, `palette` y, opcionales,
  `label`, `surface` (`'bands'` o `'rocky'`), `atmosphere`, `ring`, `length` y `handle` (estación),
  `rotationDeg` y `texture`.
  - **Solo existen estos `kind`:** `planet`, `ringedPlanet`, `station`, `sphere`, `smallBody`. No hay que
    inventar otros.
  - Los objetos con `label` aparecen en el mapa y en «Cerca de…» del HUD.
- **El área de vuelo se calcula sola** (`sectorBounds` en `src/engine/flight.ts`): es la caja que
  contiene todos los objetos más 45 unidades de margen. Los objetos son obstáculos que no se atraviesan
  (los anillos sí, porque son partículas).
- **Texturas:** `texture.map`, `texture.bump` y `texture.ringMap` solo pueden usar las que ya están en
  `src/scene/assets.ts`: `bandas-jupiter`, `bandas-saturno`, `anillo-saturno`, `luna-color` y
  `luna-relieve`.
- **Colocar objetos «donde se ven»:** usa `screenToWorld(u, v, profundidad, cámara)` y
  `radiusForScreenSize(diámetro, profundidad, fov)` de `src/engine/projection.ts`, como hace
  `beta/objects.ts`. `(u, v)` son coordenadas de pantalla de 0 a 1 vistas desde el punto de salida.

## 4. Qué puedes tocar y qué no

**Puedes tocar:**
- `experimental/explorar/src/sectors/alpha/` (la escena; puedes crear `objects.ts`, `waypoints.ts` y
  pruebas `*.test.ts`, como en β).
- `experimental/explorar/tools/alpha/` (tus scripts de análisis; si son Python, en un venv fuera del repo).
- `experimental/explorar/docs/referencias/alpha/` (tus mediciones, por ejemplo un `layout-alpha.json`, y
  tus notas).

**No toques:**
- El motor: `src/engine/`, `src/scene/`, `src/screens/`, `src/backdrop/`, `Explorar.tsx`, `explorar.css`.
- `src/sectors/beta/` (Isaac lo sigue mejorando en paralelo).
- `tools/check_role_paths.py`, `.github/` y `web/`.

Si necesitas algo de esa lista, por ejemplo una textura nueva o un tipo de objeto nuevo, déjalo propuesto
en `docs/referencias/alpha/` y avisa a Isaac.

**Pendiente de Isaac (bloquea activar α):** `src/sectors/sectors.test.ts` comprueba hoy que «solo β es
navegable» (líneas 14–16). En cuanto α tenga `scene`, esa prueba fallará, y está fuera de tu carpeta.
Avísale para que la actualice en el mismo PR o en uno previo.

## 5. Método

1. **Primero las imágenes reales:** mide las fuentes de los recortes de WISE 0855 (posición, brillo
   relativo, diferencias entre épocas) con un script en `tools/alpha/` y guarda el resultado en
   `docs/referencias/alpha/`, como hace β con `tools/analizar_bocetos.py` → `layout.json`.
2. **Proyecta desde el punto de salida** (`screenToWorld`) para que, al entrar, la composición recuerde a la
   imagen. Elige las profundidades a mano (es lo único que la imagen no dice).
3. **Relleno determinista:** nada de `Math.random()`. Usa `seed` en los objetos y `field.seed` para el
   relleno, para que cada recarga sea idéntica y las pruebas sean estables.
4. **Sin entidades nuevas:** solo los cinco `kind` de arriba. Nada de criaturas, naves extra ni
   estructuras que no estén en los bocetos.
5. **Aviso y créditos:** se mantiene «Representación ilustrativa». Si usas las imágenes de WISE 0855, el
   crédito es «Courtesy NASA/JPL-Caltech» (ver su README). Si propones texturas nuevas, solo de fuentes con
   licencia verificada (NASA, ESA, USGS, CDS, CC0 o CC BY) y con URL, autor, licencia y fecha anotados.
   Isaac las añade a `ATTRIBUTIONS.md` y al panel «Créditos».

## 6. Cómo probarlo

```bash
cd experimental/explorar
pnpm install --frozen-lockfile
pnpm dev            # http://127.0.0.1:5174 → elige α
pnpm typecheck
pnpm test           # incluye la validación genérica de todo sector con escena (graph.test.ts)
pnpm build
```

En Windows (PowerShell) son los mismos comandos. Antes de abrir el PR: `pnpm typecheck`, `pnpm test` y
`pnpm build` deben pasar, y la escena no debe hacer peticiones de red (todo recurso va empaquetado).

## 7. Entrega

- Un PR desde una rama tuya contra `main`, solo con archivos de las carpetas permitidas (más el cambio de
  `sectors.test.ts` coordinado con Isaac).
- En la descripción, incluye una captura de la vista al entrar y explica de dónde salió cada posición.
- Pasar α al visor (`web/`) es un paso aparte: ver `docs/SINCRONIZACION.md`.
