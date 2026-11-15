import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, MathUtils, Quaternion, Vector3, type Group, type PerspectiveCamera } from 'three'
import { DIVE, diveExit, diveFrame, diveTrigger, type DivePlan } from '../engine/dive'
import { attitudeOf, speedOf, steerFlight, stepFlight, upOf, FLIGHT, type Bounds, type FlightInput, type FlightState, type Obstacle } from '../engine/flight'
import type { SceneObject } from '../engine/types'
import { approach, arrivalOffset, cameraFit } from '../engine/motion'
import { orbitOffset } from '../engine/orbit'
import { CHASE } from './chase'
import { LIGHT_DIR } from './light'
import type { ActiveDive } from './DiveFX'
import { Shield } from './Shield'
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
  /** Dirección pendiente de aplicar (rad), acumulada por la pantalla al arrastrar con clic derecho. */
  aim: MutableRefObject<{ dYaw: number; dPitch: number }>
  /** Objetos del sector (para saber qué planetas gaseosos se pueden atravesar). */
  objects: readonly SceneObject[]
  /** Travesía en curso (compartida con DiveFX). */
  dive: MutableRefObject<ActiveDive | null>
  /** Momentos de la travesía: empieza, entra en el planeta, sale y termina. */
  onDive?: (event: DiveEvent, plan: DivePlan) => void
}

export type DiveEvent = 'start' | 'enter' | 'exit' | 'end'

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Simula el vuelo (engine/flight, puro y probado) y coloca la nave y la cámara de persecución.
 * La cámara sigue a la nave con suavizado: al girar, la nave se adelanta y luego la cámara la
 * alcanza. Con movimiento reducido el seguimiento es rígido y sin oscilación ni empuje de FOV.
 */
