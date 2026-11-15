import { aimAt } from '../../engine/projection'
import type { SectorConfig, Waypoint } from '../../engine/types'
import { selectorFromSketch } from '../selector'
import { ENTRY_CAMERA, OBJECTS } from './objects'
import { WAYPOINTS } from './waypoints'

/**
 * Los miradores laterales miran a su objeto (focusId): como las posiciones salen del boceto, su
 * orientación se calcula para que el objeto quede arriba en pantalla, donde la nave no lo tapa.
 * La entrada y el corredor central miran al frente, como en el boceto.
 */
const AIMED = new Set(['izq', 'der', 'izq_f', 'der_f'])
const ROUTE: readonly Waypoint[] = WAYPOINTS.map((w) => {
  const focus = OBJECTS.find((o) => o.id === w.focusId)
  if (!AIMED.has(w.id) || !focus) return w
  const screen = { u: w.position[0] < 0 ? 0.42 : 0.58, v: 0.3 }
  return { ...w, ...aimAt(w.position, focus.position, screen, ENTRY_CAMERA.fovDeg, ENTRY_CAMERA.aspect) }
})

const beta: SectorConfig = {
  id: 'beta',
  symbol: 'β',
  name: 'Sector β',
  description:
    'Un cúmulo con dos planetas grandes, un planeta con anillo y una estación orbital. Representación ilustrativa.',
  order: 2,
  selector: { ...selectorFromSketch('beta'), colors: ['#bae6fd', '#0c3a66'], surface: 'bands', seed: 12, glow: 'rgba(56, 189, 248, 0.6)' },
  scene: {
    startId: 'entry',
    waypoints: ROUTE,
    objects: OBJECTS,
    // Más cuerpos pequeños como los del boceto, repartidos por el sector y lejos de la ruta.
    field: {
      seed: 4242,
      count: 40,
      center: [0, 10, -150],
      extent: [190, 70, 140],
      minRadius: 0.7,
      maxRadius: 3.2,
      clearance: 14,
      palette: ['#9a9083', '#6b6358', '#3d3832'],
    },
  },
}

export default beta
