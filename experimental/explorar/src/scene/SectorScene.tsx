import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { Group } from 'three'
import type { NavController } from '../engine/controller'
import { poseFor } from '../engine/pose'
import type { SectorScene as SectorSceneData } from '../engine/types'
import { SceneObjects } from './SceneObjects'
import { Ship } from './Ship'
import { Stars } from './Stars'

const DEG = Math.PI / 180

/**
 * Lleva la cámara y la nave por la ruta. Todo el movimiento sale de NavController (puro y probado);
 * aquí solo se aplica la pose a la escena en cada cuadro.
 */
function Rig({ controller, animate }: { controller: NavController; animate: boolean }) {
  const rig = useRef<Group>(null)
  const ship = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)

  // Con movimiento reducido el render es «bajo demanda»: se pide un cuadro cuando cambia el punto.
  useEffect(() => controller.subscribe(() => invalidate()), [controller, invalidate])

  useFrame((state, delta) => {
    controller.update(Math.min(delta, 0.05) * 1000)
    const pose = poseFor(controller.graph, controller.state)
    const g = rig.current
    const s = ship.current
    if (!g || !s) return
    g.position.set(...pose.position)
    g.rotation.set(pose.pitchDeg * DEG, pose.yawDeg * DEG, 0, 'YXZ')
    camera.position.copy(g.position)
    camera.quaternion.copy(g.quaternion)
    s.rotation.z = pose.rollDeg * DEG
    s.position.y = -1.15 + (animate ? Math.sin(state.clock.elapsedTime * 1.3) * 0.03 : 0)
    if (controller.state.transition) state.invalidate() // mantiene el movimiento en modo «bajo demanda»
  })

  return (
    <group ref={rig}>
      <group ref={ship} position={[0, -1.1, -4.6]} scale={0.62}>
        <group rotation={[0.5, 0, 0]}>
          <Ship />
        </group>
      </group>
    </group>
  )
}

interface Props {
  scene: SectorSceneData
  controller: NavController
  /** false con prefers-reduced-motion: sin giros ni vaivén; render solo cuando algo cambia. */
  animate: boolean
}

/** Escena 3D de un sector. Es la única parte que importa three: se carga de forma diferida. */
export default function SectorScene({ scene, controller, animate }: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={animate ? 'always' : 'demand'}
      camera={{ fov: 50, near: 0.1, far: 3000, position: [0, 0, 0] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <color attach="background" args={['#02060f']} />
      <ambientLight intensity={0.55} color="#8fa6d6" />
      <directionalLight position={[60, 80, 40]} intensity={2.6} color="#fff3dd" />
      <directionalLight position={[-60, -20, 40]} intensity={0.35} color="#4d6bd6" />
      <Stars />
      <SceneObjects objects={scene.objects} spin={animate} />
      <Rig controller={controller} animate={animate} />
    </Canvas>
  )
}
