import { describe, expect, it } from 'vitest'
import beta from '../sectors/beta'
import {
  attitudeOf,
  boundaryProximity,
  FLIGHT,
  forwardOf,
  initialFlight,
  nearestNamed,
  NO_INPUT,
  obstaclesOf,
  sectorBounds,
  spawnBehind,
  speedOf,
  stepFlight,
  type Bounds,
  type FlightInput,
  type FlightState,
} from './flight'
import { altitude01, boundsRect, headingDeg, toMap } from './minimap'

const BIG: Bounds = { min: [-1000, -1000, -1000], max: [1000, 1000, 1000] }
const run = (s: FlightState, input: FlightInput, seconds: number, b = BIG, obs: Parameters<typeof stepFlight>[4] = []) => {
  for (let t = 0; t < seconds; t += 1 / 60) s = stepFlight(s, input, 1 / 60, b, obs)
  return s
}

describe('vuelo libre', () => {
  it('con rumbo 0 avanza hacia -Z y no supera la velocidad máxima', () => {
    const s = run(initialFlight([0, 0, 0]), { thrust: 1, turn: 0, lift: 0 }, 10)
    expect(s.position[2]).toBeLessThan(-100)
    expect(Math.abs(s.position[0])).toBeLessThan(1e-6)
    expect(speedOf(s)).toBeLessThanOrEqual(FLIGHT.maxSpeed + 1e-9)
    expect(speedOf(s)).toBeGreaterThan(FLIGHT.maxSpeed * 0.95)
  })

  it('sin empuje se frena sola; frenar es más rápido que soltar', () => {
    const fast = run(initialFlight([0, 0, 0]), { thrust: 1, turn: 0, lift: 0 }, 6)
    const coast = run(fast, NO_INPUT, 1)
    const brake = run(fast, { thrust: -1, turn: 0, lift: 0 }, 1)
    expect(speedOf(coast)).toBeLessThan(speedOf(fast))
    expect(speedOf(brake)).toBeLessThan(speedOf(coast))
    expect(speedOf(run(fast, NO_INPUT, 20))).toBeLessThan(1)
  })

  it('marcha atrás con velocidad limitada', () => {
    const s = run(initialFlight([0, 0, 0]), { thrust: -1, turn: 0, lift: 0 }, 10)
    expect(s.position[2]).toBeGreaterThan(0)
    expect(speedOf(s)).toBeLessThanOrEqual(FLIGHT.maxReverse + 1e-9)
  })

  it('girar a la izquierda aumenta el rumbo, con velocidad de giro acotada, y la nave se alabea', () => {
    const s = run(initialFlight([0, 0, 0]), { thrust: 1, turn: 1, lift: 0 }, 1)
    expect(s.yaw).toBeGreaterThan(0)
    expect(s.yawRate).toBeLessThanOrEqual(FLIGHT.maxYawRate + 1e-9)
    expect(attitudeOf(s).bankDeg).toBeGreaterThan(0)
    const r = run(initialFlight([0, 0, 0]), { thrust: 1, turn: -1, lift: 0 }, 1)
    expect(r.yaw).toBeLessThan(0)
    expect(attitudeOf(r).bankDeg).toBeLessThan(0)
  })

  it('la nave sigue su morro: tras girar 90° avanza hacia el nuevo rumbo sin derrapar', () => {
    let s = run(initialFlight([0, 0, 0]), { thrust: 1, turn: 0, lift: 0 }, 4)
    s = run(s, { thrust: 1, turn: 1, lift: 0 }, Math.PI / 2 / FLIGHT.maxYawRate + 0.3)
    s = run(s, { thrust: 1, turn: 0, lift: 0 }, 2)
    const f = forwardOf(s.yaw)
    const v = s.velocity
    const cos = (v[0] * f[0] + v[2] * f[2]) / Math.hypot(v[0], v[2])
    expect(cos).toBeGreaterThan(0.99)
  })

  it('sube y baja con velocidad vertical limitada; el cabeceo visual acompaña', () => {
    const up = run(initialFlight([0, 0, 0]), { thrust: 0, turn: 0, lift: 1 }, 3)
    expect(up.position[1]).toBeGreaterThan(10)
    expect(Math.abs(up.velocity[1])).toBeLessThanOrEqual(FLIGHT.maxClimb + 1e-9)
    expect(attitudeOf(up).pitchDeg).toBeGreaterThan(0)
    const down = run(initialFlight([0, 0, 0]), { thrust: 0, turn: 0, lift: -1 }, 3)
    expect(down.position[1]).toBeLessThan(-10)
  })

  it('nunca sale del área visitable aunque empuje contra el borde', () => {
    const b: Bounds = { min: [-50, -20, -50], max: [50, 20, 50] }
    let s = initialFlight([0, 0, 0])
    for (const input of [
      { thrust: 1, turn: 0, lift: 1 },
      { thrust: 1, turn: 0.3, lift: -1 },
      { thrust: -1, turn: -0.5, lift: 1 },
    ]) {
      for (let t = 0; t < 30; t += 1 / 60) {
        s = stepFlight(s, input, 1 / 60, b)
        for (let i = 0; i < 3; i++) {
          expect(s.position[i]).toBeGreaterThanOrEqual(b.min[i]!)
          expect(s.position[i]).toBeLessThanOrEqual(b.max[i]!)
        }
      }
    }
  })

  it('no atraviesa obstáculos: se desliza por su borde', () => {
    const obs = [{ id: 'p', center: [0, 0, -60] as const, radius: 20 }]
    let s = initialFlight([0, 0, 0])
    for (let t = 0; t < 15; t += 1 / 60) {
      s = stepFlight(s, { thrust: 1, turn: 0, lift: 0 }, 1 / 60, BIG, obs)
      expect(Math.hypot(s.position[0], s.position[1], s.position[2] + 60)).toBeGreaterThanOrEqual(20 - 1e-6)
    }
  })

  it('un obstáculo pegado al borde no puede empujar la nave fuera del área', () => {
    const b: Bounds = { min: [-50, -50, -50], max: [50, 50, 50] }
    const s = stepFlight(initialFlight([49, 0, 0]), NO_INPUT, 1 / 60, b, [{ id: 'x', center: [45, 0, 0], radius: 20 }])
    expect(s.position[0]).toBeLessThanOrEqual(50)
  })

  it('pasos no válidos o enormes no rompen el estado', () => {
    const s = initialFlight([1, 2, 3])
    expect(stepFlight(s, { thrust: 1, turn: 0, lift: 0 }, 0, BIG)).toBe(s)
    expect(stepFlight(s, { thrust: 1, turn: 0, lift: 0 }, Number.NaN, BIG)).toBe(s)
    const big = stepFlight(s, { thrust: Number.NaN, turn: 5, lift: -Infinity }, 10, BIG)
    expect(big.position.every(Number.isFinite)).toBe(true)
    // dt se acota a 0,1 s: un paso de 10 s avanza como uno de 0,1 s.
    expect(stepFlight(s, { thrust: 1, turn: 0, lift: 0 }, 10, BIG)).toEqual(stepFlight(s, { thrust: 1, turn: 0, lift: 0 }, 0.1, BIG))
  })

  it('es determinista', () => {
    const a = run(initialFlight([0, 0, 0]), { thrust: 0.7, turn: 0.4, lift: 0.2 }, 5)
    const b = run(initialFlight([0, 0, 0]), { thrust: 0.7, turn: 0.4, lift: 0.2 }, 5)
    expect(a).toEqual(b)
  })
})

