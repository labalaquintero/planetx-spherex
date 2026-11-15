import type { Direction } from '../engine/types'

interface Props {
  /** Direcciones con punto de ruta; el resto se deshabilita. */
  available: ReadonlySet<Direction>
  onMove: (dir: Direction) => void
}

const BUTTONS: { dir: Direction; label: string; cls: string; points: string }[] = [
  { dir: 'forward', label: 'Avanzar', cls: 'ex-dpad-up', points: '12,5 20,19 4,19' },
  { dir: 'left', label: 'Ir a la izquierda', cls: 'ex-dpad-left', points: '5,12 19,4 19,20' },
  { dir: 'right', label: 'Ir a la derecha', cls: 'ex-dpad-right', points: '19,12 5,4 5,20' },
  { dir: 'back', label: 'Retroceder', cls: 'ex-dpad-down', points: '12,19 20,5 4,5' },
]

/** Cruceta de cuatro botones; usa el mismo manejador que el teclado. */
export function DPad({ available, onMove }: Props) {
  return (
    <div className="ex-dpad" role="group" aria-label="Controles de navegación">
      {BUTTONS.map((b) => (
        <button
          key={b.dir}
          type="button"
          className={`ex-dpad-btn ${b.cls}`}
          aria-label={b.label}
          disabled={!available.has(b.dir)}
          onClick={() => onMove(b.dir)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <polygon points={b.points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}
