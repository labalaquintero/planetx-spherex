import type { SceneObject, Vec3, Waypoint } from './types'

/**
 * Vuelo libre (lógica pura, sin three). La nave se mueve en el plano por rumbo (yaw) y sube o baja
 * en vertical; no hay cabeceo controlable, para que sea fácil de manejar. El alabeo y el cabeceo
 * que se ven son solo visuales y salen del giro y de la velocidad vertical.
 *
 * Convención: rumbo 0 mira a -Z; rumbo positivo gira a la izquierda (hacia -X), como en el Rig.
 */

export interface FlightInput {
  /** -1 (frenar / atrás) .. 1 (acelerar). */
  readonly thrust: number
  /** -1 (derecha) .. 1 (izquierda). */
  readonly turn: number
  /** -1 (bajar) .. 1 (subir). */
  readonly lift: number
}

export const NO_INPUT: FlightInput = { thrust: 0, turn: 0, lift: 0 }

export interface FlightState {
  readonly position: Vec3
  /** Velocidad en el mundo (unidades/s). */
  readonly velocity: Vec3
  /** Rumbo en radianes. */
  readonly yaw: number
  /** Velocidad de giro actual (rad/s), suavizada. */
  readonly yawRate: number
}

export interface Bounds {
  readonly min: Vec3
  readonly max: Vec3
}

export interface Obstacle {
  readonly id: string
  readonly center: Vec3
  /** Radio que la nave no puede cruzar (ya incluye su holgura). */
  readonly radius: number
}

export const FLIGHT = {
  maxSpeed: 30,
  maxReverse: 9,
  accel: 16,
  brake: 26,
  /** Fracción de velocidad que se pierde por segundo sin empuje (amortiguación «arcade»). */
  drag: 0.55,
  maxYawRate: (60 * Math.PI) / 180,
  yawResponse: 6,
  maxClimb: 12,
  climbAccel: 20,
  /** Margen dentro del límite donde empieza el empuje de vuelta. */
  softMargin: 30,
  /** Margen de seguridad de la nave alrededor de cada obstáculo. */
  clearance: 2.5,
  maxBankDeg: 28,
  maxPitchDeg: 10,
} as const

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (v: number) => (Number.isFinite(v) ? v : 0)

export function initialFlight(position: Vec3, yaw = 0): FlightState {
  return { position, velocity: [0, 0, 0], yaw, yawRate: 0 }
}

/** Vector «adelante» de un rumbo. */
export function forwardOf(yaw: number): Vec3 {
  return [-Math.sin(yaw), 0, -Math.cos(yaw)]
}

/** Un paso de simulación. dt en segundos (se acota a 0,1 s; dt no válido no hace nada). */
export function stepFlight(
  s: FlightState,
  input: FlightInput,
  dtIn: number,
  bounds: Bounds,
  obstacles: readonly Obstacle[] = [],
): FlightState {
  if (!(dtIn > 0)) return s
  const dt = Math.min(dtIn, 0.1)
  const thrust = clamp(finite(input.thrust), -1, 1)
  const turn = clamp(finite(input.turn), -1, 1)
  const lift = clamp(finite(input.lift), -1, 1)

  // Giro con respuesta suave.
  const targetRate = turn * FLIGHT.maxYawRate
  const yawRate = s.yawRate + (targetRate - s.yawRate) * (1 - Math.exp(-FLIGHT.yawResponse * dt))
  const yaw = s.yaw + yawRate * dt

  // Velocidad horizontal: se descompone en «adelante» y «lateral»; lo lateral se amortigua rápido
  // (la nave sigue su morro, como un avión, sin derrapar).
  const fwd = forwardOf(yaw)
  let [vx, vy, vz] = s.velocity
  let along = vx * fwd[0] + vz * fwd[2]
  const sideX = vx - along * fwd[0]
  const sideZ = vz - along * fwd[2]
  const sideKeep = Math.exp(-4 * dt)
  if (thrust > 0) along += thrust * FLIGHT.accel * dt
  else if (thrust < 0) along += thrust * (along > 0 ? FLIGHT.brake : FLIGHT.accel * 0.6) * dt
  else along *= Math.exp(-FLIGHT.drag * dt)
  along = clamp(along, -FLIGHT.maxReverse, FLIGHT.maxSpeed)
  vx = along * fwd[0] + sideX * sideKeep
  vz = along * fwd[2] + sideZ * sideKeep

  // Vertical.
  if (lift !== 0) vy += lift * FLIGHT.climbAccel * dt
  else vy *= Math.exp(-2.5 * dt)
  vy = clamp(vy, -FLIGHT.maxClimb, FLIGHT.maxClimb)

  // Límites del sector: empuje suave hacia dentro en el margen; tope duro en el borde.
  const pos: [number, number, number] = [s.position[0] + vx * dt, s.position[1] + vy * dt, s.position[2] + vz * dt]
  const vel: [number, number, number] = [vx, vy, vz]
  for (let i = 0; i < 3; i++) {
    const lo = bounds.min[i]!
    const hi = bounds.max[i]!
    const inLo = lo + FLIGHT.softMargin - pos[i]!
    const inHi = pos[i]! - (hi - FLIGHT.softMargin)
    if (inLo > 0) vel[i] = vel[i]! + inLo * 1.2 * dt
    if (inHi > 0) vel[i] = vel[i]! - inHi * 1.2 * dt
    if (pos[i]! < lo) {
      pos[i] = lo
      vel[i] = Math.max(0, vel[i]!)
    } else if (pos[i]! > hi) {
      pos[i] = hi
      vel[i] = Math.min(0, vel[i]!)
    }
  }

  // Obstáculos: si la nave entra en una esfera, se la saca a la superficie y se anula la
  // componente de velocidad hacia dentro (se desliza por el borde).
  for (const o of obstacles) {
    const dx = pos[0] - o.center[0]
    const dy = pos[1] - o.center[1]
    const dz = pos[2] - o.center[2]
    const d = Math.hypot(dx, dy, dz)
    if (d >= o.radius) continue
    const n: Vec3 = d > 1e-6 ? [dx / d, dy / d, dz / d] : [0, 1, 0]
    pos[0] = o.center[0] + n[0] * o.radius
    pos[1] = o.center[1] + n[1] * o.radius
    pos[2] = o.center[2] + n[2] * o.radius
    const vn = vel[0] * n[0] + vel[1] * n[1] + vel[2] * n[2]
    if (vn < 0) {
      vel[0] -= vn * n[0]
      vel[1] -= vn * n[1]
      vel[2] -= vn * n[2]
    }
  }
  // Acotar al límite otra vez por si un obstáculo empujó fuera.
  for (let i = 0; i < 3; i++) pos[i] = clamp(pos[i]!, bounds.min[i]!, bounds.max[i]!)

  return { position: pos, velocity: vel, yaw, yawRate }
}

