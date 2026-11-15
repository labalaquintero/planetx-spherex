import type { RouteGraph } from './graph'
import { advance, initialState, MOVE_DURATION_MS, requestMove, type NavState } from './navigation'
import type { Direction } from './types'

/** Lo único que ve la interfaz de React: cambia solo al empezar o terminar un movimiento. */
export interface NavSnapshot {
  readonly at: string
  /** Destino si va en tránsito; null si está parada. */
  readonly movingTo: string | null
}

/**
 * Envuelve la máquina de navegación (pura) para usarla desde React y desde el bucle de render.
 * La escena lee `state` en cada cuadro; la interfaz se suscribe y solo se entera de los cambios
 * de `snapshot`, así que el HUD no se vuelve a pintar 60 veces por segundo.
 */
export class NavController {
  private current: NavState
  private snap: NavSnapshot
  private readonly listeners = new Set<() => void>()

  readonly graph: RouteGraph
  private readonly durationMs: number

  constructor(graph: RouteGraph, durationMs: number = MOVE_DURATION_MS) {
    this.graph = graph
    this.durationMs = durationMs
    this.current = initialState(graph)
    this.snap = this.makeSnapshot()
  }

  get state(): NavState {
    return this.current
  }

  /** Referencia estable mientras no cambie el punto ni el estado de movimiento (para useSyncExternalStore). */
  readonly getSnapshot = (): NavSnapshot => this.snap

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Devuelve true si el movimiento se aceptó; false si se ignoró. */
  move(dir: Direction): boolean {
    const next = requestMove(this.graph, this.current, dir, this.durationMs)
    if (next === this.current) return false
    // Sin animación (prefers-reduced-motion): el desplazamiento termina al instante.
    this.current = this.durationMs <= 0 ? advance(next, 0) : next
    this.publish()
    return true
  }

  /** Llamar una vez por cuadro. */
  update(dtMs: number): void {
    if (!this.current.transition) return
    this.current = advance(this.current, dtMs)
    if (!this.current.transition) this.publish()
  }

  private makeSnapshot(): NavSnapshot {
    const t = this.current.transition
    return { at: this.current.at, movingTo: t ? t.to : null }
  }

  private publish(): void {
    this.snap = this.makeSnapshot()
    for (const l of this.listeners) l()
  }
}
