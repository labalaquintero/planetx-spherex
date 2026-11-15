import { describe, expect, it } from 'vitest'
import { dragLook, LOOK, newLook, orbitOffset, relaxLook } from './orbit'

describe('mirada libre (clic derecho)', () => {
  it('sin mirada, el desplazamiento es el de la cámara de persecución', () => {
    expect(orbitOffset(2.5, 8, { yaw: 0, pitch: 0 })).toEqual([0, 2.5, 8])
  })

  it('arrastrar a la derecha mira a la derecha (la cámara se va a la izquierda de la nave)', () => {
    const l = dragLook(newLook(), 100, 0)
    expect(l.yaw).toBeLessThan(0)
    expect(orbitOffset(2.5, 8, l)[0]).toBeLessThan(0)
  })

  it('arrastrar hacia arriba mira arriba: la cámara baja y mantiene su distancia a la nave', () => {
    const l = dragLook(newLook(), 0, -100)
    expect(l.pitch).toBeGreaterThan(0)
    const o = orbitOffset(2.5, 8, l)
    expect(o[1]).toBeLessThan(2.5)
    expect(Math.hypot(...o)).toBeCloseTo(Math.hypot(2.5, 8), 9)
  })

  it('la altura de la mirada está acotada; el giro horizontal da la vuelta completa', () => {
    expect(dragLook(newLook(), 0, -1e6).pitch).toBe(LOOK.maxPitch)
    expect(dragLook(newLook(), 0, 1e6).pitch).toBe(LOOK.minPitch)
    const half = dragLook(newLook(), -Math.PI / LOOK.sensitivity, 0).yaw
    expect(Math.abs(half)).toBeLessThanOrEqual(Math.PI + 1e-9)
    expect(dragLook(newLook(), Number.NaN, 0)).toEqual(newLook())
  })

  it('al soltar espera y luego vuelve sola detrás de la nave; mientras se arrastra no vuelve', () => {
    let l = { ...dragLook(newLook(), 200, -80), dragging: true }
    const held = relaxLook(l, 5000)
    expect(held).toEqual(l)
    l = { ...l, dragging: false }
    l = relaxLook(l, LOOK.holdMs - 100)
    expect(l.yaw).not.toBe(0)
    for (let t = 0; t < 10000; t += 16) l = relaxLook(l, 16)
    expect(l.yaw).toBe(0)
    expect(l.pitch).toBe(0)
  })
})
