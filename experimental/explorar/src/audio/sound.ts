import type { Direction } from '../engine/types'

/**
 * Sonido opcional, sintetizado con WebAudio (sin archivos). Apagado por defecto: no se crea
 * ningún AudioContext hasta que la persona lo enciende con un clic, así que nunca suena solo.
 */
export interface SoundEngine {
  readonly enabled: boolean
  setEnabled(on: boolean): void
  /** Desplazamiento entre puntos de ruta. */
  move(direction: Direction): void
  /** Salto de la selección al sector. */
  jump(): void
  /** Nivel continuo del motor 0..1 (vuelo libre): sube el tono y el volumen del zumbido. */
  engine(level: number): void
  /** Golpe sordo de un impacto (0..1). */
  impact(strength: number): void
  dispose(): void
}

type Ctx = AudioContext

function defaultFactory(): Ctx | null {
  const C = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  return C ? new C() : null
}

function noiseBuffer(ctx: Ctx, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let s = 12345
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    data[i] = (s / 4294967296) * 2 - 1
  }
  return buf
}

export function createSound(factory: () => Ctx | null = defaultFactory): SoundEngine {
  let ctx: Ctx | null = null
  let master: GainNode | null = null
  let hum: OscillatorNode[] = []
  let noise: AudioBuffer | null = null
  let on = false

  const ensure = (): Ctx | null => {
    if (ctx) return ctx
    ctx = factory()
    if (!ctx) return null
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    noise = noiseBuffer(ctx, 1.5)
    // Zumbido grave del motor: dos sierras desafinadas por un paso bajo.
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 240
    const humGain = ctx.createGain()
    humGain.gain.value = 0.05
    lp.connect(humGain).connect(master)
    hum = [55, 55.6].map((f) => {
      const o = ctx!.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.connect(lp)
      o.start()
      return o
    })
    return ctx
  }

  const swoosh = (duration: number, from: number, peak: number, level: number) => {
    if (!on || !ctx || !master || !noise) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(from, t)
    bp.frequency.exponentialRampToValueAtTime(peak, t + duration * 0.5)
    bp.frequency.exponentialRampToValueAtTime(from, t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(level, t + duration * 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(bp).connect(g).connect(master)
    src.start(t)
    src.stop(t + duration + 0.05)
    // El motor sube de tono durante el tramo.
    for (const o of hum) {
      o.frequency.setTargetAtTime(o.frequency.value * 1.3, t, duration * 0.2)
      o.frequency.setTargetAtTime(o.frequency.value, t + duration * 0.6, duration * 0.2)
    }
  }

  return {
    get enabled() {
      return on
    },
    setEnabled(next: boolean) {
      if (next === on) return
      if (next) {
        const c = ensure()
        if (!c || !master) return
        on = true
        void c.resume?.()
        master.gain.setTargetAtTime(0.5, c.currentTime, 0.08)
      } else {
        on = false
        if (ctx && master) {
          master.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
          const c = ctx
          setTimeout(() => {
            if (!on) void c.suspend?.()
          }, 300)
        }
      }
    },
    move(direction: Direction) {
      swoosh(1.0, direction === 'forward' ? 320 : 260, direction === 'forward' ? 1500 : 900, direction === 'forward' ? 0.22 : 0.14)
    },
    jump() {
      if (!on || !ctx || !master) return
      swoosh(1.1, 200, 2600, 0.3)
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(110, t)
      o.frequency.exponentialRampToValueAtTime(880, t + 1.0)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.7)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15)
      o.connect(g).connect(master)
      o.start(t)
      o.stop(t + 1.2)
    },
    engine(level: number) {
      if (!on || !ctx) return
      const k = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0))
      const t = ctx.currentTime
      hum.forEach((o, i) => o.frequency.setTargetAtTime((i ? 55.6 : 55) * (1 + 0.6 * k), t, 0.15))
    },
    impact(strength: number) {
      if (!on || !ctx || !master) return
      const k = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 0))
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(90, t)
      o.frequency.exponentialRampToValueAtTime(38, t + 0.45)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.35 * k + 0.05, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      o.connect(g).connect(master)
      o.start(t)
      o.stop(t + 0.65)
      swoosh(0.35, 500, 1800, 0.12 * k + 0.02)
    },
    dispose() {
      on = false
      for (const o of hum) o.stop()
      hum = []
      void ctx?.close?.()
      ctx = null
      master = null
    },
  }
}
