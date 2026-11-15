import { useEffect, useRef, useState } from 'react'
import { ASSET_CREDITS, SOFTWARE_CREDITS } from '../credits'

/** Botón «Créditos» y su diálogo: fuentes, autores y licencias de lo que se usa. */
export function Credits() {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <>
      <button type="button" className="ex-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Créditos
      </button>
      <dialog ref={dialog} className="ex-credits" aria-labelledby="ex-credits-title" onClose={() => setOpen(false)}>
        <div className="ex-credits-head">
          <h2 id="ex-credits-title" className="ex-credits-title">
            Créditos
          </h2>
          <button type="button" className="ex-btn" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </div>
        <p className="ex-credits-note">
          Representación ilustrativa: los planetas, la estación y la nave son inventados. Algunas superficies usan
          mapas reales como textura, sin pretender ser esos cuerpos.
        </p>
        <ul className="ex-credits-list">
          {ASSET_CREDITS.map((c) => (
            <li key={c.url}>
              <p className="ex-credits-what">{c.what}</p>
              <p className="ex-credits-meta">
                {c.author} · <span className="ex-chip ex-chip-muted">{c.license}</span>
              </p>
              <p className="ex-credits-url">{c.url}</p>
              {c.note && <p className="ex-credits-meta">{c.note}</p>}
            </li>
          ))}
          <li>
            <p className="ex-credits-what">Software</p>
            <p className="ex-credits-meta">{SOFTWARE_CREDITS.map((s) => `${s.name} (${s.license})`).join(' · ')}</p>
          </li>
        </ul>
      </dialog>
    </>
  )
}
