import { describe, expect, it } from 'vitest'
import beta from '../sectors/beta'
import { NavController } from './controller'
import { buildGraph } from './graph'
import {
  advance,
  availableDirections,
  initialState,
  MOVE_DURATION_MS,
  progress,
  requestMove,
} from './navigation'
import { MAX_BANK_DEG, poseFor } from './pose'

const scene = beta.scene!
const graph = buildGraph(scene.waypoints, scene.startId)

describe('máquina de navegación', () => {
  it('empieza parada en el punto inicial', () => {
    expect(initialState(graph)).toEqual({ at: 'entry', transition: null })
  })

  it('acepta una dirección con vecino y arranca el tránsito', () => {
    const s = requestMove(graph, initialState(graph), 'forward')
    expect(s.transition).toMatchObject({ from: 'entry', to: 'mid', direction: 'forward', elapsedMs: 0 })
    expect(s.transition?.durationMs).toBe(MOVE_DURATION_MS)
  })

  it('ignora una dirección sin vecino (mismo estado, por identidad)', () => {
    const s = initialState(graph)
    expect(requestMove(graph, s, 'back')).toBe(s)
    expect(requestMove(graph, s, 'left')).toBe(s)
    expect(requestMove(graph, s, 'right')).toBe(s)
  })

  it('ignora un vínculo roto en lugar de viajar a un punto inexistente', () => {
    const broken = buildGraph(
      [{ id: 'a', name: 'a', position: [0, 0, 0], yawDeg: 0, pitchDeg: 0, links: { forward: 'fantasma' } }],
      'a',
    )
    const s = initialState(broken)
    expect(requestMove(broken, s, 'forward')).toBe(s)
  })

  it('descarta entradas durante la transición (incluida la dirección contraria)', () => {
    const moving = requestMove(graph, initialState(graph), 'forward')
    for (const d of ['forward', 'back', 'left', 'right'] as const) {
      expect(requestMove(graph, moving, d)).toBe(moving)
    }
    const half = advance(moving, 400)
    expect(requestMove(graph, half, 'forward')).toBe(half)
  })

  it('completa el tránsito exactamente al cumplirse la duración', () => {
    const moving = requestMove(graph, initialState(graph), 'forward')
    const almost = advance(moving, MOVE_DURATION_MS - 1)
    expect(almost.transition).not.toBeNull()
    expect(almost.at).toBe('entry')
    expect(advance(almost, 1)).toEqual({ at: 'mid', transition: null })
  })

  it('un paso grande de tiempo no se pasa del destino', () => {
    const moving = requestMove(graph, initialState(graph), 'forward')
    expect(advance(moving, 60_000)).toEqual({ at: 'mid', transition: null })
  })

  it('acepta nuevas entradas al terminar', () => {
    const arrived = advance(requestMove(graph, initialState(graph), 'forward'), MOVE_DURATION_MS)
    const next = requestMove(graph, arrived, 'left')
    expect(next.transition?.to).toBe('izq')
  })

  it('ir y volver deja la nave en el punto de partida', () => {
    let s = initialState(graph)
    for (const d of ['forward', 'left', 'forward', 'back', 'right', 'back'] as const) {
      s = advance(requestMove(graph, s, d), MOVE_DURATION_MS)
    }
    expect(s.at).toBe('entry')
  })

  it('el tiempo no puede ir hacia atrás', () => {
    const moving = requestMove(graph, initialState(graph), 'forward')
    expect(advance(moving, -500).transition?.elapsedMs).toBe(0)
  })

  it('advance estando parada no cambia nada', () => {
    const s = initialState(graph)
    expect(advance(s, 100)).toBe(s)
  })

  it('progress va de 0 a 1', () => {
    const moving = requestMove(graph, initialState(graph), 'forward')
    expect(progress(initialState(graph))).toBe(0)
    expect(progress(moving)).toBe(0)
    expect(progress(advance(moving, 250))).toBeCloseTo(0.25)
  })

  it('availableDirections usa el destino mientras se mueve (para los botones)', () => {
    expect(availableDirections(graph, initialState(graph))).toEqual(['forward'])
    const moving = requestMove(graph, initialState(graph), 'forward')
    expect(availableDirections(graph, moving).sort()).toEqual(['back', 'forward', 'left', 'right'])
  })
})

