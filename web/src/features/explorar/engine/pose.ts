import { easeInOutCubic, lerp, lerpAngleDeg } from './easing'
import { progress, type NavState } from './navigation'
import type { RouteGraph } from './graph'
import type { Vec3 } from './types'

/** Inclinación máxima de la nave en A/D, en grados. */
export const MAX_BANK_DEG = 14

export interface Pose {
  readonly position: Vec3
  readonly yawDeg: number
  readonly pitchDeg: number
  /** Alabeo de la nave (positivo = inclinada hacia la izquierda). */
  readonly rollDeg: number
}

/** Pose de la nave para un estado: parada en un punto, o interpolada con suavizado. */
export function poseFor(graph: RouteGraph, state: NavState): Pose {
  const t = state.transition
  const from = graph.nodes.get(t ? t.from : state.at)
  if (!from) throw new Error(`punto de ruta desconocido: ${state.at}`)
  if (!t) {
    return { position: from.position, yawDeg: from.yawDeg, pitchDeg: from.pitchDeg, rollDeg: 0 }
  }
  const to = graph.nodes.get(t.to)
  if (!to) throw new Error(`punto de ruta desconocido: ${t.to}`)

  const k = easeInOutCubic(progress(state))
  const lateral = t.direction === 'left' ? 1 : t.direction === 'right' ? -1 : 0
  return {
    position: [
      lerp(from.position[0], to.position[0], k),
      lerp(from.position[1], to.position[1], k),
      lerp(from.position[2], to.position[2], k),
    ],
    yawDeg: lerpAngleDeg(from.yawDeg, to.yawDeg, k),
    pitchDeg: lerp(from.pitchDeg, to.pitchDeg, k),
    // Sube y baja: inclinada a mitad del trayecto, recta al salir y al llegar.
    rollDeg: lateral * MAX_BANK_DEG * Math.sin(Math.PI * k),
  }
}