export function FlightRig({ state, input, bounds, obstacles, animate, arrive, trailParticles, aim, objects, dive, onDive }: Props) {
  const ship = useRef<Group>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const fit = useMemo(() => cameraFit(aspect), [aspect])
  const arrivalStart = useRef<number | null>(null)
  const cam = useRef({ pos: new Vector3(), yaw: 0, pitch: 0, roll: 0, look: 0, ready: false })
  const tmp = useMemo(() => ({ v: new Vector3(), q: new Quaternion(), e: new Euler(0, 0, 0, 'YXZ'), w: new Vector3() }), [])
  // Travesía: pose de la cámara al empezar, cámara fija de la salida, fase anterior y fin (enfriamiento).
  const cine = useMemo(
    () => ({
      startPos: new Vector3(),
      startQuat: new Quaternion(),
      exitCam: new Vector3(),
      pos: new Vector3(),
      look: new Vector3(),
      f: new Vector3(),
      up: new Vector3(),
      right: new Vector3(),
      m: new Quaternion(),
      tq: new Quaternion(),
      phase: '' as string,
      lastS: 0,
      lastT: 0,
      endedAt: -Infinity,
    }),
    [],
  )
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
      const a = aim.current
      if (i.thrust || i.turn || i.lift || speedOf(state.current) > 0.05 || a.dYaw || a.dPitch) invalidate()
    }, 50)
    return () => clearInterval(id)
  }, [animate, input, state, invalidate, aim])

  /** Un cuadro de la travesía: nave por la recta, coreografía de cámara y, al final, vuelta al vuelo. */
  const diveStep = (now: number, dt: number) => {
    const d = dive.current!
    const g = ship.current!
    const { plan } = d
    const t = now - d.t0
    const f = diveFrame(plan, t)
    const c = cine
    c.f.set(...plan.dir)
    c.up.set(...upOf(plan.yaw, plan.pitch))
    c.right.crossVectors(c.f, c.up).normalize()

    // Nave: por la recta, con el rumbo del plan y un tonel completo mientras cruza.
    const roll = Math.PI * 2 * smooth(DIVE.enterAt, DIVE.exitAt, f.u)
    g.position.set(...f.position)
    g.rotation.set(plan.pitch, plan.yaw, roll, 'YXZ')
    // Velocidad estimada (para la estela) y estado visible para el HUD, el mapa y los visitantes.
    const speedNow = dt > 0 ? Math.max(0, (f.s - c.lastS) / dt) : DIVE.exitSpeed
    c.lastS = f.s
    state.current = {
      ...state.current,
      position: f.position,
      velocity: [plan.dir[0] * speedNow, plan.dir[1] * speedNow, plan.dir[2] * speedNow],
      contact: 0,
      jolt: 0,
    }

    // Momentos: entra y sale de la superficie.
    if (c.phase === 'approach' && f.phase !== 'approach') {
      c.phase = 'inside'
      onDive?.('enter', plan)
    }
    if (c.phase === 'inside' && f.phase === 'exit') {
      c.phase = 'exit'
      // Cámara fija fuera, más allá del punto de salida, mirando cómo sale la nave.
      const tOut = plan.tExit
      // Se aparta hacia donde llega la luz de la estrella: detrás de la nave se ve el borde iluminado del
      // planeta aunque la salida caiga en su lado de noche.
      tmp.v.copy(LIGHT_DIR).addScaledVector(c.f, -LIGHT_DIR.dot(c.f))
      if (tmp.v.lengthSq() < 1e-4) tmp.v.copy(c.right)
      tmp.v.normalize()
      c.exitCam
        .set(plan.start[0] + plan.dir[0] * tOut, plan.start[1] + plan.dir[1] * tOut, plan.start[2] + plan.dir[2] * tOut)
        .addScaledVector(c.f, 30 + plan.radius * 0.6)
        .addScaledVector(tmp.v, 16 + plan.radius * 0.45)
        .addScaledVector(c.up, 6)
      onDive?.('exit', plan)
    }

    // Planos de cámara.
    const P = g.position
    const shotA = (out: Vector3) => out.copy(P).addScaledVector(c.f, -7.5).addScaledVector(c.right, 4.2).addScaledVector(c.up, 1.4)
    const shotB = (out: Vector3) => out.copy(P).addScaledVector(c.f, -5.2).addScaledVector(c.right, 1.4).addScaledVector(c.up, 0.9)
    let fov: number
    let shake = 0
    if (f.phase !== 'exit') {
      // Aproximación: de la cámara de persecución a un plano de tres cuartos (zoom); luego, dentro, pegada.
      const toA = smooth(0, 0.12, f.u)
      const toB = smooth(0.17, 0.26, f.u)
      shotA(c.pos)
      tmp.v.copy(c.pos)
      shotB(c.pos)
      c.pos.lerpVectors(tmp.v, c.pos, toB)
      c.pos.lerpVectors(c.startPos, c.pos, toA)
      c.look.copy(P).addScaledVector(c.f, 25 - 13 * toB)
      fov = 50 + (42 - 50) * toA + (76 - 42) * toB
      shake = 0.24 * f.depth + 0.05 * toA
    } else {
      // Salida: plano fijo desde fuera; al final vuelve, suave, a la persecución.
      c.pos.copy(c.exitCam)
      c.look.copy(P)
      fov = 40
      shake = 0.3 * Math.exp(-(f.u - DIVE.exitAt) * DIVE.seconds * 3)
    }
    camera.position.copy(c.pos)
    camera.up.copy(c.up)
    camera.lookAt(c.look)
    if (f.phase !== 'exit') {
      // Del plano de inicio al de la travesía sin salto de orientación.
      c.tq.copy(camera.quaternion)
      c.m.copy(c.startQuat).slerp(c.tq, smooth(0, 0.12, f.u))
      camera.quaternion.copy(c.m)
    }
    if (f.phase === 'inside') camera.rotateZ(Math.sin(t * 1.7) * 0.06)
    if (shake > 0) {
      camera.position.x += shake * (Math.sin(t * 41.3) + 0.5 * Math.sin(t * 67.1))
      camera.position.y += shake * (Math.sin(t * 37.9) + 0.5 * Math.sin(t * 23.3))
    }
    // Vuelta a la persecución en el último tramo.
    const back = smooth(0.88, 1, f.u)
    if (back > 0) {
      const off = orbitOffset(up, CHASE.back, { yaw: 0, pitch: plan.pitch })
      tmp.w.set(off[0], off[1], off[2]).applyAxisAngle(new Vector3(0, 1, 0), plan.yaw).add(P)
      camera.position.lerp(tmp.w, back)
      tmp.e.set(CHASE.pitchDeg * DEG + plan.pitch, plan.yaw, 0, 'YXZ')
      c.tq.setFromEuler(tmp.e)
      camera.quaternion.slerp(c.tq, back)
      fov = fov + (fit.fovDeg - fov) * back
    }
    camera.up.set(0, 1, 0)
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // Estela: a tope.
    g.updateMatrixWorld()
    ;[emitterL.current, emitterR.current].forEach((e, n) => {
      const nz = NOZZLES[n]!
      e.origin.set(nz[0], nz[1], nz[2]).applyMatrix4(g.matrixWorld)
      e.direction.set(0, 0, 1).applyQuaternion(g.quaternion).normalize()
      e.velocity.set(...state.current.velocity)
      e.thrust = 1
    })

    if (f.done) {
      state.current = diveExit(plan, state.current)
      dive.current = null
      c.endedAt = now
      // La persecución sigue desde donde quedó la cámara (sin salto).
      const cc = cam.current
      cc.pos.copy(camera.position)
      cc.yaw = plan.yaw
      cc.pitch = plan.pitch
      cc.roll = 0
      cc.look = 0
      onDive?.('end', plan)
    }
  }

  useFrame((frame, delta) => {
    const now = frame.clock.elapsedTime
    // ¿Empieza una travesía? Solo con animación y con un respiro tras la anterior.
    if (!dive.current && animate && now - cine.endedAt > 1.5) {
      const plan = diveTrigger(state.current, input.current, objects, obstacles)
      if (plan) {
        dive.current = { plan, t0: now }
        cine.startPos.copy(camera.position)
        cine.startQuat.copy(camera.quaternion)
        cine.phase = 'approach'
        cine.lastS = 0
        cine.lastT = 0
        onDive?.('start', plan)
      }
    }
    if (dive.current && ship.current) {
      diveStep(frame.clock.elapsedTime, Math.min(delta, 0.1))
      return
    }
    // Dirección con el ratón: se aplica lo acumulado desde el cuadro anterior.
    const a = aim.current
    const steered = steerFlight(state.current, a.dYaw, a.dPitch)
    a.dYaw = 0
    a.dPitch = 0
    const s = stepFlight(steered, input.current, Math.min(delta, 0.1), bounds, obstacles)
    state.current = s
    const g = ship.current
    if (!g) return
    const att = attitudeOf(s)
    g.position.set(...s.position)
    g.rotation.set(s.pitch + (animate ? att.pitchDeg * DEG : 0), s.yaw, animate ? att.bankDeg * DEG : 0, 'YXZ')

    // Cámara: detrás y arriba según el rumbo, con suavizado.
    const dtMs = Math.min(delta, 0.1) * 1000
    const c = cam.current
    // La cámara sigue detrás de la nave también en cabeceo: la nave se ve igual y el horizonte gira.
    const off = orbitOffset(up, back, { yaw: 0, pitch: s.pitch })
    const target = tmp.w.set(off[0], off[1], off[2]).applyAxisAngle(new Vector3(0, 1, 0), s.yaw).add(g.position)
    if (!c.ready || !animate) {
      c.pos.copy(target)
      c.yaw = s.yaw
      c.pitch = s.pitch
      c.ready = true
    } else {
      c.pos.set(
        approach(c.pos.x, target.x, dtMs, CHASE.posHalfLifeMs),
        approach(c.pos.y, target.y, dtMs, CHASE.posHalfLifeMs),
        approach(c.pos.z, target.z, dtMs, CHASE.posHalfLifeMs),
      )
      c.yaw = approach(c.yaw, s.yaw, dtMs, CHASE.yawHalfLifeMs)
      c.pitch = approach(c.pitch, s.pitch, dtMs, CHASE.yawHalfLifeMs)
    }
    // Pulido de cámara: se inclina un poco con el alabeo de la nave y mira levemente hacia
    // donde gira (anticipación). Con movimiento reducido, nada de eso.
    c.roll = animate ? approach(c.roll, att.bankDeg * 0.3, dtMs, 220) : 0
    c.look = animate ? approach(c.look, s.yawRate * 0.14, dtMs, 260) : 0
    tmp.e.set(CHASE.pitchDeg * DEG + c.pitch, c.yaw + c.look, c.roll * DEG, 'YXZ')
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
    // Temblor sutil al rozar un objeto, más marcado en un impacto (decae solo con el estado).
    if (animate && (s.contact > 0.01 || s.jolt > 0.01)) {
      const t = frame.clock.elapsedTime
      const amp = s.contact * 0.05 + s.jolt * 0.4
      camera.position.x += amp * (Math.sin(t * 37.3) + 0.5 * Math.sin(t * 61.7))
      camera.position.y += amp * (Math.sin(t * 43.1) + 0.5 * Math.sin(t * 29.9))
      camera.rotateZ(s.jolt * 0.03 * Math.sin(t * 31.0))
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
        <Shield state={state} animate={animate} />
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
