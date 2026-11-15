import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AgXToneMapping } from 'three'
import type { Bounds, FlightInput, FlightState, Obstacle } from '../engine/flight'
import { budgetDpr, type AdaptiveQuality, type QualitySettings } from '../engine/quality'
import type { SectorScene as SectorSceneData } from '../engine/types'
import { smallBodiesOf } from './bodies'
import { DeepSky } from './DeepSky'
import { Bloom } from './Effects'
import { FlightRig } from './FlightRig'
import { LIGHT_DIR } from './light'
import { Planet } from './Planet'
import { Sky } from './Sky'
import { SkyEnvironment } from './SkyEnvironment'
import { SmallBodies } from './SmallBodies'
import { SpaceDust } from './SpaceDust'
import { Station } from './Station'
import { Visitors } from './Visitors'
import type { VisitorEvent } from '../engine/visitors'

interface Props {
  scene: SectorSceneData
  flight: MutableRefObject<FlightState>
  input: MutableRefObject<FlightInput>
  /** Dirección acumulada con clic derecho (rad). */
  aim: MutableRefObject<{ dYaw: number; dPitch: number }>
  bounds: Bounds
  /** Obstáculos de los objetos (los cuerpos pequeños se añaden aquí, según la calidad). */
  obstacles: readonly Obstacle[]
  /** false con prefers-reduced-motion: sin giros, vaivén ni partículas; render bajo demanda. */
  animate: boolean
  arrive: boolean
  settings: QualitySettings
  quality: AdaptiveQuality
  onQualityChange: () => void
  onFps?: (fps: number) => void
  /** Cometas y meteoritos: aparición e impactos (para el HUD y el sonido). */
  onVisitorEvent?: (e: VisitorEvent) => void
  /** En pausa (p. ej., durante un escaneo): no se dibuja ni se simula. */
  paused?: boolean
}

/** dpr de la escena según el nivel y el tope de píxeles; se recalcula al cambiar el tamaño o el zoom. */
function readView(): { dpr: number; pixels: number } {
  return typeof window === 'undefined' ? { dpr: 1, pixels: 0 } : { dpr: window.devicePixelRatio, pixels: window.innerWidth * window.innerHeight }
}

function useScenePixelRatio(settings: QualitySettings): number {
  const [view, setView] = useState(readView)
  useEffect(() => {
    const update = () => setView(readView())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return useMemo(() => budgetDpr(view.dpr, settings, view.pixels), [settings, view])
}

/** Mide cada cuadro y alimenta la calidad adaptativa. */
function Governor({ quality, onChange, onFps }: { quality: AdaptiveQuality; onChange: () => void; onFps?: (fps: number) => void }) {
  const acc = useRef({ t: 0, n: 0 })
  useFrame((_, delta) => {
    const ms = delta * 1000
    if (quality.sample(ms)) onChange()
    if (onFps && ms > 0 && ms < 1000) {
      acc.current.t += ms
      acc.current.n += 1
      if (acc.current.t >= 500) {
        onFps((acc.current.n * 1000) / acc.current.t)
        acc.current.t = 0
        acc.current.n = 0
      }
    }
  })
  return null
}

/** Escena 3D de un sector con vuelo libre. Es la única parte que importa three (carga diferida). */
export default function SectorScene(props: Props) {
  const { scene, flight, input, aim, bounds, obstacles, animate, arrive, settings, quality, onQualityChange, onFps, onVisitorEvent, paused } = props
  const light = LIGHT_DIR.clone().multiplyScalar(200)
  const bodies = useMemo(() => smallBodiesOf(scene, settings.debris), [scene, settings.debris])
  // Las rocas también son obstáculos (con su holgura): no se atraviesan.
  const allObstacles = useMemo(
    () => [...obstacles.filter((o) => !scene.objects.find((x) => x.id === o.id && x.kind === 'smallBody')), ...bodies.map((b, i) => ({ id: `roca-${i}`, center: b.position, radius: b.radius * 1.2 + 2 }))],
    [obstacles, bodies, scene],
  )
  const dpr = useScenePixelRatio(settings)
  // MSAA en el composer: con dpr alto, 2 muestras bastan (los píxeles ya son pequeños).
  const samples = dpr > 1.25 ? Math.min(settings.msaa, 2) : settings.msaa
  return (
    <Canvas
      dpr={dpr}
      frameloop={paused ? 'never' : animate ? 'always' : 'demand'}
      // near 0,5 (no 0,1): 5 veces más precisión de profundidad a 1000 u, sin parpadeo entre la atmósfera y
      // la superficie de los planetas lejanos. far 6000: el fondo nunca se recorta en el borde del sector.
      camera={{ fov: 50, near: 0.5, far: 6000, position: [0, 0, 0] }}
      // Sin antialias en el lienzo: el composer ya hace MSAA; en el lienzo solo costaría una
      // resolución extra a pantalla completa en cada cuadro.
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: AgXToneMapping, toneMappingExposure: 1.15 }}
      aria-hidden="true"
    >
      <color attach="background" args={['#030712']} />
      <SkyEnvironment intensity={0.9} />
      <hemisphereLight args={['#7dd3fc', '#0f172a', 0.35]} />
      <directionalLight position={[light.x, light.y, light.z]} intensity={2.7} color="#fff1dc" />
      <Sky stars={settings.stars} octaves={settings.nebulaOctaves} cube={settings.skyCube} animate={animate} />
      <DeepSky bounds={bounds} stars={settings.nearStars} layers={settings.nebulaLayers} cube={Math.round(settings.skyCube * 0.75)} animate={animate} />
      {scene.objects.map((o) => {
        switch (o.kind) {
          case 'planet':
          case 'ringedPlanet':
          case 'sphere':
            return <Planet key={o.id} o={o.kind === 'sphere' ? { ...o, surface: o.surface ?? 'rocky' } : o} spin={animate} octaves={settings.nebulaOctaves} />
          case 'station':
            return <Station key={o.id} o={o} spin={animate} />
          case 'smallBody':
            return null // se dibujan todos juntos, instanciados
        }
      })}
      <SmallBodies bodies={bodies} palette={scene.field?.palette ?? ['#9a9083', '#6b6358', '#3d3832']} spin={animate} />
      <SpaceDust count={settings.level === 'low' ? 160 : settings.level === 'medium' ? 320 : 520} animate={animate} />
      <Visitors flight={flight} animate={animate} detail={settings.level !== 'low'} onEvent={onVisitorEvent} />
      <FlightRig
        state={flight}
        input={input}
        bounds={bounds}
        obstacles={allObstacles}
        animate={animate}
        arrive={arrive}
        trailParticles={settings.trailParticles}
        aim={aim}
      />
      {settings.bloom && <Bloom strength={settings.bloomStrength} samples={samples} chromatic={settings.chromatic} grain={settings.grain} scale={settings.bloomScale} />}
      <Governor quality={quality} onChange={onQualityChange} onFps={onFps} />
    </Canvas>
  )
}
