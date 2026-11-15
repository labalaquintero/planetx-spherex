import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, MathUtils, Quaternion, Vector3, type Group, type PerspectiveCamera } from 'three'
import { attitudeOf, speedOf, stepFlight, FLIGHT, type Bounds, type FlightInput, type FlightState, type Obstacle } from '../engine/flight'
import { approach, arrivalOffset, cameraFit } from '../engine/motion'
import { orbitOffset, relaxLook, type Look } from '../engine/orbit'
import { CHASE } from './chase'
import { NOZZLES, Ship } from './Ship'
import { Trail, type Emitter } from './Trail'

const DEG = Math.PI / 180

interface Props {
  state: MutableRefObject<FlightState>
  input: MutableRefObject<FlightInput>
  bounds: Bounds
  obstacles: readonly Obstacle[]
  animate: boolean
  arrive: boolean
  trailParticles: number
  /** Mirada libre con clic derecho (la escribe la pantalla; aquí se relaja y se aplica). */
  look: MutableRefObject<Look>
}

/**
 * Simula el vuelo (engine/flight, puro y probado) y coloca la nave y la cámara de persecución.
 * La cámara sigue a la nave con suavizado: al girar, la nave se adelanta y luego la cámara la
 * alcanza. Con movimiento reducido el seguimiento es rígido y sin oscilación ni empuje de FOV.
 */
