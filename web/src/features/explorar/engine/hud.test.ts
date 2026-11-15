import { describe, expect, it } from 'vitest'
import beta from '../sectors/beta'
import { detectWebGL } from '../screens/webgl'
import { DPAD_KEYS, dpadState, KEY_CODES } from './dpad'
import { routeMap } from './routeMap'
import type { Direction } from './types'

const all = new Set<Direction>(['forward', 'back', 'left', 'right'])
const none = new Set<Direction>()

describe('estados de la cruceta', () => {
  it('idle si hay punto y no se pulsa', () => {
    expect(dpadState('forward', { available: all, moving: null, pressed: none })).toBe('idle')
  })
  it('disabled si no hay punto en esa dirección', () => {
    expect(dpadState('back', { available: new Set(['forward']), moving: null, pressed: none })).toBe('disabled')
  })
  it('pressed mientras se mantiene la tecla o el puntero', () => {
    expect(dpadState('left', { available: all, moving: null, pressed: new Set(['left']) })).toBe('pressed')
  })
  it('pulsar un botón deshabilitado no lo muestra pulsado', () => {
    expect(dpadState('left', { available: new Set(['forward']), moving: null, pressed: new Set(['left']) })).toBe('disabled')
  })
  it('active en la dirección del movimiento en curso, aunque el destino no siga en esa dirección', () => {
    // Avanzando hacia un punto sin más «adelante»: el botón se ve activo durante el trayecto.
    expect(dpadState('forward', { available: new Set(['back']), moving: 'forward', pressed: none })).toBe('active')
    expect(dpadState('back', { available: new Set(['back']), moving: 'forward', pressed: none })).toBe('idle')
  })
  it('active manda sobre pressed', () => {
    expect(dpadState('right', { available: all, moving: 'right', pressed: new Set(['right']) })).toBe('active')
  })
})

describe('teclas', () => {
  it('WASD y flechas cubren las cuatro direcciones', () => {
    expect(new Set(Object.values(KEY_CODES))).toEqual(all)
    expect(KEY_CODES.KeyW).toBe('forward')
    expect(KEY_CODES.ArrowLeft).toBe('left')
  })
  it('cada dirección muestra su atajo WASD', () => {
    expect(Object.values(DPAD_KEYS).map((k) => k.key).sort()).toEqual(['A', 'D', 'S', 'W'])
  })
})

describe('routeMap (indicador de ruta)', () => {
  const map = routeMap(beta.scene!.waypoints)

  it('incluye todos los puntos dentro del recuadro', () => {
    expect(map.nodes).toHaveLength(beta.scene!.waypoints.length)
    for (const n of map.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.x).toBeLessThanOrEqual(1)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(1)
    }
  })

  it('una arista por vínculo de ida y vuelta', () => {
    const links = beta.scene!.waypoints.reduce((acc, w) => acc + Object.keys(w.links).length, 0)
    expect(map.edges).toHaveLength(links / 2)
    const keys = map.edges.map((e) => [...e].sort().join('|'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('adelante queda arriba y la izquierda a la izquierda', () => {
    const at = (id: string) => map.nodes.find((n) => n.id === id)!
    expect(at('far').y).toBeLessThan(at('mid').y)
    expect(at('mid').y).toBeLessThan(at('entry').y)
    expect(at('izq').x).toBeLessThan(at('mid').x)
    expect(at('der').x).toBeGreaterThan(at('mid').x)
  })

  it('lista vacía y un solo punto no fallan', () => {
    expect(routeMap([])).toEqual({ nodes: [], edges: [] })
    const one = routeMap([{ id: 'a', name: 'a', position: [5, 0, 5], yawDeg: 0, pitchDeg: 0, links: {} }])
    expect(one.nodes[0]).toMatchObject({ x: 0.5, y: 0.5 })
  })
})

describe('detectWebGL', () => {
  it('true si hay contexto webgl2 o webgl', () => {
    expect(detectWebGL(() => ({ getContext: (k: string) => (k === 'webgl2' ? {} : null) }))).toBe(true)
    expect(detectWebGL(() => ({ getContext: (k: string) => (k === 'webgl' ? {} : null) }))).toBe(true)
  })
  it('false si no hay contexto o si crear el canvas falla', () => {
    expect(detectWebGL(() => ({ getContext: () => null }))).toBe(false)
    expect(
      detectWebGL(() => {
        throw new Error('sin canvas')
      }),
    ).toBe(false)
  })
})
