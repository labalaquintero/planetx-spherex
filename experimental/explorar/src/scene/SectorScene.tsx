import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { NavController } from '../engine/controller'
import type { AdaptiveQuality, QualitySettings } from '../engine/quality'
import type { SectorScene as SectorSceneData } from '../engine/types'
import { Bloom } from './Effects'
import { LIGHT_DIR } from './light'
import { Planet } from './Planet'
import { Rig } from './Rig'
import { Sky } from './Sky'
import { SmallBodies } from './SmallBodies'
import { Station } from './Station'

interface Props {
  scene: SectorSceneData
  controller: NavController
  /** false con prefers-reduced-motion: sin giros, vaivén ni partículas; render bajo demanda. */
  animate: boolean
  /** Llegada desde atrás con FOV amplio. */
  arrive: boolean
  settings: QualitySettings
  quality: AdaptiveQuality
  /** Se llama cuando la calidad adaptativa cambia de nivel. */
  onQualityChange: () => void
  /** Se llama cada ~0,5 s con los FPS medidos (solo si se pasa: ?debug). */
  onFps?: (fps: number) => void
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

/** Escena 3D de un sector. Es la única parte que importa three: se carga de forma diferida. */
export default function SectorScene({ scene, controller, animate, arrive, settings, quality, onQualityChange, onFps }: Props) {
  const light = LIGHT_DIR.clone().multiplyScalar(200)
  return (
    <Canvas
      dpr={[1, settings.dprMax]}
      frameloop={animate ? 'always' : 'demand'}
      camera={{ fov: 50, near: 0.1, far: 4000, position: [0, 0, 0] }}
      gl={{ antialias: settings.level !== 'low', powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <color attach="background" args={['#030712']} />
      <hemisphereLight args={['#7dd3fc', '#0f172a', 0.55]} />
      <directionalLight position={[light.x, light.y, light.z]} intensity={3.2} color="#fff1dc" />
      <Sky stars={settings.stars} octaves={settings.nebulaOctaves} animate={animate} />
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
      <SmallBodies scene={scene} debris={settings.debris} spin={animate} />
      <Rig controller={controller} animate={animate} arrive={arrive} trailParticles={settings.trailParticles} />
      {settings.bloom && <Bloom strength={settings.bloomStrength} />}
      <Governor quality={quality} onChange={onQualityChange} onFps={onFps} />
    </Canvas>
  )
}
