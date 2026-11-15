import { objetoBoceto } from './boceto'
import { BASE_FOV_DEG } from '../../engine/motion'
import { radiusForScreenSize, REFERENCE_ASPECT, screenToWorld, type ViewCamera } from '../../engine/projection'
import type { SceneObject, SceneObjectKind } from '../../engine/types'
import { WAYPOINTS } from './waypoints'
import { BETA_INFO } from './info'

/**
 * Objetos de β generados desde el boceto medido (docs/referencias/layout.json). Cada objeto se
 * coloca de modo que, visto desde el punto de entrada en una pantalla 16:9, su centro cae en el
 * ancla medida y su tamaño aparente es el del dibujo. Aquí solo se eligen las profundidades
 * (razonables, para que haya paralaje al moverse) y el aspecto (colores, superficie, atmósfera).
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
  readonly label?: string
  readonly seed: number
  readonly palette: readonly [string, string, string]
  readonly surface?: 'bands' | 'rocky' | 'storms'
  readonly glow?: string
  readonly atmosphere?: string
  readonly texture?: SceneObject['texture']
}

const ROCA: readonly [string, string, string] = ['#9a9083', '#6b6358', '#3d3832']

/** Profundidad y aspecto por objeto del boceto (lo único que el dibujo no dice). */
const STAGING: Readonly<Record<string, Staging>> = {
  // Mundo oscuro y frío inspirado en WISE 0855 (enana marrón fría, la referencia real del sector):
  // violetas y magentas apagados sobre marrón profundo, vórtices sutiles, brillo propio tenue y
  // atmósfera fina. Procedural, sin textura. Ilustrativo.
  ilmara: { kind: 'planet', depth: 170, label: 'Ilmara', seed: 11, palette: ['#9b7bb0', '#45263a', '#120a14'], surface: 'storms', atmosphere: '#c4a1ff', glow: '#5b1a3d' },
  // Rocoso: color y relieve lunares (NASA SVS, dominio público), con su propia paleta azul grisácea.
  veshta: { kind: 'planet', depth: 260, label: 'Veshta', seed: 23, palette: ['#c9d6e6', '#6f87a6', '#26364d'], surface: 'rocky', atmosphere: '#7dd3fc', texture: { map: 'luna-color', mode: 'palette', bump: 'luna-relieve' } },
  // Con anillo: bandas y anillo de Saturno (Solar System Scope, CC BY 4.0).
  orun: { kind: 'ringedPlanet', depth: 210, label: 'Orun', seed: 37, palette: ['#e8d9b0', '#c2a56c', '#8a6e3c'], surface: 'bands', atmosphere: '#fde68a', texture: { map: 'bandas-saturno', mode: 'color', ringMap: 'anillo-saturno' } },
  ancla: { kind: 'station', depth: 150, label: 'Estación Ancla', seed: 41, palette: ['#cfd6de', '#a3adb9', '#5d6775'] },
  esfera: { kind: 'sphere', depth: 140, label: 'Esfera menor', seed: 53, palette: ['#e2e8f0', '#94a3b8', '#334155'], surface: 'rocky', texture: { map: 'luna-color', mode: 'palette', bump: 'luna-relieve' } },
  c1: { kind: 'smallBody', depth: 130, seed: 101, palette: ROCA },
  c2: { kind: 'smallBody', depth: 120, seed: 102, palette: ROCA },
  c3: { kind: 'smallBody', depth: 150, seed: 103, palette: ROCA },
  c4: { kind: 'smallBody', depth: 110, seed: 104, palette: ROCA },
}

/**
 * Proporción del anillo de Orun en radios del planeta: la de la textura de anillos de Saturno
 * (del borde interno del anillo C al externo del A, ≈ 1,24–2,27 radios).
 */
const RING = { inner: 1.24, outer: 2.27 }

function build(id: string, st: Staging): SceneObject {
  const b = objetoBoceto(id)
  if (b.clase !== st.kind) throw new Error(`«${id}»: el boceto dice ${b.clase}, la escena ${st.kind}`)
  const [u, v] = b.ancla.centro
  const position = screenToWorld(u, v, st.depth, ENTRY_CAMERA)
  const size = (d: number) => radiusForScreenSize(d, st.depth, ENTRY_CAMERA.fovDeg)
  const base = {
    id,
    kind: st.kind,
    position,
    seed: st.seed,
    palette: st.palette,
    ...(st.label ? { label: st.label } : {}),
    ...(st.surface ? { surface: st.surface } : {}),
    ...(st.atmosphere ? { atmosphere: st.atmosphere } : {}),
    ...(st.glow ? { glow: st.glow } : {}),
    ...(BETA_INFO[id] ? { info: BETA_INFO[id] } : {}),
    ...(st.texture ? { texture: st.texture } : {}),
  }
  switch (st.kind) {
    case 'ringedPlanet':
      // El diámetro medido abarca el anillo: el planeta es el radio externo / 2,27. Inclinación medida.
      return { ...base, radius: size(b.ancla.diametro_v) / RING.outer, ring: { ...RING, tiltDeg: -b.angulo_deg } }
    case 'station':
      return {
        ...base,
        radius: size(b.ancla.diametro_v),
        length: 2 * size(b.ancla.largo_v ?? b.ancla.diametro_v * 2),
        handle: { length: 2 * size(b.ancla.asa_largo_v ?? 0), height: 2 * size(b.ancla.asa_alto_v ?? 0) },
        // Eje del cilindro horizontal en pantalla, con la inclinación medida del dibujo.
        rotationDeg: [0, 0, -b.angulo_deg],
      }
    default:
      return { ...base, radius: size(b.ancla.diametro_v) }
  }
}

/**
 * Planetas añadidos que no están en el boceto. Se colocan fuera de la vista inicial (detrás de la
 * entrada o muy a los lados), así que la primera vista sigue siendo la del boceto; se descubren al volar.
 */
const EXTRA_DEFS: SceneObject[] = [
  {
    id: 'tessa',
    kind: 'planet',
    label: 'Tessa',
    position: [-170, 25, 230],
    radius: 16,
    seed: 61,
    palette: ['#d6a59a', '#8a4b3f', '#2e1713'],
    surface: 'rocky',
    atmosphere: '#f6c1b4',
    texture: { map: 'luna-color', mode: 'palette', bump: 'luna-relieve' },
  },
  {
    id: 'calder',
    kind: 'planet',
    label: 'Calder',
    position: [360, -20, -330],
    radius: 30,
    seed: 71,
    palette: ['#a5f3fc', '#2b7a8c', '#0b2a33'],
    surface: 'bands',
    atmosphere: '#67e8f9',
    texture: { map: 'bandas-saturno', mode: 'palette' },
  },
  {
    id: 'sora',
    kind: 'sphere',
    label: 'Sora',
    position: [300, 8, -270],
    radius: 5,
    seed: 79,
    palette: ['#f1f5f9', '#94a3b8', '#334155'],
    surface: 'rocky',
    texture: { map: 'luna-color', mode: 'palette', bump: 'luna-relieve' },
  },
]
const EXTRAS: readonly SceneObject[] = EXTRA_DEFS.map((o) => (BETA_INFO[o.id] ? { ...o, info: BETA_INFO[o.id] } : o))

/** Objetos del boceto (medidos) y los ids añadidos fuera de él. */
export const SKETCH_IDS: readonly string[] = Object.keys(STAGING)
export const EXTRA_IDS: readonly string[] = EXTRAS.map((o) => o.id)

export const OBJECTS: readonly SceneObject[] = [...Object.entries(STAGING).map(([id, st]) => build(id, st)), ...EXTRAS]
