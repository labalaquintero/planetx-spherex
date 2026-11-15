import { FLIGHT, forwardOf, initialFlight, speedOf, type FlightInput, type FlightState, type Obstacle } from './flight'
import type { SceneObject, Vec3 } from './types'

/**
 * Atravesar un planeta gaseoso (lógica pura y probada). En vuelo normal el planeta es sólido; si la nave
 * va con turbo directo hacia él (como para estrellarse), se dispara una secuencia de unos segundos en la
 * que lo cruza en línea recta y sale por el otro lado. La vista (cámara, nubes, destellos) vive en scene/.
 */
export const DIVE = {
  /** Duración total de la secuencia (s). */
  seconds: 6,
  /** Se dispara a esta distancia de la superficie: el mayor entre el mínimo y una fracción del radio. */
  triggerGap: 55,
  triggerFraction: 1.2,
  /** Solo con turbo y ya rápido (fracción de la velocidad máxima normal). */
  minSpeed: 1.1,
  /** El rayo de la nave tiene que entrar en el planeta (no rozarlo): radio útil del disparo. */
  aimFraction: 0.85,
  /** Fracciones del tiempo en que la nave entra y sale de la superficie. */
  enterAt: 0.22,
  exitAt: 0.66,
  /** Velocidad con la que sale (la del turbo). */
  exitSpeed: FLIGHT.maxSpeed * FLIGHT.boostFactor,
  /** Holgura extra al terminar, fuera de cualquier obstáculo y de su zona de frenado. */
  exitClear: 6,
  /** Relámpagos dentro del planeta (fracciones de la secuencia): los comparten la imagen y el sonido. */
  flashes: [0.34, 0.47, 0.6],
} as const

export interface DivePlan {
  readonly id: string
  readonly label: string
  readonly center: Vec3
  readonly radius: number
  /** Punto de partida y dirección (unitaria) de la recta que cruza el planeta. */
  readonly start: Vec3
  readonly dir: Vec3
  /** Distancias a lo largo de la recta: entra en la superficie, sale y punto final. */
  readonly tEnter: number
  readonly tExit: number
  readonly tEnd: number
  readonly yaw: number
  readonly pitch: number
}

export function canCross(o: SceneObject): boolean {
  return Boolean(o.crossable && o.label)
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const along = (p: Vec3, d: Vec3, t: number): Vec3 => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t]
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Cortes de la recta p + d·t (d unitaria) con la esfera (c, r), o null si no la toca. */
export function raySphere(p: Vec3, d: Vec3, c: Vec3, r: number): [number, number] | null {
  const oc = sub(p, c)
  const b = dot(oc, d)
  const disc = b * b - (dot(oc, oc) - r * r)
  if (disc < 0) return null
  const k = Math.sqrt(disc)
  return [-b - k, -b + k]
}

/** Zona libre de un obstáculo: su radio más la zona de frenado suave y una holgura. */
function clearRadius(o: Obstacle): number {
  return o.radius + Math.max(FLIGHT.softMin, o.radius * FLIGHT.softFraction) + DIVE.exitClear
}

/**
 * ¿Empieza ahora una travesía? Solo con turbo, acelerando, rápido, cerca de un planeta atravesable y con el
 * morro apuntando a él. Devuelve el plan con el punto de salida ya libre de todos los obstáculos.
 */
export function diveTrigger(
  s: FlightState,
  input: FlightInput,
  objects: readonly SceneObject[],
  obstacles: readonly Obstacle[],
): DivePlan | null {
  if (!input.boost || !(input.thrust > 0)) return null
  if (speedOf(s) < FLIGHT.maxSpeed * DIVE.minSpeed) return null
  const dir = forwardOf(s.yaw, s.pitch)
  for (const o of objects) {
    if (!canCross(o)) continue
    const gap = dist(s.position, o.position) - o.radius
    if (gap < 0 || gap > Math.max(DIVE.triggerGap, o.radius * DIVE.triggerFraction)) continue
    // El morro tiene que meterse de verdad en el planeta, no pasar rozando.
    const aim = raySphere(s.position, dir, o.position, o.radius * DIVE.aimFraction)
    if (!aim || aim[0] <= 0) continue
    const hit = raySphere(s.position, dir, o.position, o.radius)!
    const tEnter = Math.max(0, hit[0])
    const tExit = hit[1]
    // Punto final: el primero, a partir de la salida, libre de todos los obstáculos (también de las lunas).
    let tEnd = tExit + 10
    for (let i = 0; i < 400; i++) {
      const p = along(s.position, dir, tEnd)
      if (obstacles.every((ob) => dist(p, ob.center) >= clearRadius(ob))) break
      tEnd += 2
    }
    return {
      id: o.id,
      label: o.label!,
      center: o.position,
      radius: o.radius,
      start: s.position,
      dir,
      tEnter,
      tExit,
      tEnd,
      yaw: s.yaw,
      pitch: s.pitch,
    }
  }
  return null
}

