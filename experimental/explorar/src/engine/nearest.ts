import type { SceneObject, Vec3 } from './types'

/** Objeto etiquetado más cercano (distancia a su superficie) a una posición; undefined si no hay. */
export function nearestLabelled(position: Vec3, objects: readonly SceneObject[]): SceneObject | undefined {
  let best: SceneObject | undefined
  let bestDist = Infinity
  for (const o of objects) {
    if (!o.label) continue
    const d = Math.hypot(o.position[0] - position[0], o.position[1] - position[1], o.position[2] - position[2]) - o.radius
    if (d < bestDist) {
      bestDist = d
      best = o
    }
  }
  return best
}
