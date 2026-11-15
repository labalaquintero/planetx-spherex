import type { Vec3 } from './types'

/**
 * Cámara de un punto de ruta, igual que la del Rig: en la posición del punto, girada por yaw
 * (eje Y) y luego pitch (eje X), mirando a -Z. Pantalla normalizada: u a la derecha, v hacia abajo.
 */
export interface ViewCamera {
  readonly position: Vec3
  readonly yawDeg: number
  readonly pitchDeg: number
  /** FOV vertical en grados. */
  readonly fovDeg: number
  readonly aspect: number
}

/** Pantalla de referencia para la composición del boceto: 16:9 (la de una laptop a pantalla completa). */
export const REFERENCE_ASPECT = 16 / 9

const D = Math.PI / 180

function rotate(v: Vec3, yawDeg: number, pitchDeg: number): Vec3 {
  // Euler 'YXZ' (como en el Rig): primero pitch en X, luego yaw en Y.
  const cp = Math.cos(pitchDeg * D)
  const sp = Math.sin(pitchDeg * D)
  const y1 = v[1] * cp - v[2] * sp
  const z1 = v[1] * sp + v[2] * cp
  const cy = Math.cos(yawDeg * D)
  const sy = Math.sin(yawDeg * D)
  return [v[0] * cy + z1 * sy, y1, -v[0] * sy + z1 * cy]
}

function unrotate(v: Vec3, yawDeg: number, pitchDeg: number): Vec3 {
  const cy = Math.cos(yawDeg * D)
  const sy = Math.sin(yawDeg * D)
  const x1 = v[0] * cy - v[2] * sy
  const z1 = v[0] * sy + v[2] * cy
  const cp = Math.cos(pitchDeg * D)
  const sp = Math.sin(pitchDeg * D)
  return [x1, v[1] * cp + z1 * sp, -v[1] * sp + z1 * cp]
}

/**
 * Punto del mundo que, visto desde `cam`, cae en (u, v) de la pantalla a `depth` unidades delante
 * de la cámara (profundidad medida a lo largo del eje de visión).
 */
export function screenToWorld(u: number, v: number, depth: number, cam: ViewCamera): Vec3 {
  const t = Math.tan((cam.fovDeg / 2) * D)
  const local: Vec3 = [(2 * u - 1) * t * cam.aspect * depth, (1 - 2 * v) * t * depth, -depth]
  const r = rotate(local, cam.yawDeg, cam.pitchDeg)
  return [r[0] + cam.position[0], r[1] + cam.position[1], r[2] + cam.position[2]]
}

/** Inverso de screenToWorld: (u, v) y profundidad de un punto del mundo. */
export function worldToScreen(p: Vec3, cam: ViewCamera): { u: number; v: number; depth: number } {
  const l = unrotate([p[0] - cam.position[0], p[1] - cam.position[1], p[2] - cam.position[2]], cam.yawDeg, cam.pitchDeg)
  const depth = -l[2]
  const t = Math.tan((cam.fovDeg / 2) * D)
  return { u: 0.5 + (0.5 * l[0]) / (depth * t * cam.aspect), v: 0.5 - (0.5 * l[1]) / (depth * t), depth }
}

/** Radio en el mundo de un objeto que, a `depth`, mide `diameterV` de alto de pantalla. */
export function radiusForScreenSize(diameterV: number, depth: number, fovDeg: number): number {
  return diameterV * Math.tan((fovDeg / 2) * D) * depth
}