/** Rapidez (módulo de la velocidad). */
export function speedOf(s: FlightState): number {
  return Math.hypot(...s.velocity)
}

/** Alabeo y cabeceo visuales de la nave (grados) para un estado. */
export function attitudeOf(s: FlightState): { bankDeg: number; pitchDeg: number } {
  const along = -(s.velocity[0] * Math.sin(s.yaw) + s.velocity[2] * Math.cos(s.yaw))
  const turnFactor = s.yawRate / FLIGHT.maxYawRate
  const speedFactor = 0.35 + 0.65 * Math.min(1, Math.abs(along) / FLIGHT.maxSpeed)
  return {
    bankDeg: clamp(turnFactor * speedFactor * FLIGHT.maxBankDeg, -FLIGHT.maxBankDeg, FLIGHT.maxBankDeg),
    pitchDeg: clamp((s.velocity[1] / FLIGHT.maxClimb) * FLIGHT.maxPitchDeg, -FLIGHT.maxPitchDeg, FLIGHT.maxPitchDeg),
  }
}

/**
 * Área visitable del sector: la caja que contiene todos los objetos y puntos de interés, con un
 * margen. Así el vuelo abarca todo el sector y nada queda fuera de alcance.
 */
export function sectorBounds(objects: readonly SceneObject[], points: readonly Waypoint[], margin = 45): Bounds {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const add = (p: Vec3, r: number) => {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]! - r)
      max[i] = Math.max(max[i]!, p[i]! + r)
    }
  }
  for (const o of objects) add(o.position, o.radius * (o.ring?.outer ?? 1) + (o.length ?? 0) / 2)
  for (const w of points) add(w.position, 0)
  const r = (v: number) => Math.round(v)
  return {
    min: [r(min[0]! - margin), r(min[1]! - margin), r(min[2]! - margin)],
    max: [r(max[0]! + margin), r(max[1]! + margin), r(max[2]! + margin)],
  }
}

/** Obstáculos de los objetos de un sector (los anillos no bloquean: son partículas). */
export function obstaclesOf(objects: readonly SceneObject[]): Obstacle[] {
  return objects.map((o) => ({
    id: o.id,
    center: o.position,
    radius: (o.kind === 'station' ? Math.max(o.radius, (o.length ?? 0) / 2 + (o.handle?.length ?? 0) / 2) : o.radius) * 1.08 + FLIGHT.clearance,
  }))
}

/** Distancia (a la superficie) y objeto con nombre más cercano a una posición. */
export function nearestNamed(p: Vec3, objects: readonly SceneObject[]): { object: SceneObject; distance: number } | undefined {
  let best: { object: SceneObject; distance: number } | undefined
  for (const o of objects) {
    if (!o.label) continue
    // Tamaño envolvente: en la estación cuenta su largo (el cilindro es mucho más largo que ancho).
    const extent = Math.max(o.radius, (o.length ?? 0) / 2)
    const d = Math.max(0, Math.hypot(p[0] - o.position[0], p[1] - o.position[1], p[2] - o.position[2]) - extent)
    if (!best || d < best.distance) best = { object: o, distance: d }
  }
  return best
}

/** 0 lejos del borde .. 1 en el borde: para avisar «límite del sector». */
export function boundaryProximity(p: Vec3, b: Bounds): number {
  let worst = 0
  for (let i = 0; i < 3; i++) {
    const toEdge = Math.min(p[i]! - b.min[i]!, b.max[i]! - p[i]!)
    worst = Math.max(worst, 1 - toEdge / FLIGHT.softMargin)
  }
  return clamp(worst, 0, 1)
}
