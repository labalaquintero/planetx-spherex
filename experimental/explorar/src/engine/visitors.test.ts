import { describe, expect, it } from 'vitest'
import { mulberry32 } from './random'
import type { Vec3 } from './types'
import {
  streakGrow,
  initialVisitors,
  lineDistance,
  segmentPointDistance,
  spawnVisitor,
  stepVisitors,
  visitorFade,
  VISITOR_KINDS,
  VISITORS,
  type VisitorEvent,
  type VisitorState,
} from './visitors'

const run = (s: VisitorState, seconds: number, ship: Vec3 = [0, 0, 0]) => {
  const events: VisitorEvent[] = []
  for (let t = 0; t < seconds; t += 1 / 30) {
    const r = stepVisitors(s, 1 / 30, ship)
    s = r.state
    events.push(...r.events)
  }
  return { s, events }
}

const quiet = (): VisitorState => ({ ...initialVisitors(), next: { comet: 1e9, meteor: 1e9, asteroid: 1e9 } })
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v)
  return [v[0] / l, v[1] / l, v[2] / l]
}

describe('cometas, estrellas fugaces y asteroides', () => {
  it('aparecen de vez en cuando los tres tipos', () => {
    const { events } = run(initialVisitors(), 130)
    const spawns = events.filter((e) => e.type === 'spawn')
    const count = (k: string) => spawns.filter((e) => e.kind === k).length
    expect(count('comet')).toBeGreaterThanOrEqual(2)
    expect(count('comet')).toBeLessThanOrEqual(4)
    expect(count('meteor')).toBeGreaterThanOrEqual(7)
    expect(count('asteroid')).toBeGreaterThanOrEqual(3)
    const firstComet = run(initialVisitors(), VISITORS.comet.firstAt + 0.1).events.find((e) => e.type === 'spawn' && e.kind === 'comet')
    expect(firstComet).toBeDefined()
  })

  it('es determinista con la misma semilla y cambia con otra', () => {
    expect(run(initialVisitors(7), 60).events).toEqual(run(initialVisitors(7), 60).events)
    expect(run(initialVisitors(7), 60).s.active).not.toEqual(run(initialVisitors(8), 60).s.active)
  })

  it('cada visitante se va al terminar su recorrido (no se acumulan)', () => {
    const { s, events } = run(initialVisitors(), 300)
    expect(s.active.length).toBeLessThanOrEqual(4)
    expect(events.filter((e) => e.type === 'gone').length).toBeGreaterThan(10)
  })

  it('aparecen y se apagan de forma gradual', () => {
    expect(visitorFade({ age: 0, life: 10 })).toBe(0)
    expect(visitorFade({ age: 5, life: 10 })).toBe(1)
    expect(visitorFade({ age: 10, life: 10 })).toBe(0)
    expect(visitorFade({ age: VISITORS.fadeSeconds / 2, life: 10 })).toBeCloseTo(0.5)
  })

  it('uno en rumbo de choque golpea a la nave una sola vez, con su fuerza y su dirección', () => {
    for (const kind of VISITOR_KINDS) {
      let s: VisitorState = { ...quiet(), active: [spawnVisitor(kind, 1, [0, 0, 0], [0.25, 0.5, 0, 0.5, 0, 0, 0.5, 0], true)] }
      const impacts: VisitorEvent[] = []
      for (let t = 0; t < 25; t += 1 / 30) {
        const r = stepVisitors(s, 1 / 30, [0, 0, 0])
        s = r.state
        impacts.push(...r.events.filter((e) => e.type === 'impact'))
      }
      expect(impacts, kind).toHaveLength(1)
      const hit = impacts[0]!
      if (hit.type !== 'impact') throw new Error('tipo')
      expect(hit.strength).toBe(VISITORS[kind].strength)
      expect(Math.hypot(...hit.dir)).toBeCloseTo(1)
    }
  })

  it('los que no vienen a chocar nunca pasan cerca de la nave', () => {
    const rnd = mulberry32(5)
    const ship: Vec3 = [12, -3, 40]
    for (const kind of VISITOR_KINDS) {
      for (let i = 0; i < 400; i++) {
        const r = Array.from({ length: 8 }, rnd)
        const v = spawnVisitor(kind, i, ship, r, false, rnd() * 6.28)
        const d = lineDistance(v.position, unit(v.velocity), ship)
        expect(d).toBeGreaterThanOrEqual(VISITORS.minMiss + VISITORS.shipRadius + v.radius - 1e-6)
      }
    }
  })

  it('sin rumbo de choque, no golpean aunque la nave esté quieta', () => {
    const rnd = mulberry32(11)
    for (let i = 0; i < 60; i++) {
      const r = Array.from({ length: 8 }, rnd)
      let s: VisitorState = { ...quiet(), active: [spawnVisitor('comet', 1, [0, 0, 0], r, false)] }
      let hits = 0
      for (let t = 0; t < 22; t += 1 / 30) {
        const res = stepVisitors(s, 1 / 30, [0, 0, 0])
        s = res.state
        hits += res.events.filter((e) => e.type === 'impact').length
      }
      expect(hits).toBe(0)
    }
  })

  it('aparecen por cualquier lado y van en direcciones al azar, no siempre hacia la nave', () => {
    const rnd = mulberry32(3)
    const quadrants = new Set<number>()
    const sides = new Set<string>()
    const misses: number[] = []
    for (let i = 0; i < 300; i++) {
      const r = Array.from({ length: 8 }, rnd)
      const v = spawnVisitor('meteor', i, [0, 0, 0], r, false, 0)
      const d = unit(v.velocity)
      quadrants.add(Math.floor(((Math.atan2(d[0], d[2]) + Math.PI) / (2 * Math.PI)) * 4) % 4)
      sides.add(`${Math.sign(v.position[0])},${Math.sign(v.position[2])}`)
      misses.push(lineDistance(v.position, d, [0, 0, 0]))
    }
    expect(quadrants.size).toBe(4)
    expect(sides.size).toBe(4)
    // Pasan a distancias variadas, la mayoría lejos: cruzan la vista, no van hacia la nave.
    misses.sort((a, b) => a - b)
    expect(misses[Math.floor(misses.length / 2)]!).toBeGreaterThan(90)
    expect(misses.filter((m) => m < 40).length / misses.length).toBeLessThan(0.15)
    expect(misses[misses.length - 1]! - misses[0]!).toBeGreaterThan(120)
  })

  it('los choques son ocasionales: pocos en rumbo de choque en una partida larga', () => {
    for (const kind of VISITOR_KINDS) expect(VISITORS[kind].hitChance).toBeLessThanOrEqual(0.1)
    const { events } = run(initialVisitors(99), 900)
    const spawns = events.filter((e) => e.type === 'spawn').length
    const impacts = events.filter((e) => e.type === 'impact').length
    expect(spawns).toBeGreaterThan(60)
    expect(impacts / spawns).toBeLessThan(0.12)
  })

  it('los que vienen a chocar entran por delante, para que se vean venir', () => {
    for (let i = 0; i < 20; i++) {
      const v = spawnVisitor('meteor', i, [0, 0, 0], [i / 20, 0.5, 0.5, 0.5, 0, 0, 0.5, 0], true, 0.8)
      const fwd = [-Math.sin(0.8), 0, -Math.cos(0.8)]
      const along = (v.position[0] * fwd[0]! + v.position[2] * fwd[2]!) / VISITORS.meteor.spawnDist
      expect(along).toBeGreaterThan(Math.cos(1.06))
    }
  })

  it('el choque se detecta aunque el meteoro «salte» la nave en un cuadro', () => {
    expect(segmentPointDistance([-10, 0, 0], [10, 0, 0], [0, 1, 0])).toBeCloseTo(1)
    expect(segmentPointDistance([-10, 0, 0], [-5, 0, 0], [0, 0, 0])).toBeCloseTo(5)
  })
})

describe('crecimiento de la estela', () => {
  it('nace sin largo, crece sin saltos y llega a su largo completo', () => {
    expect(streakGrow(0, 1)).toBe(0)
    expect(streakGrow(1, 1)).toBe(1)
    expect(streakGrow(5, 1)).toBe(1)
    let prev = 0
    for (let a = 0.05; a <= 1; a += 0.05) {
      const g = streakGrow(a, 1)
      expect(g).toBeGreaterThan(prev)
      expect(g - prev).toBeLessThan(0.16)
      prev = g
    }
    expect(streakGrow(0.3, 0)).toBe(1)
  })
})
