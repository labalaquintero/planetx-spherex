import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FLIGHT_KEYS, inputFrom, type FlightAction } from '../engine/controls'
import {
  boundaryProximity,
  FLIGHT,
  spawnBehind,
  stickyNearest,
  NO_INPUT,
  obstaclesOf,
  sectorBounds,
  speedOf,
  type FlightInput,
  type FlightState,
} from '../engine/flight'
import { STEER_SENSITIVITY } from '../engine/orbit'
import { canScan } from '../engine/scan'
import type { VisitorEvent, VisitorKind } from '../engine/visitors'
import { AdaptiveQuality, adaptiveOptionsFor, detectPlatform, type QualityLevel } from '../engine/quality'
import { platformParam, scanParam, spawnPointParam } from '../params'
import type { SectorConfig, SectorScene as SectorSceneData, Vec3 } from '../engine/types'
import { CHASE } from '../scene/chase'
import { Credits } from './Credits'
import { ErrorBoundary } from './ErrorBoundary'
import { FlightPad } from './FlightPad'
import { InfoCard } from './InfoCard'
import { Minimap } from './Minimap'
import { NoWebGL } from './NoWebGL'
import { ScanOverlay } from './ScanOverlay'
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
  /** Paso de un visitante (para su sonido). */
  onVisitor?: (kind: VisitorKind) => void
  onEngine?: (level: number) => void
  /** Impacto de un cometa o meteorito (para el sonido). */
  onImpact?: (strength: number) => void
  /** Empieza el escaneo de un planeta (para su sonido). */
  onScan?: () => void
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

const IMPACT_TEXT: Record<VisitorKind, string> = {
  comet: 'Impacto de un fragmento de cometa',
  meteor: 'Impacto de micrometeorito',
  asteroid: 'Impacto de un asteroide pequeño',
}

interface Telemetry {
  position: Vec3
  yaw: number
  speed: number
  near?: { id: string; label: string; kind: string; distance: number }
  edge: number
}

/** A esta distancia (a la superficie) el panel muestra el contexto del objeto. */
export const INFO_DISTANCE = 120
/** Y se oculta solo al alejarse más de esto (histéresis). */
export const INFO_HIDE_DISTANCE = 140

