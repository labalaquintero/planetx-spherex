/**
 * Posición de la cámara de persecución respecto a la nave, en el marco del rumbo de la nave: el punto
 * base (0, up, back) gira con el cabeceo de la dirección de vuelo. Con cabeceo 0 es exactamente la
 * cámara de siempre; con el morro arriba, la cámara baja detrás de la nave y la sigue viendo igual.
 */
export function orbitOffset(up: number, back: number, l: { yaw: number; pitch: number }): [number, number, number] {
  const y1 = up * Math.cos(l.pitch) - back * Math.sin(l.pitch)
  const z1 = up * Math.sin(l.pitch) + back * Math.cos(l.pitch)
  return [z1 * Math.sin(l.yaw), y1, z1 * Math.cos(l.yaw)]
}

/** Radianes por píxel al dirigir la nave con clic derecho y arrastrar. */
export const STEER_SENSITIVITY = 0.0028