export function FlightRig({ state, input, bounds, obstacles, animate, arrive, trailParticles, look }: Props) {
  const ship = useRef<Group>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const fit = useMemo(() => cameraFit(aspect), [aspect])
  const arrivalStart = useRef<number | null>(null)
  const cam = useRef({ pos: new Vector3(), yaw: 0, roll: 0, look: 0, ready: false })
  const tmp = useMemo(() => ({ v: new Vector3(), q: new Quaternion(), e: new Euler(0, 0, 0, 'YXZ'), w: new Vector3() }), [])
  // En pantallas verticales la nave se aleja un poco para que quepa.
  const portrait = Math.min(1, Math.max(0, (1.2 - aspect) / 0.7))
  const back = CHASE.back * (1 + 0.45 * portrait)
  const up = CHASE.up * (1 + 0.3 * portrait)

  // Una estela por tobera (dos motores).
  const makeEmitter = (): Emitter => ({ origin: new Vector3(), direction: new Vector3(0, 0, 1), velocity: new Vector3(), thrust: 0.3 })
  const emitterL = useRef<Emitter>(makeEmitter())
  const emitterR = useRef<Emitter>(makeEmitter())

  // Con movimiento reducido el render es «bajo demanda»: se pide cuadro mientras haya entrada o velocidad.
  useEffect(() => {
    if (animate) return
    const id = setInterval(() => {
      const i = input.current
      const l = look.current
      if (i.thrust || i.turn || i.lift || speedOf(state.current) > 0.05 || l.dragging || l.yaw || l.pitch) invalidate()
    }, 50)
    return () => clearInterval(id)
  }, [animate, input, state, invalidate, look])

  useFrame((frame, delta) => {
    const s = stepFlight(state.current, input.current, Math.min(delta, 0.1), bounds, obstacles)
    state.current = s
    const g = ship.current
    if (!g) return
    const att = attitudeOf(s)
    g.position.set(...s.position)
    g.rotation.set(animate ? att.pitchDeg * DEG : 0, s.yaw, animate ? att.bankDeg * DEG : 0, 'YXZ')

    // Cámara: detrás y arriba según el rumbo, con suavizado.
    const dtMs = Math.min(delta, 0.1) * 1000
    const c = cam.current
    // Mirada libre: el punto de la cámara gira alrededor de la nave (con mirada 0, igual que siempre).
    const l = (look.current = relaxLook(look.current, dtMs))
    const off = orbitOffset(up, back, l)
    const target = tmp.w.set(off[0], off[1], off[2]).applyAxisAngle(new Vector3(0, 1, 0), s.yaw).add(g.position)
    if (!c.ready || !animate) {
      c.pos.copy(target)
      c.yaw = s.yaw
      c.ready = true
    } else {
      c.pos.set(
        approach(c.pos.x, target.x, dtMs, CHASE.posHalfLifeMs),
        approach(c.pos.y, target.y, dtMs, CHASE.posHalfLifeMs),
        approach(c.pos.z, target.z, dtMs, CHASE.posHalfLifeMs),
      )
      c.yaw = approach(c.yaw, s.yaw, dtMs, CHASE.yawHalfLifeMs)
    }
    // Pulido de cámara: se inclina un poco con el alabeo de la nave y mira levemente hacia
    // donde gira (anticipación). Con movimiento reducido, nada de eso.
    c.roll = animate ? approach(c.roll, att.bankDeg * 0.3, dtMs, 220) : 0
    c.look = animate ? approach(c.look, s.yawRate * 0.14, dtMs, 260) : 0
    tmp.e.set(CHASE.pitchDeg * DEG + l.pitch, c.yaw + c.look + l.yaw, c.roll * DEG, 'YXZ')
    camera.quaternion.setFromEuler(tmp.e)
    camera.position.copy(c.pos)

    // Llegada al sector: desde atrás y con FOV amplio.
    let arrivalFov = 0
    if (arrive) {
      if (arrivalStart.current === null) arrivalStart.current = frame.clock.elapsedTime
      const a = arrivalOffset((frame.clock.elapsedTime - arrivalStart.current) * 1000)
      arrivalFov = a.fov
      if (a.back > 0) camera.position.add(tmp.v.set(0, 0, a.back).applyQuaternion(camera.quaternion))
      if (a.back > 0) frame.invalidate()
    }
    if (animate) {
      const t = frame.clock.elapsedTime
      // Oscilación muy leve, en dos frecuencias (no periódica a simple vista).
      camera.position.y += Math.sin(t * 0.9) * 0.035 + Math.sin(t * 2.17) * 0.01
      camera.position.x += Math.sin(t * 0.63) * 0.02
    }
    const speed = speedOf(s)
    const fov = fit.fovDeg + arrivalFov + (animate ? CHASE.speedFovDeg * Math.min(1, speed / FLIGHT.maxSpeed) : 0)
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // Emisor de la estela: tobera en el mundo, hacia atrás de la nave.
    g.updateMatrixWorld()
    const i = input.current
    const k = MathUtils.clamp(0.25 + 0.75 * Math.max(0, i.thrust) * (0.5 + 0.5 * speed / FLIGHT.maxSpeed) + 0.2 * Math.abs(i.lift), 0, 1)
    ;[emitterL.current, emitterR.current].forEach((e, n) => {
      const nz = NOZZLES[n]!
      e.origin.set(nz[0], nz[1], nz[2]).applyMatrix4(g.matrixWorld)
      e.direction.set(0, 0, 1).applyQuaternion(g.quaternion).normalize()
      e.velocity.set(...s.velocity)
      e.thrust = k
    })
    if (speed > 0.05 || i.thrust || i.turn || i.lift) frame.invalidate()
  })

  return (
    <>
      <group ref={ship} scale={CHASE.shipScale}>
        <Ship thrust={emitterL} />
        {/* Relleno suave desde arriba y detrás (lado de la cámara). */}
        <pointLight position={[0, 4, 5]} intensity={2.6} distance={18} decay={1} color="#bae6fd" />
        {/* Contraluz: fría, delante y arriba de la nave; dibuja su silueta contra el fondo. */}
        <pointLight position={[0, 1.2, -11]} intensity={4.5} distance={18} decay={1.4} color="#a5b4fc" />
      </group>
      <Trail count={Math.ceil(trailParticles / 2)} emitter={emitterL} animate={animate} />
      <Trail count={Math.ceil(trailParticles / 2)} emitter={emitterR} animate={animate} />
    </>
  )
}
