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
  /** Partículas de la estela del motor. */
  readonly trailParticles: number
  /** Estrellas de fondo de la escena 3D (un único draw call). */
  readonly stars: number
  /** Cuerpos pequeños de relleno (instanciados). */
  readonly debris: number
  /** Escala de resolución del fondo de la selección y octavas de su nebulosa. */
  readonly backdropScale: number
  readonly nebulaOctaves: number
}

export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualitySettings>> = {
  low: {
    level: 'low',
    dprMax: 1,
    bloom: false,
    bloomStrength: 0,
    trailParticles: 60,
    stars: 1200,
    debris: 14,
    backdropScale: 0.6,
    nebulaOctaves: 3,
  },
  medium: {
    level: 'medium',
    dprMax: 1.5,
    bloom: true,
    bloomStrength: 0.35,
    trailParticles: 160,
    stars: 2600,
    debris: 26,
    backdropScale: 0.85,
    nebulaOctaves: 4,
  },
  high: {
    level: 'high',
    dprMax: 2,
    bloom: true,
    bloomStrength: 0.45,
    trailParticles: 280,
    stars: 4200,
    debris: 40,
    backdropScale: 1,
    nebulaOctaves: 5,
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

/** Calidad inicial y si es fija, a partir de ?quality=. */
export function initialQuality(param: QualityParam): { level: QualityLevel; forced: boolean } {
  return param === 'auto' ? { level: 'high', forced: false } : { level: param, forced: true }
}

/**
 * Calidad adaptativa: se alimenta con la duración de cada cuadro y baja (o vuelve a subir) de
 * nivel según los FPS medios por ventanas, con calentamiento, enfriamiento entre cambios e
 * histéresis para no oscilar. Con ?quality= forzado nunca cambia.
 */
export class AdaptiveQuality {
  private current: QualityLevel
  private readonly ceiling: QualityLevel
  private readonly forced: boolean
  private readonly o: Required<AdaptiveOptions>
  private elapsed = 0
  private winTime = 0
  private winFrames = 0
  private sinceChange = Infinity
  private goodFor = 0
  private lastFps = 0

  constructor(initial: QualityLevel, forced = false, options: AdaptiveOptions = {}) {
    this.current = initial
    this.ceiling = initial
    this.forced = forced
    this.o = {
      lowFps: 42,
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
    return QUALITY_PRESETS[this.current]
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
      if (idx > 0 && this.sinceChange >= this.o.cooldownMs) return this.change(LEVELS[idx - 1]!)
      return false
    }
    if (fps >= this.o.highFps) {
      this.goodFor += windowLength
      const top = LEVELS.indexOf(this.ceiling)
      if (idx < top && this.goodFor >= this.o.upgradeAfterMs && this.sinceChange >= this.o.cooldownMs) {
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
