/**
 * Mirada libre con clic derecho: la cámara de persecución gira alrededor de la nave (rumbo y
 * altura) sin cambiar el vuelo. Al soltar, tras una pausa, vuelve sola detrás de la nave.
 */
export interface Look {
  /** Giro horizontal respecto a detrás de la nave (rad, positivo = a la izquierda). */
  yaw: number
  /** Giro vertical (rad, positivo = mirar hacia arriba). */
  pitch: number
  dragging: boolean
  /** Tiempo (ms) desde que se soltó el botón. */
  idleMs: number
}

export const LOOK = {
  /** Radianes por píxel de arrastre. */
  sensitivity: 0.005,
  minPitch: (-30 * Math.PI) / 180,
  maxPitch: (55 * Math.PI) / 180,
  /** Pausa antes de volver detrás de la nave, y vida media del regreso. */
  holdMs: 1200,
  returnHalfLifeMs: 450,
} as const

export function newLook(): Look {
  return { yaw: 0, pitch: 0, dragging: false, idleMs: 0 }
}

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Aplica un arrastre del ratón (px). Arrastrar a la derecha mira a la derecha; arriba, mira arriba. */
export function dragLook(l: Look, dxPx: number, dyPx: number): Look {
  if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) return l
  return {
    ...l,
    yaw: wrapPi(l.yaw - dxPx * LOOK.sensitivity),
    pitch: Math.min(LOOK.maxPitch, Math.max(LOOK.minPitch, l.pitch - dyPx * LOOK.sensitivity)),
    idleMs: 0,
  }
}

/** Avanza el tiempo: si no se arrastra y pasó la pausa, vuelve suavemente a (0, 0). */
export function relaxLook(l: Look, dtMs: number): Look {
  if (l.dragging || !(dtMs > 0)) return l
  const idleMs = l.idleMs + dtMs
  if (idleMs < LOOK.holdMs) return { ...l, idleMs }
  const k = Math.pow(0.5, dtMs / LOOK.returnHalfLifeMs)
  const yaw = Math.abs(l.yaw * k) < 1e-4 ? 0 : l.yaw * k
  const pitch = Math.abs(l.pitch * k) < 1e-4 ? 0 : l.pitch * k
  return { ...l, yaw, pitch, idleMs }
}

/**
 * Desplazamiento de la cámara respecto a la nave (en el marco del rumbo de la nave) para una mirada:
 * el punto base (0, up, back) gira alrededor de la nave. Con mirada (0, 0) es exactamente el de la
 * cámara de persecución normal.
 */
export function orbitOffset(up: number, back: number, l: Pick<Look, 'yaw' | 'pitch'>): [number, number, number] {
  // Mirar arriba baja la cámara (gira alrededor del eje lateral de la nave).
  const y1 = up * Math.cos(l.pitch) - back * Math.sin(l.pitch)
  const z1 = up * Math.sin(l.pitch) + back * Math.cos(l.pitch)
  // Luego gira alrededor del eje vertical.
  return [z1 * Math.sin(l.yaw), y1, z1 * Math.cos(l.yaw)]
}
