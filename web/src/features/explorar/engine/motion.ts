import { easeInOutCubic } from './easing'
import { SHIP } from './shipSpec'

/**
 * Acerca `current` a `target` con decaimiento exponencial independiente de los FPS:
 * tras `halfLifeMs` queda la mitad de la distancia.
 */
export function approach(current: number, target: number, dtMs: number, halfLifeMs: number): number {
  if (halfLifeMs <= 0) return target
  const k = 1 - Math.pow(0.5, Math.max(0, dtMs) / halfLifeMs)
  return current + (target - current) * k
}

/** Duración del salto entre la selección y el sector, y del desvanecimiento con movimiento reducido. */
export const JUMP_MS = 1100
export const FADE_MS = 280
/** Duración de la llegada suave de la cámara al primer punto de ruta. */
export const ARRIVAL_MS = 1500

export interface JumpFrame {
  /** 0..1: longitud de las rayas de estrellas. */
  readonly streak: number
  /** Factor de acercamiento del fondo (≥ 1): emula el cambio de campo de visión. */
  readonly zoom: number
  /** 0..1: destello al final del salto. */
  readonly flash: number
}

/** Estado visual del salto en el instante `ms` (0..JUMP_MS). */
export function jumpFrame(ms: number): JumpFrame {
  const t = Math.min(1, Math.max(0, ms / JUMP_MS))
  // Las rayas crecen con aceleración; el zoom sigue la misma curva.
  const accel = t * t * t
  const flash = t < 0.78 ? 0 : t >= 1 ? 1 : (t - 0.78) / 0.22
  return { streak: Math.min(1, t * 1.25) ** 2, zoom: 1 + accel * 2.2, flash }
}

/**
 * Llegada al sector: la cámara parte desde atrás con un campo de visión amplio y frena hasta el
 * primer punto. Devuelve el retroceso (unidades de escena) y el aumento de FOV (grados).
 */
export function arrivalOffset(ms: number, distance = 38, fovBoostDeg = 26): { back: number; fov: number } {
  const t = Math.min(1, Math.max(0, ms / ARRIVAL_MS))
  const k = 1 - easeInOutCubic(t)
  return { back: distance * k * k, fov: fovBoostDeg * k }
}

/** Empuje de FOV durante un desplazamiento (máximo a mitad de trayecto, 0 al salir y al llegar). */
export function fovKick(progress: number, maxDeg = 7): number {
  const t = Math.min(1, Math.max(0, progress))
  return maxDeg * Math.sin(Math.PI * t)
}

/**
 * Ajuste de cámara y nave según la relación de aspecto. En horizontal se conserva el encuadre del
 * boceto (FOV vertical 50°). En vertical se mantiene el FOV horizontal de un 16:9 hasta un tope,
 * y la nave se reduce y baja para no tapar la escena.
 */
export interface CameraFit {
  readonly fovDeg: number
  readonly shipScale: number
  readonly shipY: number
  readonly shipZ: number
}

export const BASE_FOV_DEG = 50
const REF_ASPECT = 16 / 9

export function cameraFit(aspect: number): CameraFit {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : REF_ASPECT
  // Encuadre horizontal de la nave: el ajustado a la silueta del boceto (layout.json).
  if (a >= 1.2) return { fovDeg: BASE_FOV_DEG, shipScale: SHIP.scale, shipY: SHIP.y, shipZ: SHIP.z }
  // FOV horizontal del encuadre de referencia, convertido al vertical para este aspecto.
  const hfov = 2 * Math.atan(Math.tan((BASE_FOV_DEG * Math.PI) / 360) * REF_ASPECT)
  const vfov = (2 * Math.atan(Math.tan(hfov / 2) / a) * 180) / Math.PI
  const fovDeg = Math.min(92, Math.max(BASE_FOV_DEG, vfov))
  const t = Math.min(1, Math.max(0, (1.2 - a) / 0.7)) // 0 en 1.2 → 1 en 0.5
  return {
    fovDeg,
    shipScale: SHIP.scale * (1 - 0.32 * t),
    shipY: SHIP.y - 0.9 * t,
    shipZ: SHIP.z - 0.6 * t,
  }
}

/**
 * Empuje del motor (0..1) para la estela: en reposo, un ralentí; al avanzar, máximo a mitad de
 * trayecto; laterales y retroceso, intermedios.
 */
export function thrust(direction: 'forward' | 'back' | 'left' | 'right' | null, progress: number): number {
  const IDLE = 0.3
  if (direction === null) return IDLE
  const peak = direction === 'forward' ? 1 : direction === 'back' ? 0.45 : 0.7
  return IDLE + (peak - IDLE) * Math.sin(Math.PI * Math.min(1, Math.max(0, progress)))
}
