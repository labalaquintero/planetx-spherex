import { describe, expect, it } from 'vitest'
import beta from '../sectors/beta'
import { thrust } from './motion'
import { distanceToRoute, distanceToSegment, scatterBodies } from './scatter'

const scene = beta.scene!

describe('distanceToSegment', () => {
  it('mide al punto más cercano del segmento, también en los extremos', () => {
    expect(distanceToSegment([0, 1, 0], [-1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
    expect(distanceToSegment([3, 0, 0], [-1, 0, 0], [1, 0, 0])).toBeCloseTo(2)
    expect(distanceToSegment([0, 2, 0], [0, 0, 0], [0, 0, 0])).toBeCloseTo(2)
  })
})

describe('scatterBodies (relleno de β)', () => {
  const field = scene.field!

  it('β tiene relleno de cuerpos pequeños', () => {
    expect(field.count).toBeGreaterThan(20)
  })

  it('es determinista y bajar la cantidad solo quita cuerpos del final', () => {
    const a = scatterBodies(field, scene.waypoints, scene.objects, 60)
    const b = scatterBodies(field, scene.waypoints, scene.objects, 60)
    const c = scatterBodies(field, scene.waypoints, scene.objects, 20)
    expect(a).toEqual(b)
    expect(c).toEqual(a.slice(0, 20))
    expect(scatterBodies(field, scene.waypoints, scene.objects, field.count)).toHaveLength(field.count)
  })

  it('respeta la distancia libre a la ruta (la nave nunca atraviesa un cuerpo)', () => {
    for (const body of scatterBodies(field, scene.waypoints, scene.objects, field.count)) {
      expect(distanceToRoute(body.position, scene.waypoints)).toBeGreaterThanOrEqual(field.clearance + body.radius)
    }
  })

  it('no cae dentro de los planetas, sus anillos ni la estación', () => {
    const bodies = scatterBodies(field, scene.waypoints, scene.objects, field.count)
    for (const body of bodies) {
      for (const o of scene.objects.filter((x) => x.kind !== 'smallBody')) {
        const d = Math.hypot(...([0, 1, 2].map((i) => body.position[i]! - o.position[i]!) as [number, number, number]))
        expect(d).toBeGreaterThan(o.radius * (o.ring?.outer ?? 1) + body.radius)
      }
    }
  })

  it('nunca devuelve más de lo pedido ni más que count; 0 da lista vacía', () => {
    expect(scatterBodies(field, scene.waypoints, scene.objects, 10_000).length).toBeLessThanOrEqual(field.count)
    expect(scatterBodies(field, scene.waypoints, scene.objects, 0)).toEqual([])
  })

  it('radios dentro del rango y variantes válidas', () => {
    for (const b of scatterBodies(field, scene.waypoints, scene.objects, field.count, 3)) {
      expect(b.radius).toBeGreaterThanOrEqual(field.minRadius)
      expect(b.radius).toBeLessThanOrEqual(field.maxRadius)
      expect([0, 1, 2]).toContain(b.variant)
    }
  })
})

describe('thrust', () => {
  it('ralentí en reposo; avanzar empuja más que ir de lado, y de lado más que retroceder', () => {
    expect(thrust(null, 0)).toBeCloseTo(0.3)
    expect(thrust('forward', 0.5)).toBeCloseTo(1)
    expect(thrust('forward', 0.5)).toBeGreaterThan(thrust('left', 0.5))
    expect(thrust('left', 0.5)).toBeGreaterThan(thrust('back', 0.5))
  })
  it('vuelve al ralentí al salir y al llegar', () => {
    expect(thrust('forward', 0)).toBeCloseTo(0.3)
    expect(thrust('forward', 1)).toBeCloseTo(0.3)
  })
})
