import { describe, expect, it } from 'vitest'
import beta from '../sectors/beta'
import { canCross, DIVE, diveExit, diveFrame, diveTrigger, lineUp, raySphere } from './dive'
import { FLIGHT, obstaclesOf, type FlightInput, type FlightState } from './flight'
import type { SceneObject, Vec3 } from './types'

const objects = beta.scene!.objects
const obstacles = obstaclesOf(objects)
const byId = (id: string) => objects.find((o) => o.id === id)!
const TURBO: FlightInput = { thrust: 1, turn: 0, lift: 0, boost: true }
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

const aimedAt = (o: SceneObject, gap: number, from: Vec3 = [0, 0, 1], speed = FLIGHT.maxSpeed * FLIGHT.boostFactor): FlightState =>
  lineUp(o, gap, from, speed)

describe('atravesar planetas gaseosos', () => {
  it('solo dos planetas de β son atravesables: Cobalto y Calder', () => {
    expect(objects.filter(canCross).map((o) => o.id).sort()).toEqual(['calder', 'cobalto'])
  })

  it('con turbo, rápido y directo hacia el planeta, empieza la travesía', () => {
    const plan = diveTrigger(aimedAt(byId('cobalto'), 20), TURBO, objects, obstacles)
    expect(plan?.id).toBe('cobalto')
    expect(plan!.tExit).toBeGreaterThan(plan!.tEnter)
    expect(plan!.tEnd).toBeGreaterThan(plan!.tExit)
  })

  it('sin turbo, despacio, lejos o apuntando fuera, no pasa nada (el planeta sigue siendo sólido)', () => {
    const c = byId('cobalto')
    expect(diveTrigger(aimedAt(c, 20), { ...TURBO, boost: false }, objects, obstacles)).toBeNull()
    expect(diveTrigger(aimedAt(c, 20, [0, 0, 1], FLIGHT.maxSpeed * 0.5), TURBO, objects, obstacles)).toBeNull()
    expect(diveTrigger(aimedAt(c, 200), TURBO, objects, obstacles)).toBeNull()
    const away = aimedAt(c, 20)
    expect(diveTrigger({ ...away, yaw: away.yaw + Math.PI }, TURBO, objects, obstacles)).toBeNull()
  })

  it('los demás planetas, aunque sean de bandas, no se atraviesan', () => {
    for (const id of ['franjas', 'orun', 'argento', 'ilmara']) {
      expect(diveTrigger(aimedAt(byId(id), 10), TURBO, objects, obstacles), id).toBeNull()
    }
  })

  it('termina al otro lado, fuera de todos los obstáculos y de su zona de frenado (también lejos de Sora)', () => {
    for (const id of ['cobalto', 'calder']) {
      const o = byId(id)
      // Desde varios lados, incluido el que deja a la luna Sora detrás de Calder.
      const sora = byId('sora').position
      const toSora: Vec3 = [o.position[0] - sora[0], o.position[1] - sora[1], o.position[2] - sora[2]]
      const n = Math.hypot(...toSora)
      for (const from of [[0, 0, 1], [1, 0, 0], [0, 1, 0], [toSora[0] / n, toSora[1] / n, toSora[2] / n]] as Vec3[]) {
        const plan = diveTrigger(aimedAt(o, 15, from), TURBO, objects, obstacles)
        expect(plan, `${id} desde ${from}`).not.toBeNull()
        const end = diveExit(plan!, aimedAt(o, 15, from)).position
        for (const ob of obstacles) {
          const soft = Math.max(FLIGHT.softMin, ob.radius * FLIGHT.softFraction)
          expect(dist(end, ob.center), `${id} → ${ob.id}`).toBeGreaterThanOrEqual(ob.radius + soft)
        }
      }
    }
  })

  it('la secuencia dura entre 5 y 7 s, avanza sin retroceder y pasa por dentro del planeta', () => {
    expect(DIVE.seconds).toBeGreaterThanOrEqual(5)
    expect(DIVE.seconds).toBeLessThanOrEqual(7)
    const plan = diveTrigger(aimedAt(byId('cobalto'), 20), TURBO, objects, obstacles)!
    let prev = -Infinity
    let deepest = 0
    for (let t = 0; t <= DIVE.seconds; t += 0.05) {
      const f = diveFrame(plan, t)
      expect(f.s).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = f.s
      deepest = Math.max(deepest, f.depth)
    }
    expect(deepest).toBeGreaterThan(0.9)
    expect(diveFrame(plan, 0).depth).toBe(0)
    expect(diveFrame(plan, 0).phase).toBe('approach')
    expect(diveFrame(plan, DIVE.seconds * 0.5).phase).toBe('inside')
    expect(diveFrame(plan, DIVE.seconds).done).toBe(true)
    expect(diveFrame(plan, DIVE.seconds).depth).toBe(0)
  })

  it('al salir sigue con el mismo rumbo, a velocidad de turbo y sin sacudidas', () => {
    const s = aimedAt(byId('calder'), 15)
    const plan = diveTrigger(s, TURBO, objects, obstacles)!
    const out = diveExit(plan, { ...s, jolt: 0.8, contact: 0.5 })
    expect(Math.hypot(...out.velocity)).toBeCloseTo(DIVE.exitSpeed)
    expect(out.yaw).toBe(s.yaw)
    expect(out.jolt).toBe(0)
    expect(out.contact).toBe(0)
  })

  it('raySphere encuentra los cortes de una recta con una esfera', () => {
    expect(raySphere([0, 0, 10], [0, 0, -1], [0, 0, 0], 2)).toEqual([8, 12])
    expect(raySphere([5, 0, 10], [0, 0, -1], [0, 0, 0], 2)).toBeNull()
  })
})