describe('el sector β como área de vuelo', () => {
  const scene = beta.scene!
  const b = sectorBounds(scene.objects, scene.waypoints)
  const obs = obstaclesOf(scene.objects)

  it('el área contiene todos los objetos completos y el punto de salida', () => {
    for (const o of scene.objects) {
      for (let i = 0; i < 3; i++) {
        expect(o.position[i]! - o.radius).toBeGreaterThan(b.min[i]!)
        expect(o.position[i]! + o.radius).toBeLessThan(b.max[i]!)
      }
    }
  })

  it('cada objeto con nombre es alcanzable: hay sitio libre a su alrededor dentro del área', () => {
    for (const o of scene.objects.filter((x) => x.label)) {
      const ob = obs.find((x) => x.id === o.id)!
      const spot: [number, number, number] = [o.position[0], o.position[1], o.position[2] + ob.radius + 5]
      for (let i = 0; i < 3; i++) {
        expect(spot[i]).toBeGreaterThanOrEqual(b.min[i]!)
        expect(spot[i]).toBeLessThanOrEqual(b.max[i]!)
      }
    }
  })

  it('el punto de salida no está dentro de ningún obstáculo', () => {
    const start = scene.waypoints.find((w) => w.id === scene.startId)!.position
    for (const o of obs) expect(Math.hypot(start[0] - o.center[0], start[1] - o.center[1], start[2] - o.center[2])).toBeGreaterThan(o.radius)
  })

  it('nearestNamed mide la estación por su largo, no solo por su radio', () => {
    const st = scene.objects.find((o) => o.kind === 'station')!
    const beside: [number, number, number] = [st.position[0] + (st.length ?? 0) / 2 + 1, st.position[1], st.position[2]]
    expect(nearestNamed(beside, scene.objects)!.object.id).toBe(st.id)
  })

  it('nearestNamed y boundaryProximity', () => {
    const near = nearestNamed([0, 0, 0], scene.objects)!
    expect(near.object.label).toBeTruthy()
    expect(near.distance).toBeGreaterThan(0)
    expect(boundaryProximity([0, 0, 0], b)).toBe(0)
    expect(boundaryProximity([b.max[0], 0, 0], b)).toBe(1)
  })
})

describe('spawnBehind', () => {
  it('con rumbo 0, la nave queda delante y debajo del punto (igual que antes)', () => {
    expect(spawnBehind([0, 0, 0], 0, 2.5, 8).position).toEqual([0, -2.5, -8])
  })
  it('con otro rumbo, la nave queda delante del punto en esa dirección', () => {
    const s = spawnBehind([10, 5, -40], 90, 2.5, 8) // 90° = mira a -X
    expect(s.position[0]).toBeCloseTo(2)
    expect(s.position[1]).toBeCloseTo(2.5)
    expect(s.position[2]).toBeCloseTo(-40)
    expect(s.yaw).toBeCloseTo(Math.PI / 2)
  })
})

describe('minimapa', () => {
  const frame = { size: 200, padding: 10, bounds: { min: [-100, -10, -300], max: [100, 10, 0] } as Bounds }

  it('el área ocupa el mapa conservando la proporción y adelante queda arriba', () => {
    const r = boundsRect(frame)
    expect(r.h).toBeCloseTo(180)
    expect(r.w).toBeCloseTo(120)
    expect(toMap([0, 0, -300], frame).y).toBeLessThan(toMap([0, 0, 0], frame).y)
    expect(toMap([-100, 0, 0], frame).x).toBeLessThan(toMap([100, 0, 0], frame).x)
  })

  it('altura y rumbo', () => {
    expect(altitude01([0, -10, 0], frame.bounds)).toBe(0)
    expect(altitude01([0, 10, 0], frame.bounds)).toBe(1)
    expect(headingDeg(0)).toBeCloseTo(0)
    expect(headingDeg(Math.PI / 2)).toBeCloseTo(-90) // izquierda
  })
})
