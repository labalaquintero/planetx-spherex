import type { Vec3 } from '../engine/types'

/** Campo de visión vertical de la escena y relación de aspecto de referencia (boceto, 16:9). */
export const REFERENCE_FOV_DEG = 50
const ASPECT = 16 / 9

/**
 * Coloca un objeto de modo que, visto desde el punto de entrada (origen, mirando a -Z), caiga
 * en la posición de pantalla indicada (ndc: x e y en [-1, 1], y positivo hacia arriba) a una
 * distancia `depth`. Sirve para reproducir la composición del boceto sin cálculos a mano.
 */
export function fromView(ndcX: number, ndcY: number, depth: number): Vec3 {
  const halfH = depth * Math.tan((REFERENCE_FOV_DEG / 2) * (Math.PI / 180))
  return [round(ndcX * halfH * ASPECT), round(ndcY * halfH), -depth]
}

const round = (v: number): number => Math.round(v * 10) / 10
