interface Props {
  onExit: () => void
  /** Texto del motivo (no hay WebGL, o el contexto se perdió). */
  reason?: string
}

/** Aviso claro cuando no se puede dibujar en 3D (en lugar de una pantalla en blanco). */
export function NoWebGL({ onExit, reason }: Props) {
  return (
    <div className="ex-nowebgl" role="alert">
      <div className="ex-nowebgl-card">
        <span className="ex-chip ex-chip-warn">Vista 3D no disponible</span>
        <p className="ex-nowebgl-title">Este navegador o equipo no puede mostrar la escena 3D.</p>
        <p className="ex-nowebgl-text">
          {reason ?? 'Se necesita WebGL.'} Prueba a activar la aceleración por hardware del navegador o a usar otro
          navegador (Chrome, Edge, Firefox o Safari recientes).
        </p>
        <button type="button" className="ex-btn" onClick={onExit}>
          ← Volver a sectores
        </button>
      </div>
    </div>
  )
}
