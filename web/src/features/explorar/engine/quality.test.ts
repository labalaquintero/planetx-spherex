import { describe, expect, it } from 'vitest'
import { AdaptiveQuality, initialQuality, LEVELS, QUALITY_PRESETS } from './quality'

/** Alimenta `ms` milisegundos a un ritmo de `fps` cuadros por segundo. */
function feed(q: AdaptiveQuality, fps: number, ms: number): number {
  let changes = 0
  const dt = 1000 / fps
  for (let t = 0; t < ms; t += dt) if (q.sample(dt)) changes++
  return changes
}

describe('presets de calidad', () => {
  it('cada nivel es más barato que el siguiente', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const lo = QUALITY_PRESETS[LEVELS[i - 1]!]
      const hi = QUALITY_PRESETS[LEVELS[i]!]
      expect(lo.dprMax).toBeLessThanOrEqual(hi.dprMax)
      expect(lo.trailParticles).toBeLessThan(hi.trailParticles)
      expect(lo.stars).toBeLessThan(hi.stars)
      expect(lo.debris).toBeLessThan(hi.debris)
      expect(lo.bloomStrength).toBeLessThanOrEqual(hi.bloomStrength)
    }
  })
  it('en baja no hay bloom y el dpr se limita a 1; nunca pasa de 2', () => {
    expect(QUALITY_PRESETS.low.bloom).toBe(false)
    expect(QUALITY_PRESETS.low.dprMax).toBe(1)
    for (const l of LEVELS) expect(QUALITY_PRESETS[l].dprMax).toBeLessThanOrEqual(2)
  })
})

describe('initialQuality', () => {
  it('automático empieza en alta y puede cambiar; ?quality fuerza el nivel', () => {
    expect(initialQuality('auto')).toEqual({ level: 'high', forced: false })
    expect(initialQuality('low')).toEqual({ level: 'low', forced: true })
    expect(initialQuality('high')).toEqual({ level: 'high', forced: true })
  })
})

describe('AdaptiveQuality', () => {
  it('a 60 FPS se queda en alta', () => {
    const q = new AdaptiveQuality('high')
    expect(feed(q, 60, 20_000)).toBe(0)
    expect(q.level).toBe('high')
    expect(q.fps).toBeCloseTo(60, 0)
  })

  it('con FPS bajos sostenidos baja un nivel y, tras el enfriamiento, otro', () => {
    const q = new AdaptiveQuality('high')
    feed(q, 25, 1500 + 2100)
    expect(q.level).toBe('medium')
    feed(q, 25, 4100)
    expect(q.level).toBe('low')
    feed(q, 25, 20_000)
    expect(q.level).toBe('low') // no hay nivel inferior
  })

  it('no baja dos niveles seguidos antes del enfriamiento', () => {
    const q = new AdaptiveQuality('high', false, { cooldownMs: 10_000 })
    feed(q, 20, 1500 + 2100)
    expect(q.level).toBe('medium')
    feed(q, 20, 6000)
    expect(q.level).toBe('medium')
  })

  it('ignora el calentamiento inicial (compilación de shaders)', () => {
    const q = new AdaptiveQuality('high')
    feed(q, 10, 1400)
    expect(q.level).toBe('high')
    feed(q, 60, 6000)
    expect(q.level).toBe('high')
  })

  it('un tirón aislado no baja la calidad', () => {
    const q = new AdaptiveQuality('high')
    feed(q, 60, 3000)
    q.sample(120)
    feed(q, 60, 3000)
    expect(q.level).toBe('high')
  })

  it('las pausas largas (pestaña oculta) no cuentan', () => {
    const q = new AdaptiveQuality('high')
    feed(q, 60, 3000)
    for (let i = 0; i < 20; i++) q.sample(5000)
    feed(q, 60, 3000)
    expect(q.level).toBe('high')
  })

  it('vuelve a subir tras FPS altos sostenidos, pero nunca por encima del inicial', () => {
    const q = new AdaptiveQuality('high')
    feed(q, 25, 3700)
    expect(q.level).toBe('medium')
    feed(q, 60, 9000)
    expect(q.level).toBe('medium') // aún no lleva 10 s sostenidos
    feed(q, 60, 4000)
    expect(q.level).toBe('high')
    feed(q, 60, 30_000)
    expect(q.level).toBe('high')

    const m = new AdaptiveQuality('medium')
    feed(m, 60, 60_000)
    expect(m.level).toBe('medium')
  })

  it('FPS intermedios (entre los umbrales) no cambian nada', () => {
    const q = new AdaptiveQuality('medium')
    feed(q, 50, 30_000)
    expect(q.level).toBe('medium')
  })

  it('con calidad forzada nunca cambia, pero sigue midiendo FPS', () => {
    const q = new AdaptiveQuality('high', true)
    expect(feed(q, 15, 30_000)).toBe(0)
    expect(q.level).toBe('high')
    expect(q.fps).toBeCloseTo(15, 0)
  })

  it('ignora duraciones no válidas', () => {
    const q = new AdaptiveQuality('high')
    expect(q.sample(0)).toBe(false)
    expect(q.sample(-5)).toBe(false)
    expect(q.sample(Number.NaN)).toBe(false)
  })
})
