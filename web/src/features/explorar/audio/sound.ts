import { DIVE } from '../engine/dive'
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
  /** Escaneo de un planeta: barrido ascendente con tics y dos notas al terminar. */
  scan(): void
  /** Travesía de un planeta gaseoso: acelerón, rugido dentro de las nubes y estallido al salir (≈6 s). */
  dive(): void
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
    // Limitador suave a la salida: con muchas capas a la vez (la travesía) no satura ni distorsiona.
    if (typeof ctx.createDynamicsCompressor === 'function') {
      const lim = ctx.createDynamicsCompressor()
      lim.threshold.value = -10
      lim.knee.value = 8
      lim.ratio.value = 6
      lim.attack.value = 0.004
      lim.release.value = 0.25
      master.connect(lim).connect(ctx.destination)
    } else {
      master.connect(ctx.destination)
    }
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

  const swoosh = (duration: number, from: number, peak: number, level: number, at = 0) => {
    if (!on || !ctx || !master || !noise) return
    const t = ctx.currentTime + at
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

  // --- Utilidades para la travesía (capas sincronizadas con DIVE) ---
  // Reverberación de sala grande: respuesta al impulso sintética (ruido con caída), creada una vez.
  let reverb: GainNode | null = null
  const getReverb = (): GainNode => {
    if (reverb) return reverb
    const c = ctx!
    const wet = c.createGain()
    wet.gain.value = 0.55
    if (typeof c.createConvolver === 'function') {
      const conv = c.createConvolver()
      const len = Math.floor(c.sampleRate * 2.8)
      const ir = c.createBuffer(2, len, c.sampleRate)
      let seed = 777
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch)
        for (let i = 0; i < len; i++) {
          seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
          d[i] = ((seed / 4294967296) * 2 - 1) * Math.pow(1 - i / len, 3.2)
        }
      }
      conv.buffer = ir
      wet.connect(conv).connect(master!)
    } else {
      wet.connect(master!)
    }
    reverb = wet
    return wet
  }
  /** Manda una capa a la mezcla directa y, con `wet`, a la reverberación. */
  const out = (node: AudioNode, wet: number) => {
    node.connect(master!)
    const send = ctx!.createGain()
    send.gain.value = wet
    node.connect(send).connect(getReverb())
  }
  /** Envolvente: sube a `peak` en `attack`, se mantiene `hold` y cae en `release` (segundos, desde `at`). */
  const env = (g: GainNode, at: number, attack: number, peak: number, hold: number, release: number) => {
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + Math.max(0.003, attack))
    g.gain.setValueAtTime(peak, at + Math.max(0.003, attack) + Math.max(0, hold))
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.003, attack) + Math.max(0, hold) + Math.max(0.02, release))
  }
  const noiseFrom = (at: number, dur: number) => {
    const src = ctx!.createBufferSource()
    src.buffer = noise
    src.loop = true
    src.start(at)
    src.stop(at + dur + 0.1)
    return src
  }
  const tone = (type: OscillatorType, freq: number, at: number, dur: number) => {
    const o = ctx!.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    o.start(at)
    o.stop(at + dur + 0.1)
    return o
  }
  const filter = (type: BiquadFilterType, freq: number, q = 1) => {
    const f = ctx!.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    return f
  }
  /** Estallido: caída grave de tono y trueno de ruido que se cierra. */
  const boom = (at: number, level: number) => {
    const o = tone('sine', 140, at, 1.6)
    o.frequency.exponentialRampToValueAtTime(32, at + 1.2)
    const g = ctx!.createGain()
    env(g, at, 0.012, level, 0.05, 1.4)
    o.connect(g)
    out(g, 0.6)
    const lp = filter('lowpass', 1800)
    lp.frequency.setValueAtTime(1800, at)
    lp.frequency.exponentialRampToValueAtTime(140, at + 1.3)
    const gn = ctx!.createGain()
    env(gn, at, 0.01, level * 0.7, 0.03, 1.3)
    noiseFrom(at, 1.6).connect(lp).connect(gn)
    out(gn, 0.7)
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
    dive() {
      if (!on || !ctx || !master || !noise) return
      const t = ctx.currentTime
      const T = DIVE.seconds
      const tIn = t + DIVE.enterAt * T
      const tOut = t + DIVE.exitAt * T
      const tEnd = t + T

      // 1) Aproximación: los motores cargan (tres sierras que suben de tono con el filtro abriéndose)…
      for (const f0 of [82, 82.6, 164.4]) {
        const o = tone('sawtooth', f0, t, tIn - t + 0.3)
        o.frequency.exponentialRampToValueAtTime(f0 * 2.2, tIn)
        const lp = filter('lowpass', 300)
        lp.frequency.setValueAtTime(300, t)
        lp.frequency.exponentialRampToValueAtTime(2600, tIn)
        const g = ctx.createGain()
        env(g, t, tIn - t - 0.05, 0.05, 0.05, 0.35)
        o.connect(lp).connect(g)
        out(g, 0.25)
      }
      // …y un siseo que sube hasta estallar al entrar.
      {
        const bp = filter('bandpass', 300, 1.4)
        bp.frequency.setValueAtTime(300, t)
        bp.frequency.exponentialRampToValueAtTime(4200, tIn)
        const g = ctx.createGain()
        env(g, t, tIn - t, 0.16, 0, 0.12)
        noiseFrom(t, tIn - t + 0.2).connect(bp).connect(g)
        out(g, 0.4)
      }

      // 2) Entrada: estallido grave con trueno.
      boom(tIn, 0.5)

      // 3) Dentro: rugido de viento turbulento (con trémolo), aullido que oscila y acorde grave en quinta.
      {
        const dur = tOut - tIn + 0.4
        const lp = filter('lowpass', 420)
        const g = ctx.createGain()
        env(g, tIn, 0.25, 0.32, dur - 0.65, 0.4)
        const lfo = tone('sine', 7, tIn, dur)
        const depth = ctx.createGain()
        depth.gain.value = 0.12
        lfo.connect(depth).connect(g.gain)
        noiseFrom(tIn, dur).connect(lp).connect(g)
        out(g, 0.35)

        const bp = filter('bandpass', 420, 9)
        bp.frequency.setValueAtTime(420, tIn)
        bp.frequency.linearRampToValueAtTime(900, tIn + dur * 0.45)
        bp.frequency.linearRampToValueAtTime(380, tIn + dur)
        const g2 = ctx.createGain()
        env(g2, tIn, 0.4, 0.14, dur - 0.9, 0.5)
        noiseFrom(tIn, dur).connect(bp).connect(g2)
        out(g2, 0.6)

        for (const f of [55, 82.4, 110]) {
          const o = tone('sawtooth', f, tIn, dur)
          const g3 = ctx.createGain()
          env(g3, tIn, 0.8, 0.045, dur - 1.3, 0.5)
          o.connect(filter('lowpass', 340)).connect(g3)
          out(g3, 0.5)
        }
      }
      // Truenos secos en cada relámpago (los mismos instantes que la imagen).
      for (const u of DIVE.flashes) {
        const at = t + u * T
        const g = ctx.createGain()
        env(g, at, 0.004, 0.22, 0.02, 0.5)
        noiseFrom(at, 0.7).connect(filter('highpass', 900)).connect(g)
        out(g, 0.8)
        const o = tone('sine', 70, at, 0.6)
        o.frequency.exponentialRampToValueAtTime(38, at + 0.5)
        const go = ctx.createGain()
        env(go, at, 0.01, 0.3, 0.02, 0.5)
        o.connect(go)
        out(go, 0.5)
      }

      // 4) Salida: ráfaga que baja, golpe y acorde mayor brillante que se abre, con un destello agudo.
      {
        const bp = filter('bandpass', 5200, 1.2)
        bp.frequency.setValueAtTime(5200, tOut - 0.15)
        bp.frequency.exponentialRampToValueAtTime(260, tOut + 1.3)
        const g = ctx.createGain()
        env(g, tOut - 0.15, 0.12, 0.3, 0.1, 1.2)
        noiseFrom(tOut - 0.15, 1.6).connect(bp).connect(g)
        out(g, 0.5)
      }
      boom(tOut, 0.42)
      const chord = tEnd - tOut + 1.2
      for (const f of [220, 277.2, 329.6, 440]) {
        const o = tone('triangle', f, tOut, chord)
        const g = ctx.createGain()
        env(g, tOut, 0.35, 0.05, 0.6, chord - 1)
        o.connect(g)
        out(g, 0.7)
      }
      for (const [f, d] of [
        [1318.5, 0],
        [1760, 0.12],
        [2637, 0.24],
      ] as const) {
        blip(f, tOut - t + 0.5 + d, 1.4, 0.03)
      }
    },
    scan() {
      if (!on || !ctx || !master) return
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(280, t)
      o.frequency.exponentialRampToValueAtTime(1500, t + 1.4)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.15)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5)
      o.connect(g).connect(master)
      o.start(t)
      o.stop(t + 1.55)
      for (let i = 0; i < 6; i++) blip(1760, 0.1 + i * 0.22, 0.05, 0.04)
      blip(990, 1.62, 0.16, 0.1)
      blip(1320, 1.76, 0.26, 0.09)
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
