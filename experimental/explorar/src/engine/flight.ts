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
  /** Turbo (Shift): más velocidad máxima para cruzar zonas lejanas. */
  readonly boost?: boolean
}

export const NO_INPUT: FlightInput = { thrust: 0, turn: 0, lift: 0 }

export interface FlightState {
  readonly position: Vec3
  /** Velocidad en el mundo (unidades/s). */
  readonly velocity: Vec3
  /** Rumbo en radianes. */
  readonly yaw: number
  /** Cabeceo de la dirección de vuelo (rad, positivo = morro arriba). Se dirige con el ratón. */
  readonly pitch: number
  /** 0..1: roce con un objeto al acercarse demasiado (efecto sutil); decae solo. */
  readonly contact: number
  /** 0..1: sacudida por un impacto (cometa o meteorito); decae sola y la nave se recupera. */
  readonly jolt: number
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
  /** Turbo: la velocidad máxima y la aceleración se multiplican (un poco más rápido, no mucho). */
  boostFactor: 1.6,
  boostAccel: 1.4,
  /** Al soltar el turbo, el exceso de velocidad se apaga con esta tasa (1/s), sin frenazo. */
  boostRelease: 1.2,
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
  /** Margen de seguridad de la nave alrededor de cada obstáculo (pequeño: se puede llegar muy cerca). */
  clearance: 1.2,
  /** Zona de frenado suave antes del borde de un objeto: max(soft, radio × softFraction). */
  softMin: 8,
  softFraction: 0.2,
  maxBankDeg: 28,
  /** Cabeceo máximo de la dirección de vuelo (rad). */
  maxAimPitch: (60 * Math.PI) / 180,
  maxPitchDeg: 10,
} as const

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (v: number) => (Number.isFinite(v) ? v : 0)

export function initialFlight(position: Vec3, yaw = 0): FlightState {
  return { position, velocity: [0, 0, 0], yaw, pitch: 0, yawRate: 0, contact: 0, jolt: 0 }
}

/**
 * Pose de salida para que la cámara de persecución quede exactamente en `point` (con su rumbo): la
 * nave va `back` unidades delante y `up` unidades debajo, en la dirección del rumbo.
 */
export function spawnBehind(point: Vec3, yawDeg: number, up: number, back: number): FlightState {
  const yaw = (yawDeg * Math.PI) / 180
  const f = forwardOf(yaw)
  return initialFlight([point[0] + f[0] * back, point[1] - up, point[2] + f[2] * back], yaw)
}

/** Vector «adelante» de un rumbo y un cabeceo. */
export function forwardOf(yaw: number, pitch = 0): Vec3 {
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]
}

/** «Arriba» de la nave (perpendicular a su adelante, en el plano vertical). */
export function upOf(yaw: number, pitch = 0): Vec3 {
  return [Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)]
}

/**
 * Dirigir con el ratón: gira el rumbo y el cabeceo de la dirección de vuelo (rad). El cabeceo se
 * acota; la nave sigue viéndose igual desde la cámara, que la acompaña.
 */
export function steerFlight(s: FlightState, dYaw: number, dPitch: number): FlightState {
  if (!Number.isFinite(dYaw) || !Number.isFinite(dPitch) || (dYaw === 0 && dPitch === 0)) return s
  return { ...s, yaw: s.yaw + dYaw, pitch: clamp(s.pitch + dPitch, -FLIGHT.maxAimPitch, FLIGHT.maxAimPitch) }
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

  // Velocidad: se descompone en «adelante» (según rumbo y cabeceo), «arriba» de la nave y lateral.
  // Lo lateral se amortigua rápido (la nave sigue su morro, sin derrapar); «arriba» es el de subir
  // y bajar con E/Q. Con cabeceo 0 es exactamente el vuelo horizontal de siempre.
  const fwd = forwardOf(yaw, s.pitch)
  const up = upOf(yaw, s.pitch)
  const v = s.velocity
  let along = v[0] * fwd[0] + v[1] * fwd[1] + v[2] * fwd[2]
  let vUp = v[0] * up[0] + v[1] * up[1] + v[2] * up[2]
  const sideKeep = Math.exp(-4 * dt)
  const lat = [0, 1, 2].map((i) => (v[i]! - along * fwd[i]! - vUp * up[i]!) * sideKeep)
  const boost = Boolean(input.boost) && thrust > 0
  const top = FLIGHT.maxSpeed * (boost ? FLIGHT.boostFactor : 1)
  // Acelerar nunca lleva por encima del tope; si ya iba más rápido (acaba de soltar el turbo), no suma.
  if (thrust > 0) along = Math.min(along + thrust * FLIGHT.accel * (boost ? FLIGHT.boostAccel : 1) * dt, Math.max(top, along))
  else if (thrust < 0) along += thrust * (along > 0 ? FLIGHT.brake : FLIGHT.accel * 0.6) * dt
  else along *= Math.exp(-FLIGHT.drag * dt)
  // Por encima del tope (al soltar el turbo) baja suave hacia él; por debajo, el tope de siempre.
  if (along > top) along = top + (along - top) * Math.exp(-FLIGHT.boostRelease * dt)
  along = Math.max(along, -FLIGHT.maxReverse)

  if (lift !== 0) vUp += lift * FLIGHT.climbAccel * dt
  else vUp *= Math.exp(-2.5 * dt)
  vUp = clamp(vUp, -FLIGHT.maxClimb, FLIGHT.maxClimb)

  let vx = along * fwd[0] + vUp * up[0] + lat[0]!
  let vy = along * fwd[1] + vUp * up[1] + lat[1]!
  let vz = along * fwd[2] + vUp * up[2] + lat[2]!

  // Acercamiento suave: muy cerca de un objeto, la velocidad hacia él se va perdiendo poco a poco y
  // un empuje leve la desvía por el borde (no hay choque seco). Deja un «roce» que decae.
  let contact = s.contact * Math.exp(-2.5 * dt)
  const jolt = s.jolt * Math.exp(-1.8 * dt)
  for (const o of obstacles) {
    const dx = s.position[0] - o.center[0]
    const dy = s.position[1] - o.center[1]
    const dz = s.position[2] - o.center[2]
    const d = Math.hypot(dx, dy, dz)
    const soft = Math.max(FLIGHT.softMin, o.radius * FLIGHT.softFraction)
    if (d >= o.radius + soft || d < 1e-6) continue
    const n: Vec3 = [dx / d, dy / d, dz / d]
    const pen = Math.min(1, (o.radius + soft - d) / soft)
    const vn = vx * n[0] + vy * n[1] + vz * n[2]
    if (vn < 0) {
      // Velocidad máxima permitida hacia el objeto: baja con la distancia (desaceleración constante)
      // hasta 0 en el borde. Se alcanza con suavizado: frena poco a poco, nunca en seco.
      const allowed = FLIGHT.maxSpeed * Math.sqrt(Math.max(0, 1 - pen / 0.8))
      if (-vn > allowed) {
        const delta = (-allowed - vn) * (1 - Math.exp(-30 * dt))
        vx += n[0] * delta
        vy += n[1] * delta
        vz += n[2] * delta
      }
      contact = Math.max(contact, Math.min(1, (-vn / 15) * pen))
    }
    const push = pen * 10 * dt
    vx += n[0] * push
    vy += n[1] * push
    vz += n[2] * push
  }

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

  return { position: pos, velocity: vel, yaw, pitch: s.pitch, yawRate, contact, jolt }
}

