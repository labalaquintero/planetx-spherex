import { describe, expect, it } from 'vitest'
import { createSound, engineMix } from './sound'

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
    s.impact(1)
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

  it('al encenderlo suena una confirmación (notas además del motor)', () => {
    const fake = fakeContext()
    const s = createSound(() => fake.ctx as unknown as AudioContext)
    s.setEnabled(true)
    // Motor: 3 osciladores. La confirmación añade al menos 2 más.
    expect(fake.created.filter((k) => k === 'oscillator').length).toBeGreaterThanOrEqual(5)
    // El siseo de empuje es una fuente de ruido en bucle.
    expect(fake.created).toContain('source')
  })

  it('el tic de la selección y el paso de visitantes suenan solo con el sonido encendido', () => {
    const fake = fakeContext()
    const s = createSound(() => fake.ctx as unknown as AudioContext)
    s.hover()
    s.visitor('meteor')
    expect(fake.created).toHaveLength(0)
    s.setEnabled(true)
    for (const k of ['comet', 'meteor', 'asteroid'] as const) {
      const before = fake.created.length
      s.visitor(k)
      expect(fake.created.length, k).toBeGreaterThan(before)
    }
    const before = fake.created.length
    s.hover()
    expect(fake.created.length).toBeGreaterThan(before)
  })
})

describe('mezcla del motor', () => {
  it('sube de tono, se abre y se oye más con el empuje, y se acota', () => {
    const idle = engineMix(0)
    const full = engineMix(1)
    expect(full.pitch).toBeGreaterThan(idle.pitch)
    expect(full.cutoff).toBeGreaterThan(idle.cutoff)
    expect(full.drone).toBeGreaterThan(idle.drone)
    expect(full.air).toBeGreaterThan(idle.air * 3)
    expect(engineMix(5)).toEqual(full)
    expect(engineMix(Number.NaN)).toEqual(idle)
  })

  it('en reposo ya es audible en bocinas pequeñas: paso bajo por encima de 400 Hz y siseo presente', () => {
    const idle = engineMix(0)
    expect(idle.cutoff).toBeGreaterThan(400)
    expect(idle.air).toBeGreaterThan(0)
    expect(idle.drone).toBeGreaterThan(0.05)
  })
})
