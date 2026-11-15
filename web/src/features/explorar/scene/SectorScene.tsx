import { useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AgXToneMapping } from 'three'
import type { Bounds, FlightInput, FlightState, Obstacle } from '../engine/flight'
import type { AdaptiveQuality, QualitySettings } from '../engine/quality'
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
  const { scene, flight, input, aim, bounds, obstacles, animate, arrive, settings, quality, onQualityChange, onFps, onVisitorEvent } = props
  const light = LIGHT_DIR.clone().multiplyScalar(200)
  const bodies = useMemo(() => smallBodiesOf(scene, settings.debris), [scene, settings.debris])
  // Las rocas también son obstáculos (con su holgura): no se atraviesan.
  const allObstacles = useMemo(
    () => [...obstacles.filter((o) => !scene.objects.find((x) => x.id === o.id && x.kind === 'smallBody')), ...bodies.map((b, i) => ({ id: `roca-${i}`, center: b.position, radius: b.radius * 1.2 + 2 }))],
    [obstacles, bodies, scene],
  )
  const samples = settings.level === 'high' ? 4 : settings.level === 'medium' ? 2 : 0
  return (
    <Canvas
      dpr={[1, settings.dprMax]}
      frameloop={animate ? 'always' : 'demand'}
      camera={{ fov: 50, near: 0.1, far: 4000, position: [0, 0, 0] }}
      gl={{ antialias: settings.level !== 'low', powerPreference: 'high-performance', toneMapping: AgXToneMapping, toneMappingExposure: 1.15 }}
      aria-hidden="true"
    >
      <color attach="background" args={['#030712']} />
      <SkyEnvironment intensity={0.9} />
      <hemisphereLight args={['#7dd3fc', '#0f172a', 0.35]} />
      <directionalLight position={[light.x, light.y, light.z]} intensity={2.7} color="#fff1dc" />
      <Sky stars={settings.stars} octaves={settings.nebulaOctaves} animate={animate} />
      <DeepSky bounds={bounds} stars={settings.nearStars} layers={settings.nebulaLayers} animate={animate} />
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
      <Visitors flight={flight} animate={animate} onEvent={onVisitorEvent} />
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
      {settings.bloom && <Bloom strength={settings.bloomStrength} samples={samples} chromatic={settings.chromatic} grain={settings.grain} />}
      <Governor quality={quality} onChange={onQualityChange} onFps={onFps} />
    </Canvas>
  )
}
