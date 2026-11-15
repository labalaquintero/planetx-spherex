import { describe, expect, it } from 'vitest'
import { ACTION_LABELS, FLIGHT_KEYS, inputFrom, type FlightAction } from './controls'

describe('controles de vuelo', () => {
  it('sin teclas, sin entrada', () => {
    expect(inputFrom(new Set())).toEqual({ thrust: 0, turn: 0, lift: 0, boost: false })
  })
  it('cada acción mueve su eje en el sentido esperado', () => {
    expect(inputFrom(new Set<FlightAction>(['forward'])).thrust).toBe(1)
    expect(inputFrom(new Set<FlightAction>(['back'])).thrust).toBe(-1)
    expect(inputFrom(new Set<FlightAction>(['left'])).turn).toBe(1)
    expect(inputFrom(new Set<FlightAction>(['right'])).turn).toBe(-1)
    expect(inputFrom(new Set<FlightAction>(['up'])).lift).toBe(1)
    expect(inputFrom(new Set<FlightAction>(['down'])).lift).toBe(-1)
  })
  it('acciones opuestas se anulan y las combinadas se suman', () => {
    expect(inputFrom(new Set<FlightAction>(['left', 'right'])).turn).toBe(0)
    expect(inputFrom(new Set<FlightAction>(['forward', 'left', 'up']))).toEqual({ thrust: 1, turn: 1, lift: 1, boost: false })
  })
  it('WASD, flechas, E/Q, Espacio/C y Shift cubren las siete acciones', () => {
    expect(new Set(Object.values(FLIGHT_KEYS)).size).toBe(7)
    expect(FLIGHT_KEYS.ShiftLeft).toBe('boost')
    expect(FLIGHT_KEYS.ShiftRight).toBe('boost')
    expect(inputFrom(new Set<FlightAction>(['forward', 'boost'])).boost).toBe(true)
    expect(FLIGHT_KEYS.KeyW).toBe('forward')
    expect(FLIGHT_KEYS.ArrowLeft).toBe('left')
    expect(FLIGHT_KEYS.Space).toBe('up')
    expect(Object.keys(ACTION_LABELS)).toHaveLength(7)
  })
})
