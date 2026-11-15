import type { Vec3 } from './types'

/**
 * Visitantes ocasionales del sector: cometas (lentos, con cola), estrellas fugaces (meteoros
 * rápidos y brillantes) y asteroides pequeños que cruzan dando tumbos. Lógica pura y determinista
 * con la semilla: aparecen al azar alrededor de la nave y cruzan en cualquier dirección. Solo unos
 * pocos vienen en rumbo de choque; si alcanzan a la nave producen un impacto y la nave se recupera.
 */
export type VisitorKind = 'comet' | 'meteor' | 'asteroid'

export interface Visitor {
  readonly id: number
  readonly kind: VisitorKind
  readonly position: Vec3
  readonly velocity: Vec3
  readonly radius: number
  readonly age: number
  readonly life: number
  /** Ya golpeó a la nave (no vuelve a golpear). */
  readonly hit: boolean
  /** Variación visual (giro, forma), 0..1. */
  readonly seed: number
}

export interface VisitorState {
  readonly t: number
  readonly next: Readonly<Record<VisitorKind, number>>
  readonly seq: number
  readonly rng: number
  readonly active: readonly Visitor[]
}

export type VisitorEvent =
  | { readonly type: 'spawn'; readonly kind: VisitorKind; readonly id: number }
  | { readonly type: 'impact'; readonly kind: VisitorKind; readonly id: number; readonly dir: Vec3; readonly strength: number }
  | { readonly type: 'gone'; readonly id: number }

interface KindConfig {
  /** Segundos hasta el primero y separación entre dos seguidos (al azar entre min y max). */
  readonly firstAt: number
  readonly minGap: number
  readonly maxGap: number
  readonly speed: number
  readonly radius: readonly [number, number]
  /** Distancia desde la que entra hasta el punto por el que pasa (y la misma para salir). */
  readonly spawnDist: number
  /** Distancia a la nave del punto por el que pasa (al azar entre ambos valores). */
  readonly pass: readonly [number, number]
  /** Probabilidad de que venga en rumbo de choque. */
  readonly hitChance: number
  readonly strength: number
}

export const VISITOR_KINDS: readonly VisitorKind[] = ['comet', 'meteor', 'asteroid']

export const VISITORS: Readonly<Record<VisitorKind, KindConfig>> & {
  readonly shipRadius: number
  readonly minMiss: number
  readonly frontBias: number
  readonly fadeSeconds: number
} = {
  comet: { firstAt: 9, minGap: 35, maxGap: 60, speed: 40, radius: [1.6, 2.2], spawnDist: 380, pass: [90, 280], hitChance: 0.05, strength: 1 },
  meteor: { firstAt: 4, minGap: 7, maxGap: 16, speed: 130, radius: [0.4, 0.6], spawnDist: 320, pass: [60, 260], hitChance: 0.03, strength: 0.45 },
  asteroid: { firstAt: 16, minGap: 20, maxGap: 34, speed: 26, radius: [1.8, 3.6], spawnDist: 240, pass: [45, 180], hitChance: 0.06, strength: 0.8 },
  /** Radio de la nave para el choque. */
  shipRadius: 2.6,
  /** Los que no vienen a chocar pasan al menos a esta distancia de la nave (más los radios). */
  minMiss: 22,
  /** Fracción de los que pasan por delante de la nave (para que se vean); el resto, por cualquier lado. */
  frontBias: 0.65,
  /** Aparecen y se apagan de forma gradual durante este tiempo. */
  fadeSeconds: 1.2,
}

/** Generador determinista (LCG) con el estado dentro del propio estado. */
function next(rng: number): [number, number] {
  const n = (Math.imul(rng, 1664525) + 1013904223) >>> 0
  return [n, n / 4294967296]
}

export function initialVisitors(seed = 2026): VisitorState {
  return {
    t: 0,
    next: { comet: VISITORS.comet.firstAt, meteor: VISITORS.meteor.firstAt, asteroid: VISITORS.asteroid.firstAt },
    seq: 0,
    rng: seed >>> 0,
    active: [],
  }
}

