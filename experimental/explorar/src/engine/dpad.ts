import type { Direction } from './types'

/**
 * Estado visual de un botón de la cruceta:
 * - active: la nave se está moviendo en esa dirección (manda sobre todo lo demás);
 * - disabled: no hay punto de ruta en esa dirección;
 * - pressed: la tecla o el puntero lo mantienen pulsado;
 * - idle: disponible.
 */
export type DpadState = 'active' | 'disabled' | 'pressed' | 'idle'

export interface DpadInput {
  readonly available: ReadonlySet<Direction>
  readonly moving: Direction | null
  readonly pressed: ReadonlySet<Direction>
}

export function dpadState(dir: Direction, input: DpadInput): DpadState {
  if (input.moving === dir) return 'active'
  if (!input.available.has(dir)) return 'disabled'
  if (input.pressed.has(dir)) return 'pressed'
  return 'idle'
}

/** Teclas de cada dirección (para mostrarlas en los botones y en la ayuda). */
export const DPAD_KEYS: Readonly<Record<Direction, { key: string; arrow: string; label: string }>> = {
  forward: { key: 'W', arrow: '↑', label: 'Avanzar' },
  back: { key: 'S', arrow: '↓', label: 'Retroceder' },
  left: { key: 'A', arrow: '←', label: 'Ir a la izquierda' },
  right: { key: 'D', arrow: '→', label: 'Ir a la derecha' },
}

/** Códigos de teclado (KeyboardEvent.code) → dirección. Independiente de la distribución del teclado. */
export const KEY_CODES: Readonly<Record<string, Direction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}
