import { describe, expect, it } from 'vitest'
import { orbitOffset } from './orbit'

describe('cámara de persecución con cabeceo', () => {
  it('sin cabeceo, el desplazamiento es el de siempre', () => {
    expect(orbitOffset(2.5, 8, { yaw: 0, pitch: 0 })).toEqual([0, 2.5, 8])
  })

  it('con el morro arriba la cámara baja detrás de la nave y mantiene su distancia', () => {
    const o = orbitOffset(2.5, 8, { yaw: 0, pitch: 0.5 })
    expect(o[1]).toBeLessThan(2.5)
    expect(Math.hypot(...o)).toBeCloseTo(Math.hypot(2.5, 8), 9)
  })

  it('la cámara queda en la dirección opuesta al morro (detrás de la nave)', () => {
    const p = 0.4
    const o = orbitOffset(0, 8, { yaw: 0, pitch: p })
    // Adelante con cabeceo p: (0, sin p, -cos p); la cámara está en el sentido contrario.
    expect(o[1] / 8).toBeCloseTo(-Math.sin(p), 9)
    expect(o[2] / 8).toBeCloseTo(Math.cos(p), 9)
  })
})