/** Distancia mínima entre el segmento p0→p1 y el punto c (para objetos rápidos que «saltan» la nave). */
export function segmentPointDistance(p0: Vec3, p1: Vec3, c: Vec3): number {
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]
  const w = [c[0] - p0[0], c[1] - p0[1], c[2] - p0[2]]
  const len2 = d[0]! * d[0]! + d[1]! * d[1]! + d[2]! * d[2]!
  const t = len2 > 0 ? Math.min(1, Math.max(0, (w[0]! * d[0]! + w[1]! * d[1]! + w[2]! * d[2]!) / len2)) : 0
  return Math.hypot(w[0]! - d[0]! * t, w[1]! - d[1]! * t, w[2]! - d[2]! * t)
}

/** Distancia mínima de la recta (punto p, dirección unitaria d) al punto c. */
export function lineDistance(p: Vec3, d: Vec3, c: Vec3): number {
  const w = [c[0] - p[0], c[1] - p[1], c[2] - p[2]]
  const along = w[0]! * d[0] + w[1]! * d[1] + w[2]! * d[2]
  return Math.hypot(w[0]! - d[0] * along, w[1]! - d[1] * along, w[2]! - d[2] * along)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const dirOf = (yaw: number, el: number): Vec3 => [-Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el)]

/**
 * Crea un visitante a partir de 8 números al azar (0..1). `heading` es el rumbo de la nave en
 * radianes (convención de `forwardOf`).
 * - Si `aim`, viene en rumbo de choque y entra por delante (hasta ±60° del rumbo), para que se vea venir.
 * - Si no, cruza en una dirección al azar por un punto al azar alrededor de la nave (casi siempre por
 *   delante, a la vista) y nunca a menos de `minMiss` de ella.
 */
export function spawnVisitor(kind: VisitorKind, id: number, ship: Vec3, r: readonly number[], aim: boolean, heading = 0): Visitor {
  const cfg = VISITORS[kind]
  const radius = lerp(cfg.radius[0], cfg.radius[1], r[6] ?? 0.5)
  let dir: Vec3
  let pass: Vec3
  if (aim) {
    const from = dirOf(heading + (r[0]! - 0.5) * 2.1, (r[1]! - 0.5) * 0.5)
    dir = [-from[0], -from[1], -from[2]]
    pass = [ship[0], ship[1] + (r[3]! - 0.5) * 0.6, ship[2]]
  } else {
    // Rumbo al azar en cualquier dirección (algo aplanado: el sector es más ancho que alto).
    dir = dirOf(r[0]! * Math.PI * 2, (r[1]! - 0.5) * 1.0)
    // Punto de paso: a una distancia al azar; la mayoría, en la mitad delantera.
    const fwd: Vec3 = [-Math.sin(heading), 0, -Math.cos(heading)]
    const az = r[2]! * Math.PI * 2
    const el = (r[3]! - 0.5) * 0.9
    const d = lerp(cfg.pass[0], cfg.pass[1], r[4]!)
    const off = [Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d, Math.sin(az) * Math.cos(el) * d]
    const ahead = off[0]! * fwd[0] + off[2]! * fwd[2]
    if (r[5]! < VISITORS.frontBias && ahead < 0) {
      off[0] = off[0]! - 2 * ahead * fwd[0]
      off[2] = off[2]! - 2 * ahead * fwd[2]
    }
    pass = [ship[0] + off[0]!, ship[1] + off[1]!, ship[2] + off[2]!]
    // Cruzan la vista más de lado que de frente: se quita casi toda la componente del rumbo que
    // va hacia la nave o se aleja de ella (si no, desde lejos todo parece venir directo).
    const ou = [off[0]! / d, off[1]! / d, off[2]! / d]
    const radial = dir[0] * ou[0]! + dir[1] * ou[1]! + dir[2] * ou[2]!
    const crossing: Vec3 = [dir[0] - 0.8 * radial * ou[0]!, dir[1] - 0.8 * radial * ou[1]!, dir[2] - 0.8 * radial * ou[2]!]
    const cl = Math.hypot(...crossing)
    dir = [crossing[0] / cl, crossing[1] / cl, crossing[2] / cl]
    // Lo que cuenta es lo cerca que pasa la recta: si roza la nave, se aparta en perpendicular.
    const min = VISITORS.minMiss + VISITORS.shipRadius + radius
    const rel = [pass[0] - ship[0], pass[1] - ship[1], pass[2] - ship[2]]
    const along = rel[0]! * dir[0] + rel[1]! * dir[1] + rel[2]! * dir[2]
    let perp = [rel[0]! - dir[0] * along, rel[1]! - dir[1] * along, rel[2]! - dir[2] * along]
    let pl = Math.hypot(...perp)
    if (pl < min) {
      if (pl < 1e-6) {
        // Perpendicular cualquiera (el rumbo casi nunca es vertical; si lo es, se usa el eje x).
        perp = Math.hypot(dir[0], dir[2]) > 1e-3 ? [-dir[2], 0, dir[0]] : [1, 0, 0]
        pl = Math.hypot(...perp)
      }
      pass = [ship[0] + dir[0] * along + (perp[0]! / pl) * min, ship[1] + dir[1] * along + (perp[1]! / pl) * min, ship[2] + dir[2] * along + (perp[2]! / pl) * min]
    }
  }
  const start: Vec3 = [pass[0] - dir[0] * cfg.spawnDist, pass[1] - dir[1] * cfg.spawnDist, pass[2] - dir[2] * cfg.spawnDist]
  const velocity: Vec3 = [dir[0] * cfg.speed, dir[1] * cfg.speed, dir[2] * cfg.speed]
  return { id, kind, position: start, velocity, radius, age: 0, life: (2 * cfg.spawnDist) / cfg.speed, hit: false, seed: r[7] ?? 0 }
}

