import { objetoBoceto } from '../../boceto'
import { BASE_FOV_DEG } from '../../engine/motion'
import { radiusForScreenSize, REFERENCE_ASPECT, screenToWorld, type ViewCamera } from '../../engine/projection'
import type { SceneObject, SceneObjectKind } from '../../engine/types'
import { WAYPOINTS } from './waypoints'

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
  readonly surface?: 'bands' | 'rocky'
  readonly atmosphere?: string
}

const ROCA: readonly [string, string, string] = ['#9a9083', '#6b6358', '#3d3832']

/** Profundidad y aspecto por objeto del boceto (lo único que el dibujo no dice). */
const STAGING: Readonly<Record<string, Staging>> = {
  ilmara: { kind: 'planet', depth: 170, label: 'Ilmara', seed: 11, palette: ['#d9b48a', '#a8683c', '#6b3a22'], surface: 'bands', atmosphere: '#fdba74' },
  veshta: { kind: 'planet', depth: 260, label: 'Veshta', seed: 23, palette: ['#9fb4c9', '#5a7392', '#2c3f58'], surface: 'rocky', atmosphere: '#7dd3fc' },
  orun: { kind: 'ringedPlanet', depth: 210, label: 'Orun', seed: 37, palette: ['#e8d9b0', '#c2a56c', '#8a6e3c'], surface: 'bands', atmosphere: '#fde68a' },
  ancla: { kind: 'station', depth: 110, label: 'Estación Ancla', seed: 41, palette: ['#cfd6de', '#a3adb9', '#5d6775'] },
  esfera: { kind: 'sphere', depth: 140, label: 'Esfera menor', seed: 53, palette: ['#c9d8e6', '#8da6bf', '#4c6580'], surface: 'rocky' },
  c1: { kind: 'smallBody', depth: 130, seed: 101, palette: ROCA },
  c2: { kind: 'smallBody', depth: 120, seed: 102, palette: ROCA },
  c3: { kind: 'smallBody', depth: 150, seed: 103, palette: ROCA },
  c4: { kind: 'smallBody', depth: 110, seed: 104, palette: ROCA },
}

/** Proporción del anillo de Orun (radios interno y externo en radios del planeta). */
const RING = { inner: 1.45, outer: 2.3 }

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
  }
  switch (st.kind) {
    case 'ringedPlanet':
      // El diámetro medido abarca el anillo: el planeta es el radio externo / 2,3. Inclinación medida.
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

export const OBJECTS: readonly SceneObject[] = Object.entries(STAGING).map(([id, st]) => build(id, st))
