import { useEffect, useId, useRef, useState } from 'react';

export type Section = 'inicio' | 'explorar';

interface Props {
  current: Section;
  onNavigate: (section: Section) => void;
}

const ITEMS: { id: Section; label: string; hint: string }[] = [
  { id: 'inicio', label: 'Inicio', hint: 'Visor temporal' },
  { id: 'explorar', label: 'Explorar', hint: 'Sectores en nave (ilustrativo)' },
];

/**
 * Menú de secciones (☰), siempre visible arriba a la derecha. Es la única entrada a «Explorar»
 * y la forma de volver al inicio desde cualquier pantalla.
 */
export function SiteMenu({ current, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // En captura: Esc solo cierra el menú (no llega a «Volver a sectores» de Explorar).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div className="px-menu">
      <button
        ref={button}
        type="button"
        className="px-menu-button"
        aria-label="Menú de secciones"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div ref={panel} id={menuId} className="px-menu-panel">
          <nav aria-label="Secciones">
            <ul>
              {ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="px-menu-item"
                    aria-current={current === item.id ? 'page' : undefined}
                    onClick={() => {
                      setOpen(false);
                      onNavigate(item.id);
                    }}
                  >
                    <span className="px-menu-label">{item.label}</span>
                    <span className="px-menu-hint">{item.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
