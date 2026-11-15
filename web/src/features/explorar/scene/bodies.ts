import { BASE_FOV_DEG } from '../engine/motion'
import { REFERENCE_ASPECT, worldToScreen } from '../engine/projection'
import { mulberry32 } from '../engine/random'
import { scatterBodies, type ScatteredBody } from '../engine/scatter'
import type { SectorScene } from '../engine/types'

export const VARIANTS = 3

/**
 * Cuerpos pequeños de un sector: los del boceto (objetos `smallBody`) más el relleno sembrado. El
 * relleno no aparece en la vista inicial (para que reproduzca el boceto) y se descubre al volar.
 */
export function smallBodiesOf(scene: SectorScene, debris: number): ScatteredBody[] {
  const listed = scene.objects
    .filter((o) => o.kind === 'smallBody')
    .map((o, i) => {
      const r = mulberry32(o.seed)
      return {
        position: o.position,
        radius: o.radius,
        rotation: [r() * 6.28, r() * 6.28, r() * 6.28] as const,
        spin: (r() * 2 - 1) * 0.3,
        tint: r(),
        variant: i % VARIANTS,
      }
    })
  const start = scene.waypoints.find((w) => w.id === scene.startId)
  const cam = start && { position: start.position, yawDeg: start.yawDeg, pitchDeg: start.pitchDeg, fovDeg: BASE_FOV_DEG, aspect: REFERENCE_ASPECT }
  const inView = (p: readonly [number, number, number]) => {
    if (!cam) return false
    const s = worldToScreen(p, cam)
    return s.depth > 0 && s.depth < 320 && s.u > -0.08 && s.u < 1.08 && s.v > -0.08 && s.v < 1.08
  }
  const extra = scene.field ? scatterBodies(scene.field, scene.waypoints, scene.objects, debris, VARIANTS, inView) : []
  return [...listed, ...extra]
}
