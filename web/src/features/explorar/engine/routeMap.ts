import { DIRECTIONS } from './graph'
import type { Waypoint } from './types'

export interface MapNode {
  readonly id: string
  readonly name: string
  /** Coordenadas en [0, 1]: x a la derecha, y hacia abajo (adelante = arriba). */
  readonly x: number
  readonly y: number
}

export interface RouteMap {
  readonly nodes: readonly MapNode[]
  readonly edges: readonly (readonly [string, string])[]
}

/**
 * Plano cenital de la ruta para el indicador del HUD: proyecta los puntos en X/Z, conserva la
 * proporción y deja un margen. Cada vínculo de ida y vuelta es una sola arista.
 */
export function routeMap(waypoints: readonly Waypoint[], padding = 0.12): RouteMap {
  if (waypoints.length === 0) return { nodes: [], edges: [] }
  const xs = waypoints.map((w) => w.position[0])
  const zs = waypoints.map((w) => w.position[2])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const span = Math.max(maxX - minX, maxZ - minZ, 1e-9)
  const scale = (1 - 2 * padding) / span
  const offX = (1 - (maxX - minX) * scale) / 2
  const offY = (1 - (maxZ - minZ) * scale) / 2
  const nodes = waypoints.map((w) => ({
    id: w.id,
    name: w.name,
    x: offX + (w.position[0] - minX) * scale,
    // -Z es adelante: el punto más lejano queda arriba.
    y: offY + (w.position[2] - minZ) * scale,
  }))
  const ids = new Set(waypoints.map((w) => w.id))
  const seen = new Set<string>()
  const edges: [string, string][] = []
  for (const w of waypoints) {
    for (const d of DIRECTIONS) {
      const to = w.links[d]
      if (to === undefined || !ids.has(to)) continue
      const key = [w.id, to].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      edges.push([w.id, to])
    }
  }
  return { nodes, edges }
}
