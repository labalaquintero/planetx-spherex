import { describe, expect, it } from 'vitest'
import { nearbyObject, nearestLabelled, validateFocus } from '../engine/nearest'
import { SECTORS, getSector } from './index'
import beta from './beta'
import { fromView } from './view'

describe('registro de sectores', () => {
  it('descubre α, β y ε en orden, con ids y órdenes únicos', () => {
    expect(SECTORS.map((s) => s.symbol)).toEqual(['α', 'β', 'ε'])
    expect(new Set(SECTORS.map((s) => s.id)).size).toBe(SECTORS.length)
    expect(new Set(SECTORS.map((s) => s.order)).size).toBe(SECTORS.length)
  })

  it('solo β es navegable por ahora; α y ε son «Próximamente»', () => {
    expect(SECTORS.filter((s) => s.scene).map((s) => s.id)).toEqual(['beta'])
    expect(getSector('alpha')?.scene).toBeUndefined()
    expect(getSector('epsilon')?.scene).toBeUndefined()
    expect(getSector('nada')).toBeUndefined()
  })

  it('las esferas de la selección caben en el campo y no se solapan', () => {
    for (const s of SECTORS) {
      expect(s.selector.x).toBeGreaterThan(5)
      expect(s.selector.x).toBeLessThan(95)
      expect(s.selector.y).toBeGreaterThan(5)
      expect(s.selector.y).toBeLessThan(90)
    }
    for (const a of SECTORS) {
      for (const b of SECTORS) {
        if (a.id >= b.id) continue
        expect(Math.hypot(a.selector.x - b.selector.x, a.selector.y - b.selector.y)).toBeGreaterThan(15)
      }
    }
  })
})

describe('objetos del sector β', () => {
  const objects = beta.scene!.objects

  it('ids únicos y solo los tipos del boceto', () => {
    expect(new Set(objects.map((o) => o.id)).size).toBe(objects.length)
    const kinds = new Set(objects.map((o) => o.kind))
    expect([...kinds].sort()).toEqual(['planet', 'ringedPlanet', 'smallBody', 'sphere', 'station'])
  })

  it('composición del boceto: 2 planetas, 1 con anillo, 1 estación, 1 esfera y varios cuerpos pequeños', () => {
    const count = (k: string) => objects.filter((o) => o.kind === k).length
    expect(count('planet')).toBe(2)
    expect(count('ringedPlanet')).toBe(1)
    expect(count('station')).toBe(1)
    expect(count('sphere')).toBe(1)
    expect(count('smallBody')).toBeGreaterThanOrEqual(4)
  })

  it('los datos específicos de cada tipo están presentes', () => {
    for (const o of objects) {
      if (o.kind === 'ringedPlanet') expect(o.ring && o.ring.outer > o.ring.inner).toBe(true)
      if (o.kind === 'station') expect(o.length).toBeGreaterThan(o.radius)
      if (o.kind === 'planet' || o.kind === 'ringedPlanet') expect(o.surface).toBeDefined()
    }
  })

  it('ningún punto de ruta queda dentro de un objeto', () => {
    for (const w of beta.scene!.waypoints) {
      for (const o of objects) {
        const d = Math.hypot(...(w.position.map((v, i) => v - o.position[i]!) as [number, number, number]))
        expect(d).toBeGreaterThan(o.radius * (o.ring?.outer ?? 1) + 5)
      }
    }
  })

  it('cada punto nombra un objeto cercano para el HUD y los focusId son válidos', () => {
    expect(validateFocus(beta.scene!.waypoints, objects)).toEqual([])
    for (const w of beta.scene!.waypoints) {
      expect(nearbyObject(w, objects)?.label).toBeTruthy()
    }
  })
})

describe('nearestLabelled', () => {
  it('ignora los objetos sin etiqueta y mide a la superficie', () => {
    const base = { kind: 'sphere', seed: 1, palette: ['#000', '#000', '#000'] } as const
    const found = nearestLabelled(
      [0, 0, 0],
      [
        { ...base, id: 'sin', position: [1, 0, 0], radius: 0.1 },
        { ...base, id: 'pequeño', label: 'P', position: [0, 0, -10], radius: 1 },
        { ...base, id: 'grande', label: 'G', position: [0, 0, -12], radius: 8 },
      ],
    )
    expect(found?.id).toBe('grande')
    expect(nearestLabelled([0, 0, 0], [])).toBeUndefined()
  })
})

describe('nearbyObject y validateFocus', () => {
  const base = { kind: 'sphere', seed: 1, palette: ['#000', '#000', '#000'] } as const
  const objs = [
    { ...base, id: 'cerca', label: 'Cerca', position: [0, 0, -5], radius: 1 },
    { ...base, id: 'lejos', label: 'Lejos', position: [0, 0, -90], radius: 1 },
    { ...base, id: 'mudo', position: [0, 0, -50], radius: 1 },
  ] as const
  const wp = { id: 'w', name: 'w', position: [0, 0, 0], yawDeg: 0, pitchDeg: 0, links: {} } as const

  it('el focusId manda sobre la distancia', () => {
    expect(nearbyObject(wp, objs)?.id).toBe('cerca')
    expect(nearbyObject({ ...wp, focusId: 'lejos' }, objs)?.id).toBe('lejos')
  })

  it('validateFocus detecta focusId inexistente, sin etiqueta y objetos duplicados', () => {
    expect(validateFocus([{ ...wp, focusId: 'nada' }], objs)).toHaveLength(1)
    expect(validateFocus([{ ...wp, focusId: 'mudo' }], objs)[0]).toContain('etiqueta')
    expect(validateFocus([], [objs[0], objs[0]])[0]).toContain('duplicado')
    expect(validateFocus([{ ...wp, focusId: 'cerca' }], objs)).toEqual([])
  })
})

describe('fromView', () => {
  it('el centro de la pantalla cae sobre el eje de visión', () => {
    expect(fromView(0, 0, 100)).toEqual([0, 0, -100])
  })

  it('arriba-izquierda queda a -X, +Y y delante', () => {
    const [x, y, z] = fromView(-1, 1, 100)
    expect(x).toBeLessThan(0)
    expect(y).toBeGreaterThan(0)
    expect(z).toBe(-100)
  })
})
