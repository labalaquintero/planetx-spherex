import { useEffect, useId, useRef, useState } from 'react'
import { Explorar } from './Explorar'

/** Barra superior de la app independiente. En el visor, Santiago monta <Explorar /> en su propio menú. */
export function App() {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // En captura: si el menú está abierto, Esc solo lo cierra y no llega a «Volver a sectores».
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  return (
    <div className="app">
      <header className="app-bar">
        <button
          ref={buttonRef}
          type="button"
          className="app-menu-button"
          aria-label="Menú de secciones"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="app-title">Planet X · Explorar</h1>
        {open && (
          <nav id={menuId} className="app-menu" aria-label="Secciones">
            <ul>
              <li>
                <button type="button" className="app-menu-item" aria-current="page" onClick={() => setOpen(false)}>
                  Explorar
                </button>
              </li>
              <li>
                <button type="button" className="app-menu-item" disabled>
                  Próximamente
                </button>
              </li>
              <li>
                <button type="button" className="app-menu-item" disabled>
                  Próximamente
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>
      <main className="app-main">
        <Explorar />
      </main>
    </div>
  )
}
