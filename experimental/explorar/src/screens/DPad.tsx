import { DPAD_KEYS, dpadState, type DpadInput } from '../engine/dpad'
import type { Direction } from '../engine/types'

interface Props extends DpadInput {
  onMove: (dir: Direction) => void
  onPress: (dir: Direction, down: boolean) => void
}

const BUTTONS: { dir: Direction; cls: string; points: string }[] = [
  { dir: 'forward', cls: 'ex-dpad-up', points: '12,6 19,17 5,17' },
  { dir: 'left', cls: 'ex-dpad-left', points: '6,12 17,5 17,19' },
  { dir: 'right', cls: 'ex-dpad-right', points: '18,12 7,5 7,19' },
  { dir: 'back', cls: 'ex-dpad-down', points: '12,18 19,7 5,7' },
]

/**
 * Cruceta de cuatro botones con triángulos y su atajo (W, A, S, D) visible. Usa el mismo
 * manejador que el teclado. Estados: deshabilitado, activo (moviéndose en esa dirección) y pulsado.
 */
export function DPad({ available, moving, pressed, onMove, onPress }: Props) {
  return (
    <div className="ex-dpad" role="group" aria-label="Controles de navegación">
      {BUTTONS.map((b) => {
        const state = dpadState(b.dir, { available, moving, pressed })
        const k = DPAD_KEYS[b.dir]
        return (
          <button
            key={b.dir}
            type="button"
            className={`ex-dpad-btn ${b.cls}`}
            data-state={state}
            aria-label={`${k.label} (${k.key})`}
            aria-keyshortcuts={`${k.key} ${b.dir === 'forward' ? 'ArrowUp' : b.dir === 'back' ? 'ArrowDown' : b.dir === 'left' ? 'ArrowLeft' : 'ArrowRight'}`}
            disabled={state === 'disabled'}
            onClick={() => onMove(b.dir)}
            onPointerDown={() => onPress(b.dir, true)}
            onPointerUp={() => onPress(b.dir, false)}
            onPointerLeave={() => onPress(b.dir, false)}
            onPointerCancel={() => onPress(b.dir, false)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <polygon points={b.points} fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="ex-dpad-key" aria-hidden="true">
              {k.key}
            </span>
          </button>
        )
      })}
      <span className="ex-dpad-hub" aria-hidden="true" />
    </div>
  )
}
