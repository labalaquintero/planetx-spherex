import { describe, expect, it } from 'vitest'
import { createSound } from './sound'

/** AudioContext falso: registra los nodos creados (sin audio real). */
function fakeContext() {
  const created: string[] = []
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  })
  const node = (kind: string) => {
    created.push(kind)
    const n = {
      gain: param(),
      frequency: param(),
      Q: param(),
      type: '',
      buffer: null as unknown,
      connect: (x: unknown) => x,
      start() {},
      stop() {},
    }
    return n
  }
  let state = 'running'
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createGain: () => node('gain'),
    createOscillator: () => node('oscillator'),
    createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('source'),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    resume: async () => {
      state = 'running'
    },
    suspend: async () => {
      state = 'suspended'
    },
    close: async () => {
      state = 'closed'
    },
  }
  return { ctx, created, state: () => state }
}

describe('sonido (WebAudio)', () => {
  it('apagado por defecto: no crea AudioContext ni suena al moverse o saltar', () => {
    let made = 0
    const s = createSound(() => {
      made++
      return fakeContext().ctx as unknown as AudioContext
    })
    expect(s.enabled).toBe(false)
    s.move('forward')
    s.jump()
    s.engine(1)
    expect(made).toBe(0)
  })

  it('al encenderlo crea un único contexto y los sonidos crean nodos', () => {
    const fake = fakeContext()
    let made = 0
    const s = createSound(() => {
      made++
      return fake.ctx as unknown as AudioContext
    })
    s.setEnabled(true)
    expect(s.enabled).toBe(true)
    const before = fake.created.length
    s.move('forward')
    expect(fake.created.length).toBeGreaterThan(before)
    s.setEnabled(false)
    s.setEnabled(true)
    expect(made).toBe(1)
  })

  it('apagado de nuevo, los sonidos no crean nodos', () => {
    const fake = fakeContext()
    const s = createSound(() => fake.ctx as unknown as AudioContext)
    s.setEnabled(true)
    s.setEnabled(false)
    const before = fake.created.length
    s.move('left')
    s.jump()
    expect(fake.created.length).toBe(before)
  })

  it('sin WebAudio en el navegador, encender no hace nada y no falla', () => {
    const s = createSound(() => null)
    s.setEnabled(true)
    expect(s.enabled).toBe(false)
    expect(() => s.move('forward')).not.toThrow()
  })

  it('dispose cierra el contexto', () => {
    const fake = fakeContext()
    const s = createSound(() => fake.ctx as unknown as AudioContext)
    s.setEnabled(true)
    s.dispose()
    expect(fake.state()).toBe('closed')
    expect(s.enabled).toBe(false)
  })
})
