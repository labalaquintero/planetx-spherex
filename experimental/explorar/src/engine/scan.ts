import type { SceneObject } from './types'

/**
 * Escaneo de un planeta (tecla R cerca de él): qué se puede escanear, la lectura que se muestra y el giro
 * del modelo al arrastrarlo. Lógica pura y probada; la vista 3D vive en scene/ScanView.tsx.
 */

/** Tipos que se escanean: los cuerpos grandes con nombre (planetas, planetas con anillo y esferas). */
const SCANNABLE: ReadonlySet<SceneObject['kind']> = new Set(['planet', 'ringedPlanet', 'sphere'])

export function canScan(o: SceneObject | undefined | null): o is SceneObject {
  return Boolean(o && o.label && SCANNABLE.has(o.kind))
}

/** Duración del barrido inicial del escaneo (ms). */
export const SCAN_MS = 1600

/** Progreso del barrido 0..1 con salida suave. */
export function scanProgress(ms: number): number {
  const t = Math.min(1, Math.max(0, ms / SCAN_MS))
  return 1 - (1 - t) ** 3
}

/** Etapa que se anuncia durante el barrido. */
export function scanStage(progress: number): string {
  if (progress >= 1) return 'Escaneo completo'
  if (progress < 0.34) return 'Midiendo la forma…'
  if (progress < 0.67) return 'Leyendo la superficie…'
  return 'Analizando la atmósfera…'
}

export interface ScanRow {
  readonly label: string
  readonly value: string
}

const KIND: Partial<Record<SceneObject['kind'], string>> = {
  planet: 'Planeta',
  ringedPlanet: 'Planeta con anillo',
  sphere: 'Luna',
}
const SURFACE = { bands: 'Bandas de nubes', rocky: 'Rocosa', storms: 'Tormentas' } as const

/** Lectura del escaneo: lo que la escena sabe del objeto (unidades de la escena, «u»). */
export function scanReadout(o: SceneObject, distance: number): ScanRow[] {
  const rows: ScanRow[] = [
    { label: 'Tipo', value: KIND[o.kind] ?? 'Cuerpo' },
    { label: 'Diámetro', value: `${Math.round(o.radius * 2)} u` },
    { label: 'Distancia', value: `${Math.round(Math.max(0, distance))} u` },
    { label: 'Superficie', value: SURFACE[o.surface ?? 'rocky'] },
    { label: 'Atmósfera', value: o.atmosphere ? 'Sí' : 'No detectada' },
    { label: 'Anillo', value: o.ring ? 'Sí' : 'No' },
  ]
  const source = o.info?.images[0]?.caption
  rows.push({ label: 'Mapa de origen', value: source ?? 'Superficie generada por la nave' })
  return rows
}

/** Giro del modelo: velocidades angulares (rad/s) alrededor de los ejes de la pantalla. */
export interface Turn {
  readonly vx: number
  readonly vy: number
  /** Segundos desde el último arrastre (para volver al giro automático). */
  readonly idle: number
}

export const TURN = {
  /** Radianes por píxel arrastrado. */
  sensitivity: 0.008,
  /** Frenado de la inercia (1/s) y velocidad máxima que deja un arrastre rápido (rad/s). */
  damping: 4,
  maxSpin: 6,
  /** Giro automático cuando nadie lo toca (rad/s) y tras cuántos segundos vuelve. */
  auto: 0.18,
  autoAfter: 2.5,
} as const

export const STILL: Turn = { vx: 0, vy: 0, idle: TURN.autoAfter }

/**
 * Arrastre de `dx`, `dy` píxeles en `dt` segundos: el modelo gira con el puntero (dx → alrededor del eje
 * vertical de la pantalla, dy → del horizontal). Devuelve el giro que aplicar ahora y la inercia.
 */
export function dragTurn(dx: number, dy: number, dt: number): { yaw: number; pitch: number; turn: Turn } {
  const yaw = dx * TURN.sensitivity
  const pitch = dy * TURN.sensitivity
  const k = dt > 0 ? 1 / Math.max(dt, 1 / 120) : 0
  const cap = (v: number) => Math.max(-TURN.maxSpin, Math.min(TURN.maxSpin, v))
  return { yaw, pitch, turn: { vx: cap(pitch * k), vy: cap(yaw * k), idle: 0 } }
}

/** Sin arrastre: la inercia se apaga y, tras un rato quieto, vuelve el giro automático lento. */
export function relaxTurn(t: Turn, dt: number): { yaw: number; pitch: number; turn: Turn } {
  const f = Math.exp(-TURN.damping * dt)
  const idle = t.idle + dt
  const auto = idle >= TURN.autoAfter ? TURN.auto : 0
  return { yaw: (t.vy + auto) * dt, pitch: t.vx * dt, turn: { vx: t.vx * f, vy: t.vy * f, idle } }
}
