import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { NavController } from '../engine/controller'
import { KEY_CODES } from '../engine/dpad'
import { buildGraph, DIRECTIONS } from '../engine/graph'
import { MOVE_DURATION_MS } from '../engine/navigation'
import { nearbyObject } from '../engine/nearest'
import { AdaptiveQuality, type QualityLevel } from '../engine/quality'
import type { Direction, SectorConfig, SectorScene as SectorSceneData } from '../engine/types'
import { Credits } from './Credits'
import { DPad } from './DPad'
import { ErrorBoundary } from './ErrorBoundary'
import { NoWebGL } from './NoWebGL'
import { RouteMap } from './RouteMap'
import { loadScene } from './sceneLoader'
import { detectWebGL } from './webgl'

// three (y react-three-fiber) viven en un chunk aparte: no pesan hasta que se entra a un sector.
const SectorScene = lazy(loadScene)

interface Props {
  sector: SectorConfig & { scene: SectorSceneData }
  onExit: () => void
  /** Llegada con destello y aproximación de cámara (false con movimiento reducido: solo fundido). */
  arrive: boolean
  reduced: boolean
  quality: QualityLevel
  forced: boolean
  debug: boolean
  /** Ranura para controles extra en la barra superior del HUD (p. ej., sonido). */
  extraControls?: ReactNode
  /** Se llama cuando un movimiento se acepta (p. ej., para el sonido). */
  onMoved?: (dir: Direction) => void
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  // Dentro de un diálogo (Créditos) las teclas son del diálogo: Esc lo cierra, no sale del sector.
  if (target.closest('dialog')) return true
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

const KIND_LABEL: Record<string, string> = {
  planet: 'Planeta',
  ringedPlanet: 'Planeta con anillo',
  station: 'Estación',
  sphere: 'Esfera',
  smallBody: 'Cuerpo menor',
}

export function NavigationScreen({ sector, onExit, arrive, reduced, quality: initialLevel, forced, debug, extraControls, onMoved }: Props) {
  const { scene } = sector
  const webgl = useMemo(() => detectWebGL(), [])
  const adaptive = useMemo(() => new AdaptiveQuality(initialLevel, forced), [initialLevel, forced])
  const [settings, setSettings] = useState(adaptive.settings)
  const [fps, setFps] = useState(0)
  const graph = useMemo(() => buildGraph(scene.waypoints, scene.startId), [scene])
  const controller = useMemo(() => new NavController(graph, reduced ? 0 : MOVE_DURATION_MS), [graph])
  useEffect(() => controller.setDuration(reduced ? 0 : MOVE_DURATION_MS), [controller, reduced])

  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const shownId = snap.movingTo ?? snap.at
  const node = graph.nodes.get(shownId)
  const near = node ? nearbyObject(node, scene.objects) : undefined
  const available = useMemo(() => new Set(DIRECTIONS.filter((d) => node?.links[d] !== undefined)), [node])
  const moving = snap.movingTo ? (controller.state.transition?.direction ?? null) : null
  const [pressed, setPressed] = useState<ReadonlySet<Direction>>(new Set())
  const move = useCallback(
    (dir: Direction) => {
      if (controller.move(dir)) onMoved?.(dir)
    },
    [controller, onMoved],
  )

  const press = useCallback((dir: Direction, down: boolean) => {
    setPressed((prev) => {
      if (prev.has(dir) === down) return prev
      const next = new Set(prev)
      if (down) next.add(dir)
      else next.delete(dir)
      return next
    })
  }, [])

  // Teclado: mismo manejador que los botones. Mientras se mueve, controller.move ignora la entrada;
  // mantener la tecla encadena el siguiente tramo al llegar.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextField(e.target)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
        return
      }
      const dir = KEY_CODES[e.code]
      if (!dir) return
      e.preventDefault() // evita que las flechas desplacen la página
      press(dir, true)
      move(dir)
    }
    const onUp = (e: KeyboardEvent) => {
      const dir = KEY_CODES[e.code]
      if (dir) press(dir, false)
    }
    const clear = () => setPressed(new Set())
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [move, onExit, press])

  return (
    <section
      className="ex-nav"
      aria-label={`Navegación en ${sector.name}`}
      data-arrive={arrive ? '' : undefined}
      data-fade-in={arrive ? undefined : ''}
    >
      <div className="ex-canvas">
        {webgl ? (
          <ErrorBoundary fallback={<NoWebGL onExit={onExit} reason="La vista 3D se detuvo por un error del navegador." />}>
            <Suspense fallback={<p className="ex-fallback">Cargando escena…</p>}>
              <SectorScene
                scene={scene}
                controller={controller}
                animate={!reduced}
                arrive={arrive}
                settings={settings}
                quality={adaptive}
                onQualityChange={() => setSettings(adaptive.settings)}
                onFps={debug ? setFps : undefined}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <NoWebGL onExit={onExit} />
        )}
      </div>

      <div className="ex-hud ex-hud-top">
        <div className="ex-hud-left">
          <div className="ex-panel ex-hud-info">
            <span className="ex-chip ex-chip-muted">{sector.name}</span>
            <p className="ex-hud-point">{node?.name}</p>
            <p className="ex-hud-near">
              <span className="ex-hud-label">Objeto cercano</span>
              <span className="ex-hud-value">
                {near ? near.label : '—'}
                {near && <span className="ex-hud-kind"> · {KIND_LABEL[near.kind]}</span>}
              </span>
            </p>
          </div>
          <div className="ex-panel ex-route-panel">
            <RouteMap waypoints={scene.waypoints} at={snap.at} movingTo={snap.movingTo} />
          </div>
        </div>
        <div className="ex-hud-actions">
          <Credits />
          {extraControls}
          <button type="button" className="ex-btn" onClick={onExit}>
            <span aria-hidden="true">←</span> Volver a sectores <kbd>Esc</kbd>
          </button>
        </div>
      </div>

      {debug && (
        <p className="ex-debug" aria-hidden="true">
          {fps.toFixed(0)} FPS · calidad {settings.level}
          {forced ? ' (fija)' : ''}
        </p>
      )}

      <p className="ex-sr-only" aria-live="polite">
        {node?.name}
        {near ? `. Cerca de ${near.label}` : ''}
      </p>

      <div className="ex-hud ex-hud-bottom">
        <div className="ex-hud-notes">
          <p className="ex-disclaimer-inline">Representación ilustrativa, no son datos reales de SPHEREx.</p>
          <p className="ex-hint" aria-hidden="true">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> o flechas para moverte · <kbd>Esc</kbd> volver
          </p>
        </div>
        {webgl && <DPad available={available} moving={moving} pressed={pressed} onMove={move} onPress={press} />}
      </div>
    </section>
  )
}
