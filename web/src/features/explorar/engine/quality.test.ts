import { describe, expect, it } from 'vitest'
import { platformParam } from '../params'
import { AdaptiveQuality, adaptiveOptionsFor, budgetDpr, detectPlatform, forPlatform, initialQuality, LEVELS, QUALITY_PRESETS } from './quality'

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
      expect(lo.chromatic).toBeLessThanOrEqual(hi.chromatic)
      expect(lo.grain).toBeLessThanOrEqual(hi.grain)
      expect(lo.nebulaLayers).toBeLessThanOrEqual(hi.nebulaLayers)
      expect(lo.nearStars).toBeLessThan(hi.nearStars)
    }
  })
  it('en baja no hay bloom ni efectos de lente y el dpr se limita a 1; nunca pasa de 2', () => {
    expect(QUALITY_PRESETS.low.bloom).toBe(false)
    expect(QUALITY_PRESETS.low.chromatic).toBe(0)
    expect(QUALITY_PRESETS.low.nebulaLayers).toBe(0)
    expect(QUALITY_PRESETS.low.dprMax).toBe(1)
    for (const l of LEVELS) expect(QUALITY_PRESETS[l].dprMax).toBeLessThanOrEqual(2)
  })
})

describe('budgetDpr', () => {
  const high = QUALITY_PRESETS.high
  it('en una pantalla normal deja el dpr del dispositivo', () => {
    expect(budgetDpr(1, high, 1920 * 950)).toBe(1)
    expect(budgetDpr(1.5, high, 1280 * 640)).toBe(1.5)
  })
  it('con escalado o zoom alto recorta el dpr para no pasar del tope de píxeles', () => {
    const dpr = budgetDpr(2, high, 1700 * 900)
    expect(dpr).toBeLessThan(2)
    expect(1700 * 900 * dpr * dpr).toBeLessThanOrEqual(high.maxPixels * 1.01)
  })
  it('nunca baja de 1 ni pasa del máximo del nivel', () => {
    expect(budgetDpr(1.25, QUALITY_PRESETS.low, 3840 * 2000)).toBe(1)
    expect(budgetDpr(0.8, high, 3840 * 2000)).toBe(0.8)
    expect(budgetDpr(3, QUALITY_PRESETS.medium, 400 * 300)).toBe(QUALITY_PRESETS.medium.dprMax)
    expect(budgetDpr(Number.NaN, high, 1000)).toBe(1)
  })
  it('cada nivel tiene un tope de píxeles y un cubemap del cielo mayores que el anterior', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(QUALITY_PRESETS[LEVELS[i - 1]!].maxPixels).toBeLessThan(QUALITY_PRESETS[LEVELS[i]!].maxPixels)
      expect(QUALITY_PRESETS[LEVELS[i - 1]!].skyCube).toBeLessThan(QUALITY_PRESETS[LEVELS[i]!].skyCube)
    }
  })
})

describe('initialQuality', () => {
  it('automático empieza en alta y puede cambiar; ?quality fuerza el nivel', () => {
    expect(initialQuality('auto')).toEqual({ level: 'high', forced: false })
    expect(initialQuality('low')).toEqual({ level: 'low', forced: true })
    expect(initialQuality('high')).toEqual({ level: 'high', forced: true })
    expect(initialQuality('medium')).toEqual({ level: 'medium', forced: true })
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

  it('si al volver a subir otra vez no aguanta, se queda abajo (sin vaivén)', () => {
    const q = new AdaptiveQuality('high')
    feed(q, 25, 3700)
    expect(q.level).toBe('medium')
    feed(q, 60, 13_000)
    expect(q.level).toBe('high')
    feed(q, 30, 6100)
    expect(q.level).toBe('medium')
    feed(q, 60, 60_000)
    expect(q.level).toBe('medium')
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

describe('perfil de Windows', () => {
  it('detecta Windows por userAgentData, platform o el userAgent; Linux y macOS son «general»', () => {
    expect(detectPlatform({ userAgentData: { platform: 'Windows' } })).toBe('windows')
    expect(detectPlatform({ platform: 'Win32' })).toBe('windows')
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140' })).toBe('windows')
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64) Firefox/140', platform: 'Linux x86_64' })).toBe('general')
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Darwin', platform: 'MacIntel' })).toBe('general')
    expect(detectPlatform(undefined)).toBe('general')
  })

  it('en «general» no cambia nada', () => {
    for (const l of LEVELS) expect(forPlatform(QUALITY_PRESETS[l], 'general')).toEqual(QUALITY_PRESETS[l])
  })

  it('en Windows cada nivel es más barato: menos píxeles, menos MSAA, bloom a media resolución y sin aberración', () => {
    for (const l of LEVELS) {
      const g = QUALITY_PRESETS[l]
      const w = forPlatform(g, 'windows')
      expect(w.level).toBe(l)
      expect(w.dprMax).toBeLessThanOrEqual(1.25)
      expect(w.maxPixels).toBeLessThan(g.maxPixels)
      expect(w.msaa).toBeLessThanOrEqual(2)
      expect(w.bloomScale).toBeLessThan(1)
      expect(w.chromatic).toBe(0)
      expect(w.nebulaLayers).toBeLessThanOrEqual(Math.max(0, g.nebulaLayers - 1))
      expect(w.stars).toBeLessThan(g.stars)
      expect(w.trailParticles).toBeLessThan(g.trailParticles)
      expect(w.skyCube).toBeLessThanOrEqual(768)
      // Mantiene lo que define el aspecto: el bloom sigue encendido donde lo estaba.
      expect(w.bloom).toBe(g.bloom)
    }
  })

  it('la calidad adaptativa usa el perfil y en Windows baja antes', () => {
    const q = new AdaptiveQuality('high', false, adaptiveOptionsFor('windows'), 'windows')
    expect(q.settings).toEqual(forPlatform(QUALITY_PRESETS.high, 'windows'))
    feed(q, 48, 3700) // 48 FPS: aguanta en general, en Windows baja
    expect(q.level).toBe('medium')
    const g = new AdaptiveQuality('high')
    feed(g, 48, 3700)
    expect(g.level).toBe('high')
  })

  it('?perfil= fuerza el perfil', () => {
    expect(platformParam('?perfil=windows')).toBe('windows')
    expect(platformParam('?perfil=General')).toBe('general')
    expect(platformParam('?perfil=otro')).toBeNull()
    expect(platformParam('')).toBeNull()
  })
})
