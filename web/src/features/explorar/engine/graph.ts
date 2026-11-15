import type { Direction, Waypoint } from './types'

export const DIRECTIONS: readonly Direction[] = ['forward', 'back', 'left', 'right']

export const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  forward: 'back',
  back: 'forward',
  left: 'right',
  right: 'left',
}

export interface RouteGraph {
  readonly startId: string
  readonly nodes: ReadonlyMap<string, Waypoint>
}

export function buildGraph(waypoints: readonly Waypoint[], startId: string): RouteGraph {
  return { startId, nodes: new Map(waypoints.map((w) => [w.id, w])) }
}

/**
 * Comprueba el grafo de puntos de ruta y devuelve la lista de problemas (vacía si es válido):
 * ids únicos, punto inicial existente, vínculos que apuntan a nodos reales (y no a sí mismos),
 * vínculos de regreso coherentes (A.forward = B exige B.back = A; igual con left/right) y
 * todos los nodos alcanzables desde el inicial.
 */
export function validateGraph(waypoints: readonly Waypoint[], startId: string): string[] {
  const problems: string[] = []
  const byId = new Map<string, Waypoint>()
  for (const w of waypoints) {
    if (byId.has(w.id)) problems.push(`id duplicado: ${w.id}`)
    byId.set(w.id, w)
  }
  if (!byId.has(startId)) problems.push(`el punto inicial «${startId}» no existe`)

  for (const w of waypoints) {
    for (const dir of DIRECTIONS) {
      const target = w.links[dir]
      if (target === undefined) continue
      if (target === w.id) {
        problems.push(`${w.id}.${dir} apunta a sí mismo`)
        continue
      }
      const next = byId.get(target)
      if (!next) {
        problems.push(`${w.id}.${dir} apunta a «${target}», que no existe`)
        continue
      }
      const back = next.links[OPPOSITE[dir]]
      if (back !== w.id) {
        problems.push(
          `${w.id}.${dir} -> ${target}, pero ${target}.${OPPOSITE[dir]} es ${back ?? 'vacío'} (debería ser ${w.id})`,
        )
      }
    }
  }

  if (byId.has(startId)) {
    const seen = new Set<string>([startId])
    const queue = [startId]
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const node = byId.get(id)
      if (!node) continue
      for (const dir of DIRECTIONS) {
        const target = node.links[dir]
        if (target !== undefined && byId.has(target) && !seen.has(target)) {
          seen.add(target)
          queue.push(target)
        }
      }
    }
    for (const w of waypoints) {
      if (!seen.has(w.id)) problems.push(`${w.id} no es alcanzable desde ${startId}`)
    }
  }
  return problems
}
