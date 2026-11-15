import type { SceneObject, Vec3, Waypoint } from './types'

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

/** Objeto que nombra el HUD en un punto: el `focusId` del punto, o el etiquetado más cercano. */
export function nearbyObject(waypoint: Waypoint, objects: readonly SceneObject[]): SceneObject | undefined {
  if (waypoint.focusId !== undefined) return objects.find((o) => o.id === waypoint.focusId)
  return nearestLabelled(waypoint.position, objects)
}

/** Problemas de coherencia entre puntos y objetos (vacío si todo está bien). */
export function validateFocus(waypoints: readonly Waypoint[], objects: readonly SceneObject[]): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  for (const o of objects) {
    if (ids.has(o.id)) problems.push(`objeto duplicado: ${o.id}`)
    ids.add(o.id)
  }
  const byId = new Map(objects.map((o) => [o.id, o]))
  for (const w of waypoints) {
    if (w.focusId === undefined) continue
    const o = byId.get(w.focusId)
    if (!o) problems.push(`${w.id}.focusId apunta a «${w.focusId}», que no existe`)
    else if (!o.label) problems.push(`${w.id}.focusId apunta a «${w.focusId}», que no tiene etiqueta`)
  }
  return problems
}