/** Interpolación cúbica monótona (Fritsch–Carlson) por los puntos (xs, ys) crecientes. */
function monotone(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length
  if (x <= xs[0]!) return ys[0]!
  if (x >= xs[n - 1]!) return ys[n - 1]!
  const h = xs.map((v, i) => (i < n - 1 ? xs[i + 1]! - v : 0))
  const dlt = ys.map((v, i) => (i < n - 1 ? (ys[i + 1]! - v) / h[i]! : 0))
  const m = xs.map((_, i) => {
    if (i === 0) return dlt[0]!
    if (i === n - 1) return dlt[n - 2]!
    const a = dlt[i - 1]!
    const b = dlt[i]!
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b) // media armónica: nunca se pasa ni retrocede
  })
  let i = 0
  while (x > xs[i + 1]!) i++
  const t = (x - xs[i]!) / h[i]!
  const t2 = t * t
  const t3 = t2 * t
  return (
    (2 * t3 - 3 * t2 + 1) * ys[i]! +
    (t3 - 2 * t2 + t) * h[i]! * m[i]! +
    (-2 * t3 + 3 * t2) * ys[i + 1]! +
    (t3 - t2) * h[i]! * m[i + 1]!
  )
}

export type DivePhase = 'approach' | 'inside' | 'exit'

export interface DiveFrame {
  /** Progreso 0..1 de la secuencia. */
  readonly u: number
  readonly phase: DivePhase
  readonly position: Vec3
  /** Distancia recorrida a lo largo de la recta. */
  readonly s: number
  /** Cuánto está dentro del planeta (0 fuera, 1 en lo más hondo). */
  readonly depth: number
  readonly done: boolean
}

/** Estado de la secuencia a los `t` segundos de empezar. */
export function diveFrame(plan: DivePlan, t: number): DiveFrame {
  const u = Math.min(1, Math.max(0, t / DIVE.seconds))
  const s = monotone([0, DIVE.enterAt, DIVE.exitAt, 1], [0, plan.tEnter, plan.tExit, plan.tEnd], u)
  const position = along(plan.start, plan.dir, s)
  const r = dist(position, plan.center) / plan.radius
  const depth = Math.min(1, Math.max(0, (1.02 - r) / 0.5))
  const phase: DivePhase = u < DIVE.enterAt ? 'approach' : u < DIVE.exitAt ? 'inside' : 'exit'
  return { u, phase, position, s, depth, done: u >= 1 }
}

/** Estado de vuelo al terminar: al otro lado, con el mismo rumbo y a velocidad de turbo. */
export function diveExit(plan: DivePlan, s: FlightState): FlightState {
  const p = along(plan.start, plan.dir, plan.tEnd)
  const v: Vec3 = [plan.dir[0] * DIVE.exitSpeed, plan.dir[1] * DIVE.exitSpeed, plan.dir[2] * DIVE.exitSpeed]
  return { ...s, position: p, velocity: v, yaw: plan.yaw, pitch: plan.pitch, yawRate: 0, contact: 0, jolt: 0 }
}

/**
 * Nave alineada con un planeta: a `gap` de su superficie, del lado `from` (dirección unitaria desde el centro),
 * mirando a su centro y a velocidad `speed`. Para ?atravesar=<id> (demo y capturas) y para las pruebas.
 */
export function lineUp(o: SceneObject, gap: number, from: Vec3 = [0, 0, 1], speed = 0): FlightState {
  const r = o.radius + gap
  const pos: Vec3 = [o.position[0] + from[0] * r, o.position[1] + from[1] * r, o.position[2] + from[2] * r]
  const d = sub(o.position, pos)
  const len = Math.hypot(...d)
  const pitch = Math.asin(d[1] / len)
  const yaw = Math.atan2(-d[0], -d[2])
  const f = forwardOf(yaw, pitch)
  return { ...initialFlight(pos, yaw), pitch, velocity: [f[0] * speed, f[1] * speed, f[2] * speed] }
}
