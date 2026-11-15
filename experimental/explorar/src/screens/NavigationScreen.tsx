import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { NavController } from '../engine/controller'
import { buildGraph, DIRECTIONS } from '../engine/graph'
import { MOVE_DURATION_MS } from '../engine/navigation'
import { nearbyObject } from '../engine/nearest'
import type { Direction, SectorConfig, SectorScene as SectorSceneData } from '../engine/types'
import { DPad } from './DPad'
import { ErrorBoundary } from './ErrorBoundary'
import { loadScene } from './sceneLoader'
import { AdaptiveQuality, type QualityLevel } from '../engine/quality'

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
}

const KEYS: Readonly<Record<string, Direction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

export function NavigationScreen({ sector, onExit, arrive, reduced, quality: initialLevel, forced, debug }: Props) {
  const { scene } = sector
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
  const available = useMemo(
    () => new Set(DIRECTIONS.filter((d) => node?.links[d] !== undefined)),
    [node],
  )

  // Teclado: mismo manejador que los botones. Mientras se mueve, controller.move ignora la entrada.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextField(e.target)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
        return
      }
      const dir = KEYS[e.code]
      if (!dir) return
      e.preventDefault() // evita que las flechas desplacen la página
      controller.move(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controller, onExit])

  return (
    <section
      className="ex-nav"
      aria-label={`Navegación en ${sector.name}`}
      data-arrive={arrive ? '' : undefined}
      data-fade-in={arrive ? undefined : ''}
    >
      <div className="ex-canvas">
        <ErrorBoundary
          fallback={
            <p className="ex-fallback" role="alert">
              No se pudo iniciar la vista 3D en este equipo (se necesita WebGL).
            </p>
          }
        >
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
      </div>

      <div className="ex-hud ex-hud-top">
        <div className="ex-hud-info">
          <p className="ex-hud-point">{node?.name}</p>
          <p className="ex-hud-near">{near ? `Cerca: ${near.label}` : ' '}</p>
        </div>
        <button type="button" className="ex-back" onClick={onExit}>
          ← Volver a sectores <kbd>Esc</kbd>
        </button>
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
        <div>
          <p className="ex-disclaimer-inline">Representación ilustrativa, no son datos reales de SPHEREx.</p>
          <p className="ex-hint">W/↑ avanzar · S/↓ retroceder · A/← y D/→ laterales</p>
        </div>
        <DPad available={available} onMove={(d) => controller.move(d)} />
      </div>
    </section>
  )
}
