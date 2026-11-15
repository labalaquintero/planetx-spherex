import type { Bounds } from './flight'
import type { Vec3 } from './types'

export interface MapFrame {
  /** Tamaño del mapa en px (cuadrado). */
  readonly size: number
  readonly padding: number
  readonly bounds: Bounds
}

/**
 * Vista cenital: X a la derecha, -Z (adelante) hacia arriba. Conserva la proporción del área y la
 * centra en el cuadrado del mapa.
 */
export function mapScale(f: MapFrame): number {
  const w = f.bounds.max[0] - f.bounds.min[0]
  const d = f.bounds.max[2] - f.bounds.min[2]
  return (f.size - 2 * f.padding) / Math.max(w, d, 1e-9)
}

export function toMap(p: Vec3, f: MapFrame): { x: number; y: number } {
  const k = mapScale(f)
  const w = (f.bounds.max[0] - f.bounds.min[0]) * k
  const d = (f.bounds.max[2] - f.bounds.min[2]) * k
  const ox = (f.size - w) / 2
  const oy = (f.size - d) / 2
  return { x: ox + (p[0] - f.bounds.min[0]) * k, y: oy + (p[2] - f.bounds.min[2]) * k }
}

/** Rectángulo del área visitable en el mapa. */
export function boundsRect(f: MapFrame): { x: number; y: number; w: number; h: number } {
  const a = toMap(f.bounds.min, f)
  const b = toMap(f.bounds.max, f)
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
}

/** Altura relativa 0 (suelo del área) .. 1 (techo). */
export function altitude01(p: Vec3, b: Bounds): number {
  return Math.min(1, Math.max(0, (p[1] - b.min[1]) / (b.max[1] - b.min[1])))
}

/** Ángulo de la flecha de la nave en el mapa (grados, horario desde arriba). Rumbo 0 = arriba. */
export function headingDeg(yaw: number): number {
  return -(yaw * 180) / Math.PI
}