/**
 * Impacto (cometa o meteorito): empuja la nave en la dirección del golpe, la hace guiñar un poco y deja
 * una sacudida que decae. Sin más: la nave se recupera sola con su amortiguación.
 */
export function applyImpact(s: FlightState, dir: Vec3, strength: number): FlightState {
  const k = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 0))
  const len = Math.hypot(...dir)
  if (k === 0 || !(len > 0)) return s
  const u = dir.map((c) => c / len) as unknown as Vec3
  const v = s.velocity
  return {
    ...s,
    velocity: [v[0] + u[0] * 9 * k, v[1] + u[1] * 9 * k, v[2] + u[2] * 9 * k],
    yawRate: s.yawRate + (u[0] >= 0 ? -1 : 1) * 0.9 * k,
    jolt: Math.max(s.jolt, k),
  }
}

/** Rapidez (módulo de la velocidad). */
export function speedOf(s: FlightState): number {
  return Math.hypot(...s.velocity)
}

/** Alabeo y cabeceo visuales de la nave (grados) para un estado. */
export function attitudeOf(s: FlightState): { bankDeg: number; pitchDeg: number } {
  const f = forwardOf(s.yaw, s.pitch)
  const u = upOf(s.yaw, s.pitch)
  const along = s.velocity[0] * f[0] + s.velocity[1] * f[1] + s.velocity[2] * f[2]
  const vUp = s.velocity[0] * u[0] + s.velocity[1] * u[1] + s.velocity[2] * u[2]
  const turnFactor = s.yawRate / FLIGHT.maxYawRate
  const speedFactor = 0.35 + 0.65 * Math.min(1, Math.abs(along) / FLIGHT.maxSpeed)
  return {
    bankDeg: clamp(turnFactor * speedFactor * FLIGHT.maxBankDeg, -FLIGHT.maxBankDeg, FLIGHT.maxBankDeg),
    // Inclinación visual extra al subir o bajar con E/Q (el cabeceo dirigido va aparte, en `pitch`).
    pitchDeg: clamp((vUp / FLIGHT.maxClimb) * FLIGHT.maxPitchDeg, -FLIGHT.maxPitchDeg, FLIGHT.maxPitchDeg),
  }
}

/**
 * Área visitable del sector: la caja que contiene todos los objetos y puntos de interés, con un
 * margen. Así el vuelo abarca todo el sector y nada queda fuera de alcance.
 */
export function sectorBounds(objects: readonly SceneObject[], points: readonly Waypoint[], margin = 170): Bounds {
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
    radius: (o.kind === 'station' ? Math.max(o.radius, (o.length ?? 0) / 2 + (o.handle?.length ?? 0) / 2) : o.radius) * 1.02 + FLIGHT.clearance,
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

/**
 * Como nearestNamed, pero se queda con el objeto anterior mientras no haya otro claramente más cerca
 * (`margin` unidades). Sin esto, entre dos objetos a distancia parecida el HUD cambia de uno a otro
 * varias veces por segundo y la ficha salta.
 */
export function stickyNearest(
  p: Vec3,
  objects: readonly SceneObject[],
  previousId: string | null | undefined,
  margin = 15,
): { object: SceneObject; distance: number } | undefined {
  const best = nearestNamed(p, objects)
  if (!best || !previousId || best.object.id === previousId) return best
  const prev = objects.find((o) => o.id === previousId && o.label)
  if (!prev) return best
  const extent = Math.max(prev.radius, (prev.length ?? 0) / 2)
  const d = Math.max(0, Math.hypot(p[0] - prev.position[0], p[1] - prev.position[1], p[2] - prev.position[2]) - extent)
  return d <= best.distance + margin ? { object: prev, distance: d } : best
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
