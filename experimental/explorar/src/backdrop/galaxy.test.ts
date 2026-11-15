import { describe, expect, it } from 'vitest'
import { SECTORS } from '../sectors'
import { areaRadius, areaScale, areaUv, diskRadius, galaxyLayout, GALAXY, parseRgb } from './galaxy'

describe('galaxia de la selección', () => {
  for (const aspect of [16 / 9, 4 / 3, 21 / 9, 390 / 844]) {
    it(`cada sector cae dentro del disco y las regiones no se tocan (aspecto ${aspect.toFixed(2)})`, () => {
      const g = galaxyLayout(aspect)
      const areas = SECTORS.map((s) => ({ id: s.id, p: areaUv(s.selector.x, s.selector.y, aspect), r: areaRadius(s.selector.size) * areaScale(aspect) }))
      for (const a of areas) {
        expect(diskRadius(a.p, g), a.id).toBeLessThan(0.85)
        // La región cabe en la pantalla (su semieje mayor no sale por los lados).
        expect(Math.abs(a.p[0]) + a.r, a.id).toBeLessThan(aspect / 2 + 0.02)
      }
      for (let i = 0; i < areas.length; i++)
        for (let j = i + 1; j < areas.length; j++) {
          const [a, b] = [areas[i]!, areas[j]!]
          expect(Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]), `${a.id}-${b.id}`).toBeGreaterThan(a.r + b.r)
        }
    })
  }

  it('en pantallas anchas los tres sectores quedan a media distancia del núcleo (sobre los brazos)', () => {
    const g = galaxyLayout(16 / 9)
    for (const s of SECTORS) {
      const r = diskRadius(areaUv(s.selector.x, s.selector.y, 16 / 9), g)
      expect(r, s.id).toBeGreaterThan(0.25)
      expect(r, s.id).toBeLessThan(0.75)
    }
  })

  it('las regiones son cómodas de señalar y conservan el orden de tamaños del boceto', () => {
    const sorted = [...SECTORS].sort((a, b) => a.selector.size - b.selector.size)
    for (let i = 1; i < sorted.length; i++) expect(areaRadius(sorted[i]!.selector.size)).toBeGreaterThanOrEqual(areaRadius(sorted[i - 1]!.selector.size))
    // En una pantalla de 720 px de alto: al menos 110 px de ancho y 70 px de alto.
    for (const s of SECTORS) {
      expect(areaRadius(s.selector.size) * 2 * 720, s.id).toBeGreaterThan(110)
      expect(areaRadius(s.selector.size) * 2 * GALAXY.areaRatio * 720, s.id).toBeGreaterThan(70)
    }
  })

  it('en pantallas anchas las regiones no se reducen; en verticales, sí', () => {
    expect(areaScale(16 / 9)).toBe(1)
    expect(areaScale(4 / 3)).toBe(1)
    expect(areaScale(390 / 844)).toBeLessThan(0.5)
  })

  it('lee los colores de los sectores', () => {
    expect(parseRgb('rgba(56, 189, 248, 0.6)')).toEqual([56 / 255, 189 / 255, 248 / 255])
    expect(parseRgb('#fff')).toEqual([1, 1, 1])
    expect(parseRgb('#0c3a66')[2]).toBeCloseTo(0x66 / 255)
    expect(parseRgb('nada')).toHaveLength(3)
  })
})
