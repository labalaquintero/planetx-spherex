/**
 * Cámara de persecución: detrás y por encima de la nave, mirando un poco hacia abajo. La nave queda
 * en el tercio inferior de la pantalla, mirando al frente. El punto de salida de β se define con
 * esta misma cámara, así la primera vista conserva la composición del boceto.
 */
export const CHASE = {
  /** Posición de la cámara respecto a la nave (coordenadas de la nave: +Z es atrás). */
  up: 2.5,
  back: 8,
  /** Cabeceo de la cámara (grados, negativo = mira hacia abajo). */
  pitchDeg: -6,
  /** Escala de la nave. */
  shipScale: 0.7,
  /** Suavizado del seguimiento (vida media, ms). */
  posHalfLifeMs: 90,
  yawHalfLifeMs: 140,
  /** Aumento de FOV a velocidad máxima (grados). */
  speedFovDeg: 9,
} as const
