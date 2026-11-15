import type { FlightInput } from './flight'

/** Acciones de vuelo (teclado y botones en pantalla usan las mismas). */
export type FlightAction = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down'

/** Teclas (KeyboardEvent.code) → acción. Independiente de la distribución del teclado. */
export const FLIGHT_KEYS: Readonly<Record<string, FlightAction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyE: 'up',
  Space: 'up',
  KeyQ: 'down',
  KeyC: 'down',
}

export const ACTION_LABELS: Readonly<Record<FlightAction, { key: string; label: string }>> = {
  forward: { key: 'W', label: 'Acelerar' },
  back: { key: 'S', label: 'Frenar o retroceder' },
  left: { key: 'A', label: 'Girar a la izquierda' },
  right: { key: 'D', label: 'Girar a la derecha' },
  up: { key: 'E', label: 'Subir' },
  down: { key: 'Q', label: 'Bajar' },
}

/** Entrada de vuelo a partir de las acciones mantenidas (opuestas se anulan). */
export function inputFrom(held: ReadonlySet<FlightAction>): FlightInput {
  const v = (a: FlightAction, b: FlightAction) => (held.has(a) ? 1 : 0) - (held.has(b) ? 1 : 0)
  return { thrust: v('forward', 'back'), turn: v('left', 'right'), lift: v('up', 'down') }
}
