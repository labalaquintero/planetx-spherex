import type { Waypoint } from '../../engine/types'

/**
 * Ruta corta en cruz (α es un sector «de observación»: pocos puntos y mucho campo abierto).
 *
 *            far
 *             │
 *   izq ──  mid  ── der
 *             │
 *           entry
 *
 * Vínculos de ida y vuelta (A.forward = B ⇒ B.back = A; A.left = B ⇒ B.right = A). La orientación de
 * los miradores laterales se calcula en index.ts para que miren a su fuente.
 */
export const WAYPOINTS: readonly Waypoint[] = [
  {
    id: 'entry',
    focusId: 'f01',
    name: 'Entrada del sector',
    position: [0, 0, 0],
    yawDeg: 0,
    // Cabeceo de la cámara de persecución (scene/chase.ts): la primera vista es la del recorte.
    pitchDeg: -6,
    links: { forward: 'mid' },
  },
  {
    id: 'mid',
    focusId: 'f03',
    name: 'Centro del campo',
    position: [0, 0, -45],
    yawDeg: 0,
    pitchDeg: 2,
    links: { back: 'entry', forward: 'far', left: 'izq', right: 'der' },
  },
  {
    id: 'izq',
    focusId: 'f01',
    name: 'Mirador de la fuente principal',
    position: [-30, 6, -50],
    yawDeg: 0,
    pitchDeg: 0,
    links: { right: 'mid' },
  },
  {
    id: 'der',
    focusId: 'f02',
    name: 'Mirador del anillo',
    position: [30, -2, -50],
    yawDeg: 0,
    pitchDeg: 0,
    links: { left: 'mid' },
  },
  {
    id: 'far',
    focusId: 'f04',
    name: 'Fondo del campo',
    position: [0, 0, -95],
    yawDeg: 0,
    pitchDeg: -2,
    links: { back: 'mid' },
  },
]
