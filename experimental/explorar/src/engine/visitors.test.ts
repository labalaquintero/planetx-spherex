import { describe, expect, it } from 'vitest'
import { initialVisitors, segmentPointDistance, spawnVisitor, stepVisitors, VISITORS, type VisitorEvent, type VisitorState } from './visitors'

const run = (s: VisitorState, seconds: number, ship: [number, number, number] = [0, 0, 0]) => {
  const events: VisitorEvent[] = []
  for (let t = 0; t < seconds; t += 1 / 30) {
    const r = stepVisitors(s, 1 / 30, ship)
    s = r.state
    events.push(...r.events)
  }
  return { s, events }
}

describe('cometas y meteoritos', () => {
  it('el primer cometa aparece pronto y después llegan de vez en cuando, en ambos tipos', () => {
    const { events } = run(initialVisitors(), 130)
    const spawns = events.filter((e) => e.type === 'spawn')
    const comets = spawns.filter((e) => e.kind === 'comet').length
    const meteors = spawns.filter((e) => e.kind === 'meteor').length
    expect(comets).toBeGreaterThanOrEqual(2)
    expect(comets).toBeLessThanOrEqual(4)
    expect(meteors).toBeGreaterThanOrEqual(5)
    const firstComet = run(initialVisitors(), VISITORS.comet.firstAt + 0.1).events.find((e) => e.type === 'spawn' && e.kind === 'comet')
    expect(firstComet).toBeDefined()
  })

  it('es determinista con la misma semilla', () => {
    expect(run(initialVisitors(7), 60).events).toEqual(run(initialVisitors(7), 60).events)
  })

  it('cada visitante se va al terminar su recorrido (no se acumulan)', () => {
    const { s, events } = run(initialVisitors(), 300)
    expect(s.active.length).toBeLessThanOrEqual(4)
    expect(events.filter((e) => e.type === 'gone').length).toBeGreaterThan(5)
  })

  it('uno que viene directo golpea a la nave una sola vez, con su fuerza y su dirección', () => {
    let s: VisitorState = { ...initialVisitors(), nextComet: 1e9, nextMeteor: 1e9, active: [spawnVisitor('meteor', 1, [0, 0, 0], [0.25, 0.5, 0, 0.5], true)] }
    const impacts: VisitorEvent[] = []
    for (let t = 0; t < 8; t += 1 / 30) {
      const r = stepVisitors(s, 1 / 30, [0, 0, 0])
      s = r.state
      impacts.push(...r.events.filter((e) => e.type === 'impact'))
    }
    expect(impacts).toHaveLength(1)
    const hit = impacts[0]!
    if (hit.type !== 'impact') throw new Error('tipo')
    expect(hit.strength).toBe(VISITORS.meteor.strength)
    expect(Math.hypot(...hit.dir)).toBeCloseTo(1)
  })

  it('uno que pasa de lado no golpea', () => {
    let s: VisitorState = { ...initialVisitors(), nextComet: 1e9, nextMeteor: 1e9, active: [spawnVisitor('comet', 1, [0, 0, 0], [0.7, 0.5, 0.9, 0.5], false)] }
    let hits = 0
    for (let t = 0; t < 25; t += 1 / 30) {
      const r = stepVisitors(s, 1 / 30, [0, 0, 0])
      s = r.state
      hits += r.events.filter((e) => e.type === 'impact').length
    }
    expect(hits).toBe(0)
  })

  it('entran por delante de la nave y los que no vienen directo cruzan por delante, a la vista', () => {
    for (const heading of [0, 1.2, -2.5]) {
      const fwd = [-Math.sin(heading), 0, -Math.cos(heading)]
      for (let i = 0; i < 40; i++) {
        const r = [i / 40, ((i * 7) % 40) / 40, ((i * 13) % 40) / 40, 0.5]
        const v = spawnVisitor('comet', i, [5, 0, 5], r, false, heading)
        const rel = [v.position[0] - 5, v.position[1], v.position[2] - 5]
        expect(rel[0]! * fwd[0]! + rel[2]! * fwd[2]!).toBeGreaterThanOrEqual(0)
        // Punto de mayor acercamiento: por delante de la nave, sin tocarla.
        const sp = Math.hypot(...v.velocity)
        const d = v.velocity.map((x) => x / sp)
        const t = -(rel[0]! * d[0]! + rel[1]! * d[1]! + rel[2]! * d[2]!)
        const closest = rel.map((x, k) => x + d[k]! * t)
        expect(closest[0]! * fwd[0]! + closest[2]! * fwd[2]!).toBeGreaterThan(30)
        expect(Math.hypot(...closest)).toBeGreaterThan(30)
      }
    }
  })

  it('los que vienen directo entran por delante', () => {
    for (let i = 0; i < 20; i++) {
      const v = spawnVisitor('meteor', i, [0, 0, 0], [i / 20, 0.5, 0.5, 0.5], true, 0.8)
      const fwd = [-Math.sin(0.8), 0, -Math.cos(0.8)]
      const along = (v.position[0] * fwd[0]! + v.position[2] * fwd[2]!) / VISITORS.meteor.spawnDist
      expect(along).toBeGreaterThan(Math.cos(0.61))
    }
  })

  it('el choque se detecta aunque el meteorito «salte» la nave en un cuadro', () => {
    expect(segmentPointDistance([-10, 0, 0], [10, 0, 0], [0, 1, 0])).toBeCloseTo(1)
    expect(segmentPointDistance([-10, 0, 0], [-5, 0, 0], [0, 0, 0])).toBeCloseTo(5)
  })
})