/** Opacidad de entrada y salida (0..1): aparecen y se apagan sin saltos. */
export function visitorFade(v: Pick<Visitor, 'age' | 'life'>): number {
  const f = VISITORS.fadeSeconds
  return Math.max(0, Math.min(1, v.age / f, (v.life - v.age) / f))
}

/** Avanza el tiempo: aparecen, se mueven, golpean y se van. dt en segundos (acotado a 0,1 s). */
export function stepVisitors(s: VisitorState, dtIn: number, ship: Vec3, heading = 0): { state: VisitorState; events: VisitorEvent[] } {
  if (!(dtIn > 0)) return { state: s, events: [] }
  const dt = Math.min(dtIn, 0.1)
  const events: VisitorEvent[] = []
  let { rng, seq } = s
  const due = { ...s.next }
  const t = s.t + dt
  const draw = (n: number) => {
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      const [nr, v] = next(rng)
      rng = nr
      out.push(v)
    }
    return out
  }
  const born: Visitor[] = []
  for (const kind of VISITOR_KINDS) {
    if (t < due[kind]) continue
    const cfg = VISITORS[kind]
    const r = draw(10)
    seq += 1
    born.push(spawnVisitor(kind, seq, ship, r, r[8]! < cfg.hitChance, heading))
    events.push({ type: 'spawn', kind, id: seq })
    due[kind] = t + cfg.minGap + r[9]! * (cfg.maxGap - cfg.minGap)
  }

  const active: Visitor[] = []
  for (const v of [...s.active, ...born]) {
    const p1: Vec3 = [v.position[0] + v.velocity[0] * dt, v.position[1] + v.velocity[1] * dt, v.position[2] + v.velocity[2] * dt]
    let hit = v.hit
    if (!hit && segmentPointDistance(v.position, p1, ship) < VISITORS.shipRadius + v.radius) {
      hit = true
      const sp = Math.hypot(...v.velocity)
      events.push({
        type: 'impact',
        kind: v.kind,
        id: v.id,
        dir: [v.velocity[0] / sp, v.velocity[1] / sp, v.velocity[2] / sp],
        strength: VISITORS[v.kind].strength,
      })
    }
    const age = v.age + dt
    if (age > v.life) {
      events.push({ type: 'gone', id: v.id })
      continue
    }
    active.push({ ...v, position: p1, age, hit })
  }
  return { state: { t, next: due, seq, rng, active }, events }
}
