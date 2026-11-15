import { BASE_FOV_DEG } from '../../engine/motion'
import { radiusForScreenSize, REFERENCE_ASPECT, screenToWorld, type ViewCamera } from '../../engine/projection'
import type { SceneObject, SceneObjectKind } from '../../engine/types'
import { aPantalla, diametroEnPantalla, FUENTES, type FuenteMedida } from './campo'
import { ALPHA_INFO } from './info'
import { WAYPOINTS } from './waypoints'

/**
 * Objetos de α colocados SOBRE las fuentes reales de WISE 0855 (campo-wise0855.json). Cada objeto
 * lleva el id de su fuente (f01…f24) y, visto desde la entrada en una pantalla 16:9, su centro cae
 * en el centroide medido. Es dato: la posición relativa en pantalla y el orden de brillo. Es
 * ilustración: el tipo de cuerpo, la profundidad, el tamaño (exagerado en los cuerpos grandes) y el
 * aspecto. Las manchas del recorte son fuentes puntuales vistas a través del instrumento, no discos.
 */
const entry = WAYPOINTS.find((w) => w.id === 'entry')!

export const ENTRY_CAMERA: ViewCamera = {
  position: entry.position,
  yawDeg: entry.yawDeg,
  pitchDeg: entry.pitchDeg,
  fovDeg: BASE_FOV_DEG,
  aspect: REFERENCE_ASPECT,
}

interface Staging {
  readonly kind: SceneObjectKind
  readonly depth: number
  /** Diámetro en pantalla (fracción del alto). Sin valor: el de la mancha medida × ESCALA_ROCA. */
  readonly diameter?: number
  readonly label?: string
  readonly palette: readonly [string, string, string]
  readonly surface?: 'bands' | 'rocky'
  readonly atmosphere?: string
  readonly texture?: SceneObject['texture']
  readonly ring?: { readonly tiltDeg: number }
}

/** Proporción del anillo en radios del planeta (la de la textura de Saturno, como en β). */
const RING = { inner: 1.24, outer: 2.27 }

/** Una mancha del recorte es más ancha que una roca: los cuerpos pequeños se dibujan a esta fracción. */
export const ESCALA_ROCA = 0.45

const ROCA: readonly [string, string, string] = ['#8f96a3', '#5d6470', '#2f343c']

/**
 * Las cuatro fuentes más brillantes son los cuerpos grandes (pocos, como pide el brief). La más
 * brillante (f01) es el objeto focal. Profundidad y aspecto son elección de diseño.
 */
const GRANDES: Readonly<Record<string, Staging>> = {
  // Superficies: mapas globales reales de NASA/JPL/USGS (tools/alpha/texturas_nasa.py), usados como textura.
  // Desierto oxidado: Marte en color (Viking).
  f01: { kind: 'planet', depth: 230, diameter: 0.2, label: 'Óxido · f01', palette: ['#fde4c8', '#c2410c', '#3b1206'], surface: 'rocky', atmosphere: '#fdba74', texture: { map: 'marte-viking', mode: 'color' } },
  // Hielo rayado con anillo: Europa (Voyager) en azules; anillo de Saturno (Solar System Scope, CC BY 4.0).
  f02: { kind: 'ringedPlanet', depth: 285, diameter: 0.19, label: 'Hielo rayado · f02', palette: ['#f0f9ff', '#7dd3fc', '#0c4a6e'], surface: 'rocky', atmosphere: '#bae6fd', texture: { map: 'europa-voyager', mode: 'palette', ringMap: 'anillo-saturno' }, ring: { tiltDeg: 14 } },
  // Luna de azufre: Ío (Voyager con color de Galileo).
  f03: { kind: 'sphere', depth: 175, diameter: 0.075, label: 'Azufre · f03', palette: ['#fef08a', '#ca8a04', '#422006'], surface: 'rocky', texture: { map: 'io-galileo', mode: 'color' } },
  // Luna de surcos: Ganímedes (Voyager) en grises cálidos.
  f04: { kind: 'sphere', depth: 205, diameter: 0.07, label: 'Surcos · f04', palette: ['#e7e5e4', '#78716c', '#1c1917'], surface: 'rocky', texture: { map: 'ganimedes-voyager', mode: 'palette' } },
}

/** Rocas: más cerca cuanto más brillante es la fuente (da paralaje al moverse). */
function rocaDe(f: FuenteMedida): Staging {
  return { kind: 'smallBody', depth: Math.round(125 + 150 * (1 - f.brillo_relativo)), palette: ROCA }
}

export function stagingDe(f: FuenteMedida): Staging {
  return GRANDES[f.id] ?? rocaDe(f)
}

function semilla(id: string): number {
  return 700 + Number(id.slice(1))
}

function build(f: FuenteMedida): SceneObject {
  const st = stagingDe(f)
  const p = aPantalla(f.u, f.v)
  const position = screenToWorld(p.u, p.v, st.depth, ENTRY_CAMERA)
  const diameter = st.diameter ?? diametroEnPantalla(f) * ESCALA_ROCA
  const radius = radiusForScreenSize(diameter, st.depth, ENTRY_CAMERA.fovDeg)
  const base = {
    id: f.id,
    kind: st.kind,
    position,
    seed: semilla(f.id),
    palette: st.palette,
    ...(st.label ? { label: st.label } : {}),
    ...(st.surface ? { surface: st.surface } : {}),
    ...(st.atmosphere ? { atmosphere: st.atmosphere } : {}),
    ...(st.texture ? { texture: st.texture } : {}),
    ...(ALPHA_INFO[f.id] ? { info: ALPHA_INFO[f.id] } : {}),
  }
  if (st.kind === 'ringedPlanet') {
    // El diámetro elegido abarca el anillo: el planeta es el radio externo / 2,27.
    return { ...base, radius: radius / RING.outer, ring: { ...RING, tiltDeg: st.ring?.tiltDeg ?? 0 } }
  }
  return { ...base, radius }
}

export const OBJECTS: readonly SceneObject[] = FUENTES.map(build)

/**
 * Planetas de α fuera del recorte (no están sobre ninguna fuente medida): detrás y a los lados de la
 * entrada, así que la primera vista sigue siendo la del campo real. Se descubren al volar.
 */
const EXTRA_DEFS: SceneObject[] = [
  {
    // Superficie: Venus por radar (Magellan).
    id: 'radar',
    kind: 'planet',
    label: 'Radar',
    position: [-300, 25, 130],
    radius: 30,
    seed: 811,
    palette: ['#fde68a', '#b45309', '#2b1302'],
    surface: 'rocky',
    atmosphere: '#fde68a',
    texture: { map: 'venus-magellan', mode: 'color' },
  },
  {
    // Superficie: Fobos (Viking), en grises; acompaña a Radar.
    id: 'crater',
    kind: 'sphere',
    label: 'Cráter',
    position: [-235, 5, 175],
    radius: 6,
    seed: 813,
    palette: ['#d6d3d1', '#78716c', '#292524'],
    surface: 'rocky',
    texture: { map: 'fobos-viking', mode: 'palette' },
  },
]

export const EXTRAS: readonly SceneObject[] = EXTRA_DEFS.map((o) => (ALPHA_INFO[o.id] ? { ...o, info: ALPHA_INFO[o.id] } : o))
