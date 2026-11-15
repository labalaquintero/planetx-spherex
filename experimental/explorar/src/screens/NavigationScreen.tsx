import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FLIGHT_KEYS, inputFrom, type FlightAction } from '../engine/controls'
import {
  boundaryProximity,
  FLIGHT,
  initialFlight,
  nearestNamed,
  NO_INPUT,
  obstaclesOf,
  sectorBounds,
  speedOf,
  type FlightInput,
  type FlightState,
} from '../engine/flight'
import { AdaptiveQuality, type QualityLevel } from '../engine/quality'
import type { SectorConfig, SectorScene as SectorSceneData, Vec3 } from '../engine/types'
import { CHASE } from '../scene/chase'
import { Credits } from './Credits'
import { ErrorBoundary } from './ErrorBoundary'
import { FlightPad } from './FlightPad'
import { Minimap } from './Minimap'
import { NoWebGL } from './NoWebGL'
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
  /** Nivel del motor 0..1, unas 10 veces por segundo (para el sonido). */
  onEngine?: (level: number) => void
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

interface Telemetry {
  position: Vec3
  yaw: number
  speed: number
  near?: { label: string; kind: string; distance: number }
  edge: number
}

export function NavigationScreen({ sector, onExit, arrive, reduced, quality: initialLevel, forced, debug, extraControls, onEngine }: Props) {
  const { scene } = sector
  const webgl = useMemo(() => detectWebGL(), [])
  const adaptive = useMemo(() => new AdaptiveQuality(initialLevel, forced), [initialLevel, forced])
  const [settings, setSettings] = useState(adaptive.settings)
  const [fps, setFps] = useState(0)

  // Área visitable y obstáculos, a partir de los objetos del sector.
  const bounds = useMemo(() => sectorBounds(scene.objects, scene.waypoints), [scene])
  const obstacles = useMemo(() => obstaclesOf(scene.objects), [scene])

  // La nave sale delante de la cámara del punto de entrada (la vista del boceto).
  const start = scene.waypoints.find((w) => w.id === scene.startId)!
  const flight = useRef<FlightState>(
    initialFlight([start.position[0], start.position[1] - CHASE.up, start.position[2] - CHASE.back], (start.yawDeg * Math.PI) / 180),
  )
  const input = useRef<FlightInput>(NO_INPUT)
  const [held, setHeld] = useState<ReadonlySet<FlightAction>>(new Set())

  const hold = useCallback((a: FlightAction, down: boolean) => {
    setHeld((prev) => {
      if (prev.has(a) === down) return prev
      const next = new Set(prev)
      if (down) next.add(a)
      else next.delete(a)
      return next
    })
  }, [])
  useEffect(() => {
    input.current = inputFrom(held)
  }, [held])

  // Teclado: mantener pulsado = acelerar / girar / subir. Esc sale.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextField(e.target)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
        return
      }
      const a = FLIGHT_KEYS[e.code]
      if (!a) return
      e.preventDefault() // flechas y espacio no desplazan la página
      hold(a, true)
    }
    const onUp = (e: KeyboardEvent) => {
      const a = FLIGHT_KEYS[e.code]
      if (a) hold(a, false)
    }
    const clear = () => setHeld(new Set())
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [hold, onExit])

  // Telemetría del HUD, 10 veces por segundo (la simulación corre en el bucle de render).
  const [tele, setTele] = useState<Telemetry>(() => ({ position: flight.current.position, yaw: flight.current.yaw, speed: 0, edge: 0 }))
  useEffect(() => {
    const id = setInterval(() => {
      const s = flight.current
      const n = nearestNamed(s.position, scene.objects)
      const speed = speedOf(s)
      setTele({
        position: s.position,
        yaw: s.yaw,
        speed,
        near: n && { label: n.object.label!, kind: n.object.kind, distance: n.distance },
        edge: boundaryProximity(s.position, bounds),
      })
      onEngine?.(Math.min(1, speed / FLIGHT.maxSpeed))
    }, 100)
    return () => clearInterval(id)
  }, [scene, bounds, onEngine])

  const mapSize = 200

  return (
    <section
      className="ex-nav"
      aria-label={`Vuelo libre en ${sector.name}`}
      data-arrive={arrive ? '' : undefined}
      data-fade-in={arrive ? undefined : ''}
    >
      <div className="ex-canvas">
        {webgl ? (
          <ErrorBoundary fallback={<NoWebGL onExit={onExit} reason="La vista 3D se detuvo por un error del navegador." />}>
            <Suspense fallback={<p className="ex-fallback">Cargando escena…</p>}>
              <SectorScene
                scene={scene}
                flight={flight}
                input={input}
                bounds={bounds}
                obstacles={obstacles}
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
            <p className="ex-hud-point">{tele.near ? `Cerca de ${tele.near.label}` : 'Espacio abierto'}</p>
            <dl className="ex-hud-stats">
              <div>
                <dt>Objeto</dt>
                <dd>{tele.near ? KIND_LABEL[tele.near.kind] : '—'}</dd>
              </div>
              <div>
                <dt>Distancia</dt>
                <dd>{tele.near ? `${Math.round(tele.near.distance)} u` : '—'}</dd>
              </div>
              <div>
                <dt>Velocidad</dt>
                <dd>{tele.speed.toFixed(1)} u/s</dd>
              </div>
            </dl>
            {tele.edge > 0.5 && (
              <p className="ex-chip ex-chip-warn ex-hud-edge" role="status">
                Límite del sector
              </p>
            )}
          </div>
          <div className="ex-panel ex-route-panel">
            <Minimap bounds={bounds} objects={scene.objects} position={tele.position} yaw={tele.yaw} edge={tele.edge} size={mapSize} />
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
        {tele.near ? `Cerca de ${tele.near.label}` : ''}
        {tele.edge > 0.5 ? '. Límite del sector' : ''}
      </p>

      <div className="ex-hud ex-hud-bottom">
        <div className="ex-hud-notes">
          <p className="ex-disclaimer-inline">Representación ilustrativa, no son datos reales de SPHEREx.</p>
          <p className="ex-hint" aria-hidden="true">
            <kbd>W</kbd>/<kbd>S</kbd> acelerar y frenar · <kbd>A</kbd>/<kbd>D</kbd> girar · <kbd>E</kbd>/<kbd>Q</kbd> subir y
            bajar · <kbd>Esc</kbd> volver
          </p>
        </div>
        {webgl && <FlightPad held={held} onHold={hold} />}
      </div>
    </section>
  )
}
