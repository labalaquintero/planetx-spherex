import type { QualityParam } from '../params'

export type QualityLevel = 'low' | 'medium' | 'high'

export const LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high']

export interface QualitySettings {
  readonly level: QualityLevel
  /** Tope de devicePixelRatio de la escena 3D. */
  readonly dprMax: number
  /** Brillo (bloom) y su intensidad; apagado en baja. */
  readonly bloom: boolean
  readonly bloomStrength: number
  /** Pase de lente: aberración cromática y grano (0 = apagado). */
  readonly chromatic: number
  readonly grain: number
  /** Capas de nebulosa con paralaje y estrellas cercanas con profundidad. */
  readonly nebulaLayers: number
  readonly nearStars: number
  /** Partículas de la estela del motor. */
  readonly trailParticles: number
  /** Estrellas de fondo de la escena 3D (un único draw call). */
  readonly stars: number
  /** Cuerpos pequeños de relleno (instanciados). */
  readonly debris: number
  /** Escala de resolución del fondo de la selección y octavas de su nebulosa. */
  readonly backdropScale: number
  readonly nebulaOctaves: number
  /** Resolución por cara (px) de los cubemaps donde se hornean el cielo y la nebulosa. */
  readonly skyCube: number
  /** Tope de píxeles de la escena 3D: limita el dpr en pantallas grandes o con escalado. */
  readonly maxPixels: number
  /** Muestras de MSAA del composer (0 = sin antialias). */
  readonly msaa: number
  /** Resolución interna del bloom respecto a la normal (1 = la de three, 0,5 = la mitad). */
  readonly bloomScale: number
}

export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualitySettings>> = {
  low: {
    level: 'low',
    dprMax: 1,
    bloom: false,
    bloomStrength: 0,
    chromatic: 0,
    grain: 0,
    nebulaLayers: 0,
    nearStars: 600,
    trailParticles: 60,
    stars: 1200,
    debris: 14,
    backdropScale: 0.6,
    nebulaOctaves: 3,
    skyCube: 512,
    maxPixels: 1_000_000,
    msaa: 0,
    bloomScale: 1,
  },
  medium: {
    level: 'medium',
    dprMax: 1.5,
    bloom: true,
    bloomStrength: 0.35,
    chromatic: 0,
    grain: 0.025,
    nebulaLayers: 1,
    nearStars: 1400,
    trailParticles: 160,
    stars: 2600,
    debris: 26,
    backdropScale: 0.85,
    nebulaOctaves: 4,
    skyCube: 768,
    maxPixels: 1_800_000,
    msaa: 2,
    bloomScale: 1,
  },
  high: {
    level: 'high',
    dprMax: 2,
    bloom: true,
    bloomStrength: 0.5,
    chromatic: 0.0016,
    grain: 0.035,
    nebulaLayers: 2,
    nearStars: 2600,
    trailParticles: 280,
    stars: 4200,
    debris: 40,
    backdropScale: 1,
    nebulaOctaves: 5,
    skyCube: 1024,
    maxPixels: 2_600_000,
    msaa: 4,
    bloomScale: 1,
  },
}

export interface AdaptiveOptions {
  /** Por debajo de esta media de FPS en una ventana, baja un nivel. */
  readonly lowFps?: number
  /** Por encima de esta media sostenida, sube un nivel (nunca por encima del inicial). */
  readonly highFps?: number
  readonly windowMs?: number
  /** Se ignoran los primeros ms (compilación de shaders, carga de texturas). */
  readonly warmupMs?: number
  /** Tiempo mínimo entre dos cambios. */
  readonly cooldownMs?: number
  /** Tiempo sostenido por encima de highFps para subir. */
  readonly upgradeAfterMs?: number
  /** Un cuadro más largo que esto es una pausa (pestaña oculta, depurador): no cuenta. */
  readonly maxFrameMs?: number
}

/**
 * dpr de la escena 3D: el del dispositivo, acotado por el nivel y por un tope de píxeles. Con
 * escalado de Windows (125–150 %) o zoom del navegador el dpr sube y el coste crece con su cuadrado;
 * el tope lo recorta sin bajar nunca de 1 (o del dpr real, si es menor).
 */
export function budgetDpr(deviceDpr: number, settings: Pick<QualitySettings, 'dprMax' | 'maxPixels'>, cssPixels: number): number {
  const device = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1
  const floor = Math.min(1, device)
  const byBudget = cssPixels > 0 ? Math.sqrt(settings.maxPixels / cssPixels) : Infinity
  const dpr = Math.min(device, settings.dprMax, byBudget)
  return Math.round(Math.max(floor, dpr) * 100) / 100
}

/**
 * Plataforma para el perfil de rendimiento. En Windows el navegador dibuja WebGL a través de Direct3D
 * (ANGLE), con más coste por pase de pantalla completa, y los portátiles suelen tener escalado de
 * pantalla y GPU integrada: ahí se usa un perfil algo más ligero. En el resto (Linux, macOS), igual.
 */
export type Platform = 'windows' | 'general'

