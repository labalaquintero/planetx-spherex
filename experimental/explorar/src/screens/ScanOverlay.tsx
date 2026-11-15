import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { SCAN_MS, scanProgress, scanReadout, scanStage } from '../engine/scan'
import type { SceneObject } from '../engine/types'
import type { ScanInput } from '../scene/ScanView'
import { ErrorBoundary } from './ErrorBoundary'
import { InfoCard } from './InfoCard'

// Chunk diferido aparte (comparte three con la escena): solo se descarga al escanear.
const ScanView = lazy(() => import('../scene/ScanView'))

interface Props {
  object: SceneObject
  /** Distancia de la nave al objeto al empezar el escaneo. */
  distance: number
  reduced: boolean
  octaves: number
  onClose: () => void
}

const ZOOM = { min: 0.7, max: 1.35 }

/**
 * Escaneo de un planeta: un panel que crece hasta casi toda la pantalla con el modelo 3D en el centro
 * (se gira arrastrando, la rueda acerca), la lectura del escáner y la ficha del objeto.
 */
export function ScanOverlay({ object, distance, reduced, octaves, onClose }: Props) {
  const input = useRef<ScanInput>({ dx: 0, dy: 0, dragging: false, zoom: 1 })
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const close = useRef<HTMLButtonElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(reduced ? 1 : 0)

  useEffect(() => {
    close.current?.focus()
  }, [])

  // Rueda: dentro del escaneo nunca desplaza la página. Sobre la lectura la desplaza a ella; en el resto
  // del panel acerca o aleja el modelo. Escucha nativa (no pasiva) para poder cancelar el desplazamiento.
  useEffect(() => {
    const el = layer.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const side = (e.target as Element | null)?.closest?.('.ex-scan-side') as HTMLElement | null
      if (side) {
        side.scrollTop += e.deltaY
        return
      }
      const z = input.current.zoom * Math.exp(-e.deltaY * 0.0012)
      input.current.zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, z))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Progreso del barrido para el HUD (la vista 3D lleva su propio reloj).
  useEffect(() => {
    if (reduced) return
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      const p = scanProgress(performance.now() - t0)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  const done = progress >= 1
  const rows = scanReadout(object, distance)
  const name = object.label ?? object.id

  return (
    <div
      ref={layer}
      className="ex-scan-layer"
      // Los clics y el clic derecho dentro del escaneo no llegan a la nave (que se dirige con clic derecho).
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
    <div className="ex-scan" role="dialog" aria-modal="true" aria-labelledby="ex-scan-title" data-done={done || undefined}>
      <div className="ex-scan-head">
        <span className="ex-chip">Escaneo</span>
        <h2 id="ex-scan-title" className="ex-scan-title">
          {name}
        </h2>
        <button ref={close} type="button" className="ex-btn ex-scan-close" onClick={onClose}>
          Cerrar <kbd>R</kbd>
        </button>
      </div>

      <div className="ex-scan-body">
        <div
          className="ex-scan-stage"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
            input.current.dragging = true
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d || d.id !== e.pointerId) return
            input.current.dx += e.clientX - d.x
            input.current.dy += e.clientY - d.y
            d.x = e.clientX
            d.y = e.clientY
          }}
          onPointerUp={(e) => {
            if (drag.current?.id !== e.pointerId) return
            drag.current = null
            input.current.dragging = false
          }}
          onLostPointerCapture={() => {
            drag.current = null
            input.current.dragging = false
          }}
        >
          <ErrorBoundary fallback={<p className="ex-fallback">No se pudo mostrar el modelo 3D.</p>}>
            <Suspense fallback={<p className="ex-fallback">Cargando modelo…</p>}>
              <ScanView object={object} input={input} animate={!reduced} octaves={octaves} />
            </Suspense>
          </ErrorBoundary>
          <span className="ex-scan-reticle" aria-hidden="true" />
          {!done && <span className="ex-scan-line" aria-hidden="true" style={{ animationDuration: `${SCAN_MS}ms` }} />}
          <p className="ex-scan-hint" aria-hidden="true">
            Arrastra para girar · rueda para acercar
          </p>
        </div>

        <aside className="ex-scan-side">
          <div className="ex-scan-progress" role="status">
            <span>{scanStage(progress)}</span>
            <span className="ex-scan-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress.toFixed(3)})` }} />
            </span>
          </div>
          <dl className="ex-scan-readout">
            {rows.map((r, i) => (
              <div key={r.label} data-shown={done || progress > (i + 1) / (rows.length + 1) || undefined}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
          {done && object.info && <InfoCard info={object.info} />}
        </aside>
      </div>

      <p className="ex-scan-foot">Representación ilustrativa, no son datos reales de SPHEREx.</p>
    </div>
    </div>
  )
}