describe('NavController', () => {
  it('acepta, ignora y avisa a los suscriptores solo cuando cambia el snapshot', () => {
    const c = new NavController(graph)
    let calls = 0
    c.subscribe(() => calls++)
    const first = c.getSnapshot()
    expect(first).toEqual({ at: 'entry', movingTo: null })

    expect(c.move('left')).toBe(false)
    expect(calls).toBe(0)
    expect(c.getSnapshot()).toBe(first)

    expect(c.move('forward')).toBe(true)
    expect(c.getSnapshot()).toEqual({ at: 'entry', movingTo: 'mid' })
    expect(calls).toBe(1)

    expect(c.move('forward')).toBe(false) // en tránsito
    c.update(300)
    c.update(300)
    expect(calls).toBe(1) // los cuadros intermedios no repintan el HUD
    c.update(400)
    expect(c.getSnapshot()).toEqual({ at: 'mid', movingTo: null })
    expect(calls).toBe(2)
  })

  it('con duración 0 (movimiento reducido) llega al instante', () => {
    const c = new NavController(graph, 0)
    expect(c.move('forward')).toBe(true)
    expect(c.getSnapshot()).toEqual({ at: 'mid', movingTo: null })
  })

  it('setDuration cambia los movimientos siguientes y no el que ya va en curso', () => {
    const c = new NavController(graph)
    c.move('forward')
    c.setDuration(0)
    expect(c.getSnapshot().movingTo).toBe('mid') // el actual sigue en tránsito
    c.update(MOVE_DURATION_MS)
    expect(c.move('left')).toBe(true)
    expect(c.getSnapshot()).toEqual({ at: 'izq', movingTo: null }) // instantáneo
  })

  it('un snapshot estable entre consultas sin cambios', () => {
    const c = new NavController(graph)
    expect(c.getSnapshot()).toBe(c.getSnapshot())
  })
})

describe('pose', () => {
  it('parada: coincide con el punto', () => {
    const p = poseFor(graph, initialState(graph))
    expect(p).toMatchObject({ position: [0, 0, 0], yawDeg: 0, rollDeg: 0 })
  })

  it('empieza en el origen y termina en el destino, con suavizado', () => {
    const moving = requestMove(graph, initialState(graph), 'forward')
    expect(poseFor(graph, moving).position[2]).toBe(0)
    // A mitad del tiempo el easing da exactamente la mitad del camino.
    expect(poseFor(graph, advance(moving, 500)).position[2]).toBeCloseTo(-22.5)
    // Al principio avanza menos que lineal (arranque suave).
    expect(Math.abs(poseFor(graph, advance(moving, 100)).position[2])).toBeLessThan(0.1 * 45)
  })

  it('se inclina en A/D en sentido contrario y no en W/S', () => {
    const atMid = advance(requestMove(graph, initialState(graph), 'forward'), MOVE_DURATION_MS)
    const left = advance(requestMove(graph, atMid, 'left'), 500)
    const right = advance(requestMove(graph, atMid, 'right'), 500)
    const fwd = advance(requestMove(graph, atMid, 'forward'), 500)
    expect(poseFor(graph, left).rollDeg).toBeCloseTo(MAX_BANK_DEG)
    expect(poseFor(graph, right).rollDeg).toBeCloseTo(-MAX_BANK_DEG)
    expect(poseFor(graph, fwd).rollDeg).toBe(0)
  })

  it('el alabeo vuelve a cero al llegar', () => {
    const atMid = advance(requestMove(graph, initialState(graph), 'forward'), MOVE_DURATION_MS)
    const arrived = advance(requestMove(graph, atMid, 'left'), MOVE_DURATION_MS)
    expect(poseFor(graph, arrived).rollDeg).toBe(0)
  })
})
