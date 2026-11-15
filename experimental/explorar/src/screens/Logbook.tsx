import { useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, type Logbook as Log } from '../engine/logbook'
import type { SceneObject } from '../engine/types'

interface Props {
  log: Log
  /** Cuerpos que cuentan para la bitácora (con nombre y escaneables). */
  bodies: readonly SceneObject[]
  onReset: () => void
}

/** Botón «Bitácora» y su diálogo: planetas descubiertos (y escaneados o atravesados) y logros. */
export function Logbook({ log, bodies, onReset }: Props) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  const found = bodies.filter((o) => log.discovered.includes(o.id))
  const hidden = bodies.length - found.length
  const got = ACHIEVEMENTS.filter((a) => log.achievements.includes(a.id)).length
  return (
    <>
      <button type="button" className="ex-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Bitácora <span className="ex-logbook-count">{found.length}/{bodies.length}</span>
      </button>
      <dialog ref={dialog} className="ex-credits ex-logbook" aria-labelledby="ex-logbook-title" onClose={() => setOpen(false)}>
        <div className="ex-credits-head">
          <h2 id="ex-logbook-title" className="ex-credits-title">
            Bitácora de exploración
          </h2>
          <button type="button" className="ex-btn" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </div>
        <p className="ex-credits-note">
          Acércate a un planeta para descubrirlo, escanéalo con <kbd>R</kbd> y atraviesa los gigantes gaseosos con turbo.
          Se guarda en este navegador.
        </p>

        <h3 className="ex-logbook-sub">
          Planetas · {found.length} de {bodies.length}
        </h3>
        <ul className="ex-logbook-bodies">
          {found.map((o) => (
            <li key={o.id}>
              <span className="ex-logbook-dot" style={{ background: o.palette[0] }} aria-hidden="true" />
              <span className="ex-logbook-name">{o.label}</span>
              {log.scanned.includes(o.id) && <span className="ex-chip">escaneado</span>}
              {log.crossed.includes(o.id) && <span className="ex-chip ex-chip-cross-tag">atravesado</span>}
            </li>
          ))}
          {hidden > 0 && (
            <li className="ex-logbook-hidden">
              <span className="ex-logbook-dot" aria-hidden="true" />
              {hidden} {hidden === 1 ? 'planeta sin descubrir' : 'planetas sin descubrir'}: búscalos en el mapa (los «?»)
            </li>
          )}
        </ul>

        <h3 className="ex-logbook-sub">
          Logros · {got} de {ACHIEVEMENTS.length}
        </h3>
        <ul className="ex-logbook-achievements">
          {ACHIEVEMENTS.map((a) => {
            const ok = log.achievements.includes(a.id)
            return (
              <li key={a.id} data-ok={ok || undefined}>
                <span className="ex-logbook-badge" aria-hidden="true">
                  {ok ? '★' : '☆'}
                </span>
                <span>
                  <b>{a.title}</b> · {a.description}
                </span>
                <span className="ex-sr-only">{ok ? 'conseguido' : 'pendiente'}</span>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className="ex-btn ex-logbook-reset"
          onClick={() => {
            if (window.confirm('¿Borrar la bitácora de este sector?')) onReset()
          }}
        >
          Reiniciar bitácora
        </button>
      </dialog>
    </>
  )
}
