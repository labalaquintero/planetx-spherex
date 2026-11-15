import type { Vec3 } from './types'

/**
 * Visitantes ocasionales del sector: cometas (lentos, con cola) y meteoritos (rápidos, pequeños).
 * Lógica pura y determinista: aparecen de vez en cuando desde lejos, cruzan cerca de la nave y a
 * veces vienen directos hacia ella; si la alcanzan producen un impacto (la nave se recupera sola).
 */
export type VisitorKind = 'comet' | 'meteor'

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
}

export interface VisitorState {
  readonly t: number
  readonly nextComet: number
  readonly nextMeteor: number
  readonly seq: number
  readonly rng: number
  readonly active: readonly Visitor[]
}

export type VisitorEvent =
  | { readonly type: 'spawn'; readonly kind: VisitorKind; readonly id: number }
  | { readonly type: 'impact'; readonly kind: VisitorKind; readonly id: number; readonly dir: Vec3; readonly strength: number }
  | { readonly type: 'gone'; readonly id: number }

export const VISITORS = {
  comet: { firstAt: 9, minGap: 35, maxGap: 60, speed: 40, radius: 1.8, spawnDist: 340, aimChance: 0.35, strength: 1 },
  meteor: { firstAt: 18, minGap: 12, maxGap: 22, speed: 85, radius: 0.7, spawnDist: 260, aimChance: 0.35, strength: 0.55 },
  /** Radio de la nave para el choque. */
  shipRadius: 2.6,
} as const

/** Generador determinista (LCG) con el estado dentro del propio estado. */
function next(rng: number): [number, number] {
  const n = (Math.imul(rng, 1664525) + 1013904223) >>> 0
  return [n, n / 4294967296]
}

export function initialVisitors(seed = 2026): VisitorState {
  return { t: 0, nextComet: VISITORS.comet.firstAt, nextMeteor: VISITORS.meteor.firstAt, seq: 0, rng: seed >>> 0, active: [] }
}

/** Distancia mínima entre el segmento p0→p1 y el punto c (para objetos rápidos que «saltan» la nave). */
export function segmentPointDistance(p0: Vec3, p1: Vec3, c: Vec3): number {
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]
  const w = [c[0] - p0[0], c[1] - p0[1], c[2] - p0[2]]
  const len2 = d[0]! * d[0]! + d[1]! * d[1]! + d[2]! * d[2]!
  const t = len2 > 0 ? Math.min(1, Math.max(0, (w[0]! * d[0]! + w[1]! * d[1]! + w[2]! * d[2]!) / len2)) : 0
  return Math.hypot(w[0]! - d[0]! * t, w[1]! - d[1]! * t, w[2]! - d[2]! * t)
}

/**
 * Crea un visitante que se ve desde la nave (`heading` = rumbo en radianes, convención de
 * `forwardOf`). Si `aim`, entra por delante (hasta ±35°) directo hacia la nave. Si no, cruza la vista
 * de lado a lado por un punto situado delante de la nave.
 */
export function spawnVisitor(kind: VisitorKind, id: number, ship: Vec3, r: readonly number[], aim: boolean, heading = 0): Visitor {
  const cfg = VISITORS[kind]
  const side = r[0]! < 0.5 ? -1 : 1
  const spread = Math.abs(r[0]! - 0.5) * 2
  const fwd: Vec3 = [-Math.sin(heading), 0, -Math.cos(heading)]
  // Punto por el que pasa: la nave, o un punto por delante de ella.
  const ahead = aim ? 0 : 60 + r[2]! * 70
  const target: Vec3 = [ship[0] + fwd[0] * ahead, ship[1] + (r[3]! - 0.5) * (aim ? 0.6 : 24), ship[2] + fwd[2] * ahead]
  // Dirección de entrada vista desde ese punto: de frente si viene directo, de lado si cruza.
  const yaw = heading + side * (aim ? spread * 0.6 : 0.9 + spread * 0.85)
  const el = (r[1]! - 0.5) * (aim ? 0.4 : 0.3)
  const dir: Vec3 = [-Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el)]
  const start: Vec3 = [target[0] + dir[0] * cfg.spawnDist, target[1] + dir[1] * cfg.spawnDist, target[2] + dir[2] * cfg.spawnDist]
  const velocity: Vec3 = [-dir[0] * cfg.speed, -dir[1] * cfg.speed, -dir[2] * cfg.speed]
  return { id, kind, position: start, velocity, radius: cfg.radius, age: 0, life: (2 * cfg.spawnDist) / cfg.speed, hit: false }
}

/** Avanza el tiempo: aparecen, se mueven, golpean y se van. dt en segundos (acotado a 0,1 s). */
export function stepVisitors(s: VisitorState, dtIn: number, ship: Vec3, heading = 0): { state: VisitorState; events: VisitorEvent[] } {
  if (!(dtIn > 0)) return { state: s, events: [] }
  const dt = Math.min(dtIn, 0.1)
  const events: VisitorEvent[] = []
  let { rng, seq, nextComet, nextMeteor } = s
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
  for (const kind of ['comet', 'meteor'] as const) {
    const due = kind === 'comet' ? nextComet : nextMeteor
    if (t < due) continue
    const cfg = VISITORS[kind]
    const r = draw(6)
    seq += 1
    born.push(spawnVisitor(kind, seq, ship, r, r[4]! < cfg.aimChance, heading))
    events.push({ type: 'spawn', kind, id: seq })
    const gap = cfg.minGap + r[5]! * (cfg.maxGap - cfg.minGap)
    if (kind === 'comet') nextComet = t + gap
    else nextMeteor = t + gap
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
  return { state: { t, nextComet, nextMeteor, seq, rng, active }, events }
}
