import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Quaternion, Vector3, type Group, type PerspectiveCamera } from 'three'
import type { NavController } from '../engine/controller'
import { arrivalOffset, cameraFit, fovKick, thrust as thrustFor } from '../engine/motion'
import { progress } from '../engine/navigation'
import { poseFor } from '../engine/pose'
import { NOZZLE, Ship } from './Ship'
import { Trail } from './Trail'

const DEG = Math.PI / 180
/** Cabeceo de la nave (nariz arriba) para que se vea su silueta desde atrás. */
const SHIP_PITCH = 0.5

interface Props {
  controller: NavController
  animate: boolean
  arrive: boolean
  trailParticles: number
}

/**
 * Lleva cámara y nave por la ruta. La pose sale de NavController (puro y probado); aquí se le
 * suman la llegada, el empuje de FOV, una leve oscilación y el ajuste al aspecto de pantalla.
 */
export function Rig({ controller, animate, arrive, trailParticles }: Props) {
  const rig = useRef<Group>(null)
  const shipRoot = useRef<Group>(null)
  const shipRoll = useRef<Group>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const fit = useMemo(() => cameraFit(aspect), [aspect])
  const arrivalStart = useRef<number | null>(null)
  const tmp = useMemo(() => ({ q: new Quaternion(), e: new Euler(), v: new Vector3() }), [])

  // Tobera y dirección de la estela en el espacio del rig (dependen del encuadre).
  const { origin, direction } = useMemo(() => {
    const pitch = new Euler(SHIP_PITCH, 0, 0)
    const o = new Vector3(...NOZZLE).applyEuler(pitch).multiplyScalar(fit.shipScale).add(new Vector3(0, fit.shipY, fit.shipZ))
    const d = new Vector3(0, 0, 1).applyEuler(pitch).normalize()
    return { origin: o, direction: d }
  }, [fit])

  useEffect(() => controller.subscribe(() => invalidate()), [controller, invalidate])

  const currentThrust = () => {
    const t = controller.state.transition
    return thrustFor(t ? t.direction : null, progress(controller.state))
  }

  useFrame((state, delta) => {
    // Tope de 100 ms por cuadro: tras una pausa no salta, y en equipos lentos el trayecto dura poco más de 1 s.
    controller.update(Math.min(delta, 0.1) * 1000)
    const pose = poseFor(controller.graph, controller.state)
    const g = rig.current
    const s = shipRoll.current
    if (!g || !s) return
    g.position.set(...pose.position)
    g.rotation.set(pose.pitchDeg * DEG, pose.yawDeg * DEG, 0, 'YXZ')

    // Llegada al sector: desde atrás y con FOV amplio.
    let back = 0
    let arrivalFov = 0
    if (arrive) {
      if (arrivalStart.current === null) arrivalStart.current = state.clock.elapsedTime
      const a = arrivalOffset((state.clock.elapsedTime - arrivalStart.current) * 1000)
      back = a.back
      arrivalFov = a.fov
      if (back > 0) g.position.add(tmp.v.set(0, 0, back).applyQuaternion(g.quaternion))
    }

    // Leve oscilación de cámara (no con movimiento reducido).
    const t = state.clock.elapsedTime
    const bobY = animate ? Math.sin(t * 0.9) * 0.05 + Math.sin(t * 2.3) * 0.015 : 0
    const bobRoll = animate ? Math.sin(t * 0.6) * 0.25 * DEG : 0
    camera.position.copy(g.position).add(tmp.v.set(0, bobY, 0).applyQuaternion(g.quaternion))
    camera.quaternion.copy(g.quaternion).multiply(tmp.q.setFromEuler(tmp.e.set(0, 0, bobRoll)))

    const kick = animate ? fovKick(progress(controller.state)) : 0
    const fov = fit.fovDeg + kick + arrivalFov
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    s.rotation.z = pose.rollDeg * DEG
    if (shipRoot.current) shipRoot.current.position.y = fit.shipY + (animate ? Math.sin(t * 1.3) * 0.03 : 0)
    if (controller.state.transition || back > 0) state.invalidate() // mantiene el modo «bajo demanda»
  })

  return (
    <group ref={rig}>
      {/* Relleno suave desde detrás y arriba de la cámara: la nave se ve contra la luz clave. */}
      <pointLight position={[0, 3, -2]} intensity={5} distance={14} decay={1} color="#bae6fd" />
      <group ref={shipRoot} position={[0, fit.shipY, fit.shipZ]} scale={fit.shipScale}>
        <group ref={shipRoll}>
          <group rotation={[SHIP_PITCH, 0, 0]}>
            <Ship />
          </group>
        </group>
      </group>
      <Trail count={trailParticles} origin={origin} direction={direction} thrust={currentThrust} animate={animate} />
    </group>
  )
}
