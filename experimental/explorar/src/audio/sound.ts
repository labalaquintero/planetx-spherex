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
  /** Tic suave al señalar una región en la selección. */
  hover(): void
  /** Paso de un visitante: «fiu» corto de estrella fugaz, soplo largo de cometa, roce grave de asteroide. */
  visitor(kind: 'comet' | 'meteor' | 'asteroid'): void
  dispose(): void
}

/**
 * Niveles del motor según el empuje (0..1). Las bocinas de laptop casi no reproducen por debajo de
 * ~150 Hz: el zumbido usa armónicos audibles y un siseo de empuje que sí se oye.
 */
export function engineMix(level: number): { pitch: number; cutoff: number; drone: number; air: number; airFreq: number } {
  const k = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0))
  return { pitch: 1 + 0.55 * k, cutoff: 520 + 1300 * k, drone: 0.09 + 0.09 * k, air: 0.018 + 0.1 * k, airFreq: 420 + 1100 * k }
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
  let droneFilter: BiquadFilterNode | null = null
  let droneGain: GainNode | null = null
  let air: AudioBufferSourceNode | null = null
  let airFilter: BiquadFilterNode | null = null
  let airGain: GainNode | null = null
  let on = false
  const HUM_BASE = [82, 82.7, 164]

  const ensure = (): Ctx | null => {
    if (ctx) return ctx
    ctx = factory()
    if (!ctx) return null
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    noise = noiseBuffer(ctx, 1.5)
    const idle = engineMix(0)
    // Zumbido del motor: dos sierras desafinadas y una cuadrada una octava arriba, por un paso bajo
    // que se abre con el empuje.
    droneFilter = ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = idle.cutoff
    droneGain = ctx.createGain()
    droneGain.gain.value = idle.drone
    droneFilter.connect(droneGain).connect(master)
    hum = HUM_BASE.map((f, i) => {
      const o = ctx!.createOscillator()
      o.type = i === 2 ? 'square' : 'sawtooth'
      o.frequency.value = f
      o.connect(droneFilter!)
      o.start()
      return o
    })
    // Siseo de empuje: ruido en bucle por un paso banda que sube con la velocidad.
    air = ctx.createBufferSource()
    air.buffer = noise
    air.loop = true
    airFilter = ctx.createBiquadFilter()
    airFilter.type = 'bandpass'
    airFilter.Q.value = 0.8
    airFilter.frequency.value = idle.airFreq
    airGain = ctx.createGain()
    airGain.gain.value = idle.air
    air.connect(airFilter).connect(airGain).connect(master)
    air.start()
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
  }

  /** Nota corta (sinusoide con ataque y caída). */
  const blip = (freq: number, at: number, duration: number, level: number) => {
    if (!on || !ctx || !master) return
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(freq, t)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(level, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + duration + 0.05)
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
        master.gain.setTargetAtTime(0.6, c.currentTime, 0.08)
        // Confirmación audible: dos notas ascendentes.
        blip(660, 0.05, 0.18, 0.14)
        blip(990, 0.16, 0.26, 0.12)
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
      const m = engineMix(level)
      const t = ctx.currentTime
      hum.forEach((o, i) => o.frequency.setTargetAtTime(HUM_BASE[i]! * m.pitch, t, 0.15))
      droneFilter?.frequency.setTargetAtTime(m.cutoff, t, 0.15)
      droneGain?.gain.setTargetAtTime(m.drone, t, 0.15)
      airFilter?.frequency.setTargetAtTime(m.airFreq, t, 0.2)
      airGain?.gain.setTargetAtTime(m.air, t, 0.2)
    },
    hover() {
      blip(1320, 0, 0.09, 0.06)
    },
    visitor(kind) {
      if (kind === 'meteor') swoosh(0.55, 1400, 5200, 0.09)
      else if (kind === 'comet') swoosh(2.6, 300, 1600, 0.12)
      else swoosh(1.4, 150, 520, 0.1)
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
      air?.stop()
      air = null
      void ctx?.close?.()
      ctx = null
      master = null
    },
  }
}
