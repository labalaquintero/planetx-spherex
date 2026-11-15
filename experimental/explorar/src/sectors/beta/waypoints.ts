import type { Waypoint } from '../../engine/types'

/**
 * Rejilla de 3 columnas × 3 filas (la esquina trasera central es el punto de entrada).
 *
 *   izq_f  ── far  ── der_f      (fondo)
 *     │        │        │
 *   izq   ──  mid  ──  der       (medio)
 *              │
 *            entry                (entrada)
 *
 * Todos los vínculos son de ida y vuelta (A.forward = B ⇒ B.back = A; A.left = B ⇒ B.right = A).
 */
export const WAYPOINTS: readonly Waypoint[] = [
  {
    id: 'entry',
    name: 'Entrada del sector',
    position: [0, 0, 0],
    yawDeg: 0,
    pitchDeg: 4,
    links: { forward: 'mid' },
  },
  {
    id: 'mid',
    name: 'Corredor central',
    position: [0, 0, -45],
    yawDeg: 0,
    pitchDeg: 4,
    links: { back: 'entry', forward: 'far', left: 'izq', right: 'der' },
  },
  {
    id: 'izq',
    name: 'Mirador de los planetas',
    position: [-34, 4, -45],
    yawDeg: 20,
    pitchDeg: 10,
    links: { right: 'mid', forward: 'izq_f' },
  },
  {
    id: 'der',
    name: 'Mirador del anillo',
    position: [34, 3, -45],
    yawDeg: -22,
    pitchDeg: 8,
    links: { left: 'mid', forward: 'der_f' },
  },
  {
    id: 'far',
    name: 'Fondo del sector',
    position: [0, 0, -90],
    yawDeg: 0,
    pitchDeg: 3,
    links: { back: 'mid', left: 'izq_f', right: 'der_f' },
  },
  {
    id: 'izq_f',
    name: 'Junto a los planetas',
    position: [-34, 4, -90],
    yawDeg: 26,
    pitchDeg: 14,
    links: { back: 'izq', right: 'far' },
  },
  {
    id: 'der_f',
    name: 'Cerca de la estación',
    position: [34, 3, -90],
    yawDeg: -28,
    pitchDeg: -8,
    links: { back: 'der', left: 'far' },
  },
]
