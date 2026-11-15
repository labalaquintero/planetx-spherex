interface Props {
  on: boolean
  onToggle: () => void
}

/** Botón de sonido (apagado por defecto). Encenderlo es el gesto que permite crear el audio. */
export function SoundToggle({ on, onToggle }: Props) {
  return (
    <button type="button" className="ex-btn ex-sound" aria-pressed={on} onClick={onToggle} title={on ? 'Silenciar' : 'Activar sonido'}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {on ? (
          <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
      <span>{on ? 'Sonido' : 'Silencio'}</span>
    </button>
  )
}
