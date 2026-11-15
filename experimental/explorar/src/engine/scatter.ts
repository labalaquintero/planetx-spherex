import { DIRECTIONS } from './graph'
import { mulberry32 } from './random'
import type { SceneObject, SmallBodyField, Vec3, Waypoint } from './types'

export interface ScatteredBody {
  readonly position: Vec3
  readonly radius: number
  /** Rotación inicial (radianes) y velocidad de giro (rad/s). */
  readonly rotation: Vec3
  readonly spin: number
  /** 0..1: variación de color dentro de la paleta. */
  readonly tint: number
  /** Cuál de las formas base usa (0..variants-1). */
  readonly variant: number
}

/** Distancia de un punto a un segmento. */
export function distanceToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const len2 = ab[0]! * ab[0]! + ab[1]! * ab[1]! + ab[2]! * ab[2]!
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (ap[0]! * ab[0]! + ap[1]! * ab[1]! + ap[2]! * ab[2]!) / len2))
  return Math.hypot(ap[0]! - ab[0]! * t, ap[1]! - ab[1]! * t, ap[2]! - ab[2]! * t)
}

/** Distancia mínima de un punto a la ruta (puntos y tramos entre vecinos). */
export function distanceToRoute(p: Vec3, waypoints: readonly Waypoint[]): number {
  const byId = new Map(waypoints.map((w) => [w.id, w]))
  let best = Infinity
  for (const w of waypoints) {
    for (const d of DIRECTIONS) {
      const to = w.links[d] === undefined ? undefined : byId.get(w.links[d]!)
      if (to) best = Math.min(best, distanceToSegment(p, w.position, to.position))
    }
    best = Math.min(best, Math.hypot(p[0] - w.position[0], p[1] - w.position[1], p[2] - w.position[2]))
  }
  return best
}

/**
 * Coloca hasta `count` cuerpos de forma determinista (misma semilla, mismo resultado). Descarta
 * posiciones demasiado cerca de la ruta o dentro de un objeto con nombre. Los primeros N de la
 * lista son los mismos para cualquier N: bajar la calidad solo quita cuerpos, no los mueve.
 */
export function scatterBodies(
  field: SmallBodyField,
  waypoints: readonly Waypoint[],
  objects: readonly SceneObject[],
  count: number,
  variants = 3,
  /** Descarta además las posiciones para las que devuelve true (p. ej., la vista inicial del boceto). */
  reject?: (p: Vec3) => boolean,
): ScatteredBody[] {
  const rnd = mulberry32(field.seed)
  const out: ScatteredBody[] = []
  const want = Math.max(0, Math.min(count, field.count))
  for (let attempts = 0; out.length < want && attempts < want * 40; attempts++) {
    const p: Vec3 = [
      field.center[0] + (rnd() * 2 - 1) * field.extent[0],
      field.center[1] + (rnd() * 2 - 1) * field.extent[1],
      field.center[2] + (rnd() * 2 - 1) * field.extent[2],
    ]
    const r = field.minRadius + Math.pow(rnd(), 2.2) * (field.maxRadius - field.minRadius)
    const rotation: Vec3 = [rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2]
    const spin = (rnd() * 2 - 1) * 0.25
    const tint = rnd()
    const variant = Math.floor(rnd() * variants)
    if (distanceToRoute(p, waypoints) < field.clearance + r) continue
    const inside = objects.some(
      (o) => o.kind !== 'smallBody' && Math.hypot(p[0] - o.position[0], p[1] - o.position[1], p[2] - o.position[2]) < o.radius * (o.ring?.outer ?? 1.2) + r + 2,
    )
    if (inside || reject?.(p)) continue
    out.push({ position: p, radius: r, rotation, spin, tint, variant })
  }
  return out
}
