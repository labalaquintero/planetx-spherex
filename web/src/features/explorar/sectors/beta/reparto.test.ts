import { describe, expect, it } from 'vitest'
import { sectorBounds } from '../../engine/flight'
import beta from './index'
import { around, EXTRA_IDS, SKETCH_REPLACEMENTS } from './objects'

const scene = beta.scene!
const extras = scene.objects.filter((o) => EXTRA_IDS.includes(o.id) && !Object.values(SKETCH_REPLACEMENTS).includes(o.id))
const deg = (r: number) => (r * 180) / Math.PI
const azimuth = ([x, , z]: readonly number[]) => (deg(Math.atan2(x!, -z!)) + 360) % 360
const elevation = ([x, y, z]: readonly number[]) => deg(Math.atan2(y!, Math.hypot(x!, z!)))

describe('reparto de β en 360° y en altura', () => {
  it('around() coloca por rumbo, altura y distancia desde la entrada', () => {
    expect(around(0, 0, 100)).toEqual([0, 0, -100])
    expect(around(90, 0, 100)).toEqual([100, 0, 0])
    expect(around(0, 90, 100)[1]).toBe(100)
  })

  it('hay planetas en los cuatro cuadrantes alrededor de la entrada', () => {
    const quadrants = new Set(extras.map((o) => Math.floor(azimuth(o.position) / 90)))
    expect([...quadrants].sort()).toEqual([0, 1, 2, 3])
  })

  it('no es plano: hay planetas bien arriba y bien abajo', () => {
    const els = extras.map((o) => elevation(o.position))
    expect(els.filter((e) => e > 35).length).toBeGreaterThanOrEqual(3)
    expect(els.filter((e) => e < -35).length).toBeGreaterThanOrEqual(3)
    const b = sectorBounds(scene.objects, scene.waypoints)
    const height = b.max[1] - b.min[1]
    const width = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2])
    expect(height / width).toBeGreaterThan(0.45)
  })

  it('el área es amplia y ningún planeta toca a otro', () => {
    const b = sectorBounds(scene.objects, scene.waypoints)
    expect(b.max[0] - b.min[0]).toBeGreaterThan(1800)
    const bodies = scene.objects.filter((o) => o.label)
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++) {
        const [a, c] = [bodies[i]!, bodies[j]!]
        const ring = (o: typeof a) => o.radius * (o.ring?.outer ?? 1)
        const d = Math.hypot(a.position[0] - c.position[0], a.position[1] - c.position[1], a.position[2] - c.position[2])
        expect(d, `${a.id}-${c.id}`).toBeGreaterThan(ring(a) + ring(c) + 10)
      }
  })
})