export function detectPlatform(nav?: { userAgent?: string; platform?: string; userAgentData?: { platform?: string } }): Platform {
  if (!nav) return 'general'
  const isWin = (v?: string) => !!v && /^win|\bwindows\b/i.test(v)
  return isWin(nav.userAgentData?.platform) || isWin(nav.platform) || /\bWindows NT\b/.test(nav.userAgent ?? '') ? 'windows' : 'general'
}

/**
 * Ajustes del perfil de Windows sobre cualquier nivel: sacrifica algo de calidad (menos resolución,
 * menos muestras de antialias, bloom a media resolución interna, sin aberración cromática, una capa
 * de nebulosa menos y menos partículas y estrellas) a cambio de más FPS. En «general» no cambia nada.
 */
export function forPlatform(s: QualitySettings, platform: Platform): QualitySettings {
  if (platform !== 'windows') return s
  return {
    ...s,
    dprMax: Math.min(s.dprMax, 1.25),
    maxPixels: Math.round(s.maxPixels * 0.7),
    msaa: Math.min(s.msaa, 2),
    bloomScale: 0.5,
    chromatic: 0,
    nebulaLayers: Math.max(0, s.nebulaLayers - 1),
    nearStars: Math.round(s.nearStars * 0.6),
    stars: Math.round(s.stars * 0.7),
    trailParticles: Math.round(s.trailParticles * 0.6),
    debris: Math.round(s.debris * 0.75),
    skyCube: Math.min(s.skyCube, 768),
  }
}

/** En Windows baja de nivel antes (por debajo de 50 FPS en vez de 46). */
export function adaptiveOptionsFor(platform: Platform): AdaptiveOptions {
  return platform === 'windows' ? { lowFps: 50 } : {}
}

/** Calidad inicial y si es fija, a partir de ?quality=. */
export function initialQuality(param: QualityParam): { level: QualityLevel; forced: boolean } {
  return param === 'auto' ? { level: 'high', forced: false } : { level: param, forced: true }
}

/**
 * Calidad adaptativa: se alimenta con la duración de cada cuadro y baja (o vuelve a subir) de
 * nivel según los FPS medios por ventanas, con calentamiento, enfriamiento entre cambios e
 * histéresis para no oscilar. Si vuelve a subir y en ese nivel otra vez no aguanta, ya no lo
 * intenta más (sin vaivén alto–medio–alto). Con ?quality= forzado nunca cambia.
 */
export class AdaptiveQuality {
  private current: QualityLevel
  private ceiling: QualityLevel
  /** Nivel al que se acaba de subir (para detectar que no aguanta). */
  private climbedTo: QualityLevel | null = null
  private readonly forced: boolean
  private readonly o: Required<AdaptiveOptions>
  private readonly platform: Platform
  private elapsed = 0
  private winTime = 0
  private winFrames = 0
  private sinceChange = Infinity
  private goodFor = 0
  private lastFps = 0

  constructor(initial: QualityLevel, forced = false, options: AdaptiveOptions = {}, platform: Platform = 'general') {
    this.platform = platform
    this.current = initial
    this.ceiling = initial
    this.forced = forced
    this.o = {
      lowFps: 46,
      highFps: 57,
      windowMs: 2000,
      warmupMs: 1500,
      cooldownMs: 4000,
      upgradeAfterMs: 10000,
      maxFrameMs: 250,
      ...options,
    }
  }

  get level(): QualityLevel {
    return this.current
  }

  get settings(): QualitySettings {
    return forPlatform(QUALITY_PRESETS[this.current], this.platform)
  }

  /** FPS medios de la última ventana completa (0 si aún no hay). */
  get fps(): number {
    return this.lastFps
  }

  /** Registra un cuadro. Devuelve true si el nivel cambió. */
  sample(dtMs: number): boolean {
    if (!(dtMs > 0) || dtMs > this.o.maxFrameMs) return false
    this.elapsed += dtMs
    this.sinceChange += dtMs
    if (this.elapsed <= this.o.warmupMs) return false

    this.winTime += dtMs
    this.winFrames += 1
    if (this.winTime < this.o.windowMs) return false

    const fps = (this.winFrames * 1000) / this.winTime
    this.lastFps = fps
    const windowLength = this.winTime
    this.winTime = 0
    this.winFrames = 0
    if (this.forced) return false

    const idx = LEVELS.indexOf(this.current)
    if (fps < this.o.lowFps) {
      this.goodFor = 0
      if (idx > 0 && this.sinceChange >= this.o.cooldownMs) {
        // Subió a este nivel hace poco y no aguanta: el techo pasa a ser el de abajo.
        if (this.climbedTo === this.current && this.sinceChange < 30_000) this.ceiling = LEVELS[idx - 1]!
        this.climbedTo = null
        return this.change(LEVELS[idx - 1]!)
      }
      return false
    }
    if (fps >= this.o.highFps) {
      this.goodFor += windowLength
      const top = LEVELS.indexOf(this.ceiling)
      if (idx < top && this.goodFor >= this.o.upgradeAfterMs && this.sinceChange >= this.o.cooldownMs) {
        this.climbedTo = LEVELS[idx + 1]!
        return this.change(LEVELS[idx + 1]!)
      }
    } else {
      this.goodFor = 0
    }
    return false
  }

  private change(level: QualityLevel): boolean {
    this.current = level
    this.sinceChange = 0
    this.goodFor = 0
    return true
  }
}