export function NavigationScreen({ sector, onExit, arrive, reduced, quality: initialLevel, forced, debug, extraControls, onEngine, onImpact, onVisitor, onScan }: Props) {
  const { scene } = sector
  const webgl = useMemo(() => detectWebGL(), [])
  // Perfil de rendimiento: más ligero en Windows (Direct3D vía ANGLE); ?perfil= lo fuerza.
  const platform = useMemo(
    () =>
      (typeof window !== 'undefined' && platformParam(window.location.search)) ||
      detectPlatform(typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { userAgentData?: { platform?: string } })),
    [],
  )
  const adaptive = useMemo(
    () => new AdaptiveQuality(initialLevel, forced, adaptiveOptionsFor(platform), platform),
    [initialLevel, forced, platform],
  )
  const [settings, setSettings] = useState(adaptive.settings)
  const [fps, setFps] = useState(0)

  // Área visitable y obstáculos, a partir de los objetos del sector.
  const bounds = useMemo(() => sectorBounds(scene.objects, scene.waypoints), [scene])
  const obstacles = useMemo(() => obstaclesOf(scene.objects), [scene])

  // La nave sale delante de la cámara del punto de entrada (la vista del boceto).
  // ?punto=<id> permite salir desde otro punto de ruta (capturas comparables, demo).
  const spawnId = spawnPointParam(typeof window === 'undefined' ? '' : window.location.search, scene.waypoints.map((w) => w.id))
  const start = scene.waypoints.find((w) => w.id === (spawnId ?? scene.startId))!
  const flight = useRef<FlightState>(spawnBehind(start.position, start.yawDeg, CHASE.up, CHASE.back))
  const input = useRef<FlightInput>(NO_INPUT)
  // Dirigir con el ratón: clic derecho y arrastrar cambia la dirección de vuelo (rumbo y cabeceo).
  const aim = useRef({ dYaw: 0, dPitch: 0 })
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
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

  // Escaneo (tecla R cerca de un planeta): abre el panel con el modelo 3D. Mientras está abierto, la nave
  // se queda quieta, la escena deja de dibujarse y R o Esc lo cierran.
  const [scan, setScan] = useState<{ id: string; distance: number } | null>(() => {
    // ?escanear=<id>: abre el escaneo de ese objeto al entrar (capturas y demo).
    const ids = scene.objects.filter((o) => canScan(o)).map((o) => o.id)
    const id = scanParam(typeof window === 'undefined' ? '' : window.location.search, ids)
    const o = id ? scene.objects.find((x) => x.id === id) : undefined
    if (!o) return null
    const p = flight.current.position
    return { id: o.id, distance: Math.hypot(o.position[0] - p[0], o.position[1] - p[1], o.position[2] - p[2]) }
  })
  const scanRef = useRef(scan)
  useEffect(() => {
    scanRef.current = scan
  }, [scan])
  const scannable = useRef<{ id: string; distance: number } | null>(null)
  const openScan = useCallback(() => {
    const target = scannable.current
    if (!target || scanRef.current) return
    setHeld(new Set())
    aim.current.dYaw = 0
    aim.current.dPitch = 0
    setScan(target)
    onScan?.()
  }, [onScan])
  const closeScan = useCallback(() => setScan(null), [])

  // Puntero bloqueado (como en los juegos de vuelo): un clic en la vista lo bloquea y el ratón dirige la
  // nave; Esc lo suelta (el navegador lo hace) y un segundo Esc sale del sector. Las teclas no cambian.
  const canvasRef = useRef<HTMLDivElement>(null)
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)
  const releasedAt = useRef(0)
  useEffect(() => {
    const onChange = () => {
      const now = document.pointerLockElement === canvasRef.current && canvasRef.current !== null
      if (lockedRef.current && !now) releasedAt.current = performance.now()
      lockedRef.current = now
      setLocked(now)
    }
    const onMove = (e: MouseEvent) => {
      if (!lockedRef.current) return
      aim.current.dYaw -= e.movementX * STEER_SENSITIVITY
      aim.current.dPitch -= e.movementY * STEER_SENSITIVITY
    }
    document.addEventListener('pointerlockchange', onChange)
    document.addEventListener('mousemove', onMove)
    return () => {
      document.removeEventListener('pointerlockchange', onChange)
      document.removeEventListener('mousemove', onMove)
      if (lockedRef.current) document.exitPointerLock?.()
    }
  }, [])
  // Al escanear se suelta: el ratón se usa para girar el modelo.
  useEffect(() => {
    if (scan && lockedRef.current) document.exitPointerLock?.()
  }, [scan])

  // Teclado: mantener pulsado = acelerar / girar / subir. R escanea. Esc cierra el escaneo o sale.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextField(e.target)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (scanRef.current) closeScan()
        else if (lockedRef.current) document.exitPointerLock?.()
        else if (performance.now() - releasedAt.current > 400) onExit()
        return
      }
      if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault()
        if (scanRef.current) closeScan()
        else openScan()
        return
      }
      if (scanRef.current) return
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
  }, [hold, onExit, openScan, closeScan])

  // Telemetría del HUD, 10 veces por segundo (la simulación corre en el bucle de render).
  const [tele, setTele] = useState<Telemetry>(() => ({ position: flight.current.position, yaw: flight.current.yaw, speed: 0, edge: 0 }))
  useEffect(() => {
    let lastNear: string | null = null
    const id = setInterval(() => {
      const s = flight.current
      const n = stickyNearest(s.position, scene.objects, lastNear)
      lastNear = n?.object.id ?? null
      const speed = speedOf(s)
      setTele({
        position: s.position,
        yaw: s.yaw,
        speed,
        near: n && { id: n.object.id, label: n.object.label!, kind: n.object.kind, distance: n.distance },
        edge: boundaryProximity(s.position, bounds),
      })
      onEngine?.(Math.min(1, speed / FLIGHT.maxSpeed))
    }, 100)
    return () => clearInterval(id)
  }, [scene, bounds, onEngine])

  // Avisos breves: cometa a la vista, impacto.
  const [toast, setToast] = useState<{ text: string; tone: 'info' | 'warn'; key: number } | null>(null)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), toast.tone === 'warn' ? 3200 : 4500)
    return () => clearTimeout(id)
  }, [toast])
  const onVisitorEvent = useCallback(
    (e: VisitorEvent) => {
      if (e.type === 'spawn') onVisitor?.(e.kind)
      if (e.type === 'spawn' && e.kind === 'comet') setToast({ text: 'Un cometa cruza el sector', tone: 'info', key: Date.now() })
      if (e.type === 'impact') {
        setToast({ text: `${IMPACT_TEXT[e.kind]} · la nave se estabiliza`, tone: 'warn', key: Date.now() })
        onImpact?.(e.strength)
      }
    },
    [onImpact, onVisitor],
  )

  const mapSize = 200
  // Ficha con histéresis: aparece a menos de INFO_DISTANCE y no se va hasta pasar INFO_HIDE_DISTANCE
  // (si no, en el límite aparece y desaparece varias veces por segundo y el texto salta).
  const shown = useRef<string | null>(null)
  if (tele.near && tele.near.distance < INFO_DISTANCE) shown.current = tele.near.id
  else if (!tele.near || tele.near.id !== shown.current || tele.near.distance > INFO_HIDE_DISTANCE) shown.current = null
  const nearObject = shown.current ? scene.objects.find((o) => o.id === shown.current) : undefined
  const nearInfo = nearObject?.info
  const scanTarget = nearObject && canScan(nearObject) && tele.near ? nearObject.id : null
  const scanDistance = tele.near?.distance ?? 0
  useEffect(() => {
    scannable.current = scanTarget ? { id: scanTarget, distance: scanDistance } : null
  }, [scanTarget, scanDistance])
  const scanObject = scan ? scene.objects.find((o) => o.id === scan.id) : undefined

  return (
    <section
      className="ex-nav"
      aria-label={`Vuelo libre en ${sector.name}`}
      data-arrive={arrive ? '' : undefined}
      data-fade-in={arrive ? undefined : ''}
    >
      <div
        ref={canvasRef}
        className="ex-canvas"
        data-locked={locked || undefined}
        onContextMenu={(e) => e.preventDefault()}
        // Nada de acciones del navegador en la vista: arrastrar (imágenes), autodesplazamiento con la
        // rueda pulsada ni selección de texto.
        onDragStart={(e) => e.preventDefault()}
        onAuxClick={(e) => e.preventDefault()}
        onMouseDown={(e) => {
          if (e.button !== 2) e.preventDefault()
        }}
        onPointerDown={(e) => {
          if (e.button === 0 && !scanRef.current && !lockedRef.current) {
            const el = canvasRef.current as (HTMLDivElement & { requestPointerLock(): Promise<void> | void }) | null
            try {
              void Promise.resolve(el?.requestPointerLock()).catch(() => {})
            } catch {
              // Sin bloqueo de puntero (o denegado): se sigue dirigiendo con clic derecho.
            }
            return
          }
          if (e.button !== 2) return
          e.currentTarget.setPointerCapture?.(e.pointerId)
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          // Arrastrar a la derecha gira a la derecha; hacia arriba, apunta hacia arriba.
          aim.current.dYaw -= (e.clientX - d.x) * STEER_SENSITIVITY
          aim.current.dPitch -= (e.clientY - d.y) * STEER_SENSITIVITY
          d.x = e.clientX
          d.y = e.clientY
        }}
        onPointerUp={(e) => {
          if (drag.current?.id !== e.pointerId) return
          drag.current = null
        }}
        onLostPointerCapture={() => {
          drag.current = null
        }}
      >
        {webgl ? (
          <ErrorBoundary fallback={<NoWebGL onExit={onExit} reason="La vista 3D se detuvo por un error del navegador." />}>
            <Suspense fallback={<p className="ex-fallback">Cargando escena…</p>}>
              <SectorScene
                scene={scene}
                flight={flight}
                input={input}
                aim={aim}
                bounds={bounds}
                obstacles={obstacles}
                animate={!reduced}
                arrive={arrive}
                settings={settings}
                quality={adaptive}
                onQualityChange={() => setSettings(adaptive.settings)}
                onFps={debug ? setFps : undefined}
                onVisitorEvent={onVisitorEvent}
                paused={Boolean(scan)}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <NoWebGL onExit={onExit} />
        )}
      </div>

      <div className="ex-hud ex-hud-top">
        <div className="ex-panel ex-hud-info" data-expanded={nearInfo ? '' : undefined}>
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
              <dd>
                {tele.speed.toFixed(1)} u/s{held.has('boost') && <span className="ex-turbo"> · turbo</span>}
              </dd>
            </div>
          </dl>
          {tele.edge > 0.5 && (
            <p className="ex-chip ex-chip-warn ex-hud-edge" role="status">
              Límite del sector
            </p>
          )}
          {nearObject && canScan(nearObject) && (
            <button type="button" className="ex-btn ex-scan-btn" onClick={openScan}>
              Escanear {nearObject.label} <kbd>R</kbd>
            </button>
          )}
          {nearInfo ? (
            <InfoCard info={nearInfo} />
          ) : (
            tele.near && <p className="ex-info-hint">Acércate a menos de {INFO_DISTANCE} u para ver su contexto.</p>
          )}
        </div>
        <div className="ex-hud-actions">
          <Credits />
          {extraControls}
          <button type="button" className="ex-btn" onClick={onExit}>
            <span aria-hidden="true">←</span> Volver a sectores <kbd>Esc</kbd>
          </button>
        </div>
        <div className="ex-panel ex-route-panel">
          <Minimap bounds={bounds} objects={scene.objects} position={tele.position} yaw={tele.yaw} edge={tele.edge} size={mapSize} />
        </div>
      </div>

      {locked && (
        <p className="ex-lock-hint" role="status">
          Dirigiendo con el ratón · <kbd>Esc</kbd> suelta el puntero
        </p>
      )}
      {toast && (
        <p key={toast.key} className="ex-toast" data-tone={toast.tone} role="status">
          {toast.text}
        </p>
      )}

      {debug && (
        <p className="ex-debug" aria-hidden="true">
          {fps.toFixed(0)} FPS · calidad {settings.level}
          {platform === 'windows' ? ' · perfil Windows' : ''}
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
            bajar · clic derecho y arrastra: dirigir la nave · <kbd>Shift</kbd> turbo · <kbd>R</kbd> escanear (cerca de un planeta) · clic en la vista: dirigir
            con el ratón (<kbd>Esc</kbd> lo suelta) · <kbd>Esc</kbd> volver
          </p>
        </div>
        {webgl && <FlightPad held={held} onHold={hold} />}
      </div>
      {scanObject && scan && (
        <ScanOverlay object={scanObject} distance={scan.distance} reduced={reduced} octaves={settings.nebulaOctaves} onClose={closeScan} />
      )}
    </section>
  )
}
