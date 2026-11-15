import { OPPOSITE, type RouteGraph } from './graph'
import type { Direction } from './types'

/** Duración de cada desplazamiento entre puntos de ruta. */
export const MOVE_DURATION_MS = 1000

export interface Transition {
  readonly from: string
  readonly to: string
  readonly direction: Direction
  readonly elapsedMs: number
  readonly durationMs: number
}

/** Estado inmutable de la nave: parada en `at`, o en tránsito si `transition` no es null. */
export interface NavState {
  readonly at: string
  readonly transition: Transition | null
}

export function initialState(graph: RouteGraph): NavState {
  return { at: graph.startId, transition: null }
}

/** Dirección permitida desde `id`: hay vecino en esa dirección. */
export function neighbour(graph: RouteGraph, id: string, dir: Direction): string | undefined {
  return graph.nodes.get(id)?.links[dir]
}

/**
 * Pide un movimiento. Devuelve el MISMO objeto de estado si se ignora (en tránsito o sin
 * vecino en esa dirección), de modo que quien llama puede comparar por identidad.
 */
export function requestMove(
  graph: RouteGraph,
  state: NavState,
  dir: Direction,
  durationMs: number = MOVE_DURATION_MS,
): NavState {
  if (state.transition) return state
  const to = neighbour(graph, state.at, dir)
  if (to === undefined || !graph.nodes.has(to)) return state
  return {
    at: state.at,
    transition: { from: state.at, to, direction: dir, elapsedMs: 0, durationMs },
  }
}

/** Avanza el tiempo. Al completar la duración la nave queda parada en el destino. */
export function advance(state: NavState, dtMs: number): NavState {
  const t = state.transition
  if (!t) return state
  const elapsedMs = t.elapsedMs + Math.max(0, dtMs)
  if (elapsedMs >= t.durationMs) return { at: t.to, transition: null }
  return { at: state.at, transition: { ...t, elapsedMs } }
}

/** Avance lineal 0..1 del tránsito (0 si está parada). */
export function progress(state: NavState): number {
  const t = state.transition
  if (!t) return 0
  return t.durationMs <= 0 ? 1 : Math.min(1, t.elapsedMs / t.durationMs)
}

/** Direcciones con vecino desde el punto que cuenta para los botones (el destino si va en tránsito). */
export function availableDirections(graph: RouteGraph, state: NavState): Direction[] {
  const id = state.transition ? state.transition.to : state.at
  const node = graph.nodes.get(id)
  if (!node) return []
  return (Object.keys(OPPOSITE) as Direction[]).filter((d) => node.links[d] !== undefined)
}
