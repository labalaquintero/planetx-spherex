import type { ReactNode } from 'react'
import { ACTION_LABELS, type FlightAction } from '../engine/controls'

interface Props {
  held: ReadonlySet<FlightAction>
  onHold: (action: FlightAction, down: boolean) => void
}

const CROSS: { a: FlightAction; cls: string; points: string }[] = [
  { a: 'forward', cls: 'ex-dpad-up', points: '12,6 19,17 5,17' },
  { a: 'left', cls: 'ex-dpad-left', points: '6,12 17,5 17,19' },
  { a: 'right', cls: 'ex-dpad-right', points: '18,12 7,5 7,19' },
  { a: 'back', cls: 'ex-dpad-down', points: '12,18 19,7 5,7' },
]

/**
 * Controles en pantalla, como en el boceto (cruz de cuatro triángulos), más subir/bajar.
 * Se mantienen pulsados para acelerar o girar, igual que las teclas.
 */
export function FlightPad({ held, onHold }: Props) {
  const button = (a: FlightAction, cls: string, icon: ReactNode) => {
    const k = ACTION_LABELS[a]
    return (
      <button
        key={a}
        type="button"
        className={`ex-dpad-btn ${cls}`}
        data-state={held.has(a) ? 'pressed' : 'idle'}
        aria-label={`${k.label} (${k.key})`}
        aria-pressed={held.has(a)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          onHold(a, true)
        }}
        onPointerUp={() => onHold(a, false)}
        onPointerCancel={() => onHold(a, false)}
        onLostPointerCapture={() => onHold(a, false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onHold(a, true)
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onHold(a, false)
        }}
        onBlur={() => onHold(a, false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {icon}
        <span className="ex-dpad-key" aria-hidden="true">
          {k.key}
        </span>
      </button>
    )
  }
  const tri = (points: string) => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <polygon points={points} fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
  return (
    <div className="ex-pad" role="group" aria-label="Controles de vuelo">
      <div className="ex-pad-vertical">
        {button('boost', 'ex-pad-boost', <span className="ex-pad-text">Turbo</span>)}
        {button('up', 'ex-pad-up', <span className="ex-pad-text">Subir</span>)}
        {button('down', 'ex-pad-down', <span className="ex-pad-text">Bajar</span>)}
      </div>
      <div className="ex-dpad">
        {CROSS.map((c) => button(c.a, c.cls, tri(c.points)))}
        <span className="ex-dpad-hub" aria-hidden="true" />
      </div>
    </div>
  )
}
