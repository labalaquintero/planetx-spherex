import { describe, expect, it } from 'vitest'
import { SECTORS } from '../sectors'
import beta from '../sectors/beta'
import { buildGraph, DIRECTIONS, OPPOSITE, validateGraph } from './graph'
import { validateFocus } from './nearest'
import type { Waypoint } from './types'

const node = (id: string, links: Waypoint['links'] = {}): Waypoint => ({
  id,
  name: id,
  position: [0, 0, 0],
  yawDeg: 0,
  pitchDeg: 0,
  links,
})

describe('grafo de ruta del sector β', () => {
  const scene = beta.scene!

  it('es válido: sin referencias rotas, regresos coherentes y todo alcanzable', () => {
    expect(validateGraph(scene.waypoints, scene.startId)).toEqual([])
  })

  it('cada vínculo tiene su regreso en la dirección opuesta', () => {
    const graph = buildGraph(scene.waypoints, scene.startId)
    let links = 0
    for (const w of scene.waypoints) {
      for (const d of DIRECTIONS) {
        const to = w.links[d]
        if (to === undefined) continue
        links++
        expect(graph.nodes.get(to)?.links[OPPOSITE[d]]).toBe(w.id)
      }
    }
    expect(links).toBeGreaterThan(0)
  })

  it('tiene al menos un punto por cada dirección, para poder usar los cuatro botones', () => {
    const used = new Set(scene.waypoints.flatMap((w) => Object.keys(w.links)))
    expect([...used].sort()).toEqual(['back', 'forward', 'left', 'right'])
  })
})

describe.each(SECTORS.filter((s) => s.scene))('sector navegable $id', (sector) => {
  it('su grafo es válido', () => {
    expect(validateGraph(sector.scene!.waypoints, sector.scene!.startId)).toEqual([])
  })

  it('sus puntos y objetos son coherentes', () => {
    expect(validateFocus(sector.scene!.waypoints, sector.scene!.objects)).toEqual([])
  })
})

describe('validateGraph detecta grafos inválidos', () => {
  it('referencia rota', () => {
    const p = validateGraph([node('a', { forward: 'zz' })], 'a')
    expect(p).toHaveLength(1)
    expect(p[0]).toContain('no existe')
  })

  it('vínculo sin regreso', () => {
    const p = validateGraph([node('a', { forward: 'b' }), node('b')], 'a')
    expect(p.some((m) => m.includes('b.back'))).toBe(true)
  })

  it('regreso en dirección equivocada', () => {
    const p = validateGraph([node('a', { forward: 'b' }), node('b', { left: 'a' })], 'a')
    expect(p.some((m) => m.includes('b.back'))).toBe(true)
  })

  it('regreso hacia otro nodo', () => {
    const p = validateGraph(
      [node('a', { forward: 'b' }), node('b', { back: 'c' }), node('c', { forward: 'b' })],
      'a',
    )
    expect(p.some((m) => m.startsWith('a.forward'))).toBe(true)
  })

  it('nodo inalcanzable', () => {
    const p = validateGraph([node('a'), node('isla')], 'a')
    expect(p).toEqual(['isla no es alcanzable desde a'])
  })

  it('id duplicado', () => {
    expect(validateGraph([node('a'), node('a')], 'a').some((m) => m.includes('duplicado'))).toBe(true)
  })

  it('punto inicial inexistente', () => {
    expect(validateGraph([node('a')], 'x').some((m) => m.includes('inicial'))).toBe(true)
  })

  it('vínculo a sí mismo', () => {
    expect(validateGraph([node('a', { left: 'a' })], 'a').some((m) => m.includes('sí mismo'))).toBe(true)
  })

  it('un par bien enlazado es válido', () => {
    expect(validateGraph([node('a', { right: 'b' }), node('b', { left: 'a' })], 'a')).toEqual([])
  })
})
