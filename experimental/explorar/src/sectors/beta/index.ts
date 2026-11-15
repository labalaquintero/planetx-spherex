import type { SectorConfig } from '../../engine/types'
import { OBJECTS } from './objects'
import { WAYPOINTS } from './waypoints'

const beta: SectorConfig = {
  id: 'beta',
  symbol: 'β',
  name: 'Sector β',
  description:
    'Un cúmulo con dos planetas grandes, un planeta con anillo y una estación orbital. Representación ilustrativa.',
  order: 2,
  selector: { x: 66, y: 38, size: 17, colors: ['#bae6fd', '#0c3a66'], surface: 'bands', seed: 12, glow: 'rgba(56, 189, 248, 0.6)' },
  scene: {
    startId: 'entry',
    waypoints: WAYPOINTS,
    objects: OBJECTS,
    // Más cuerpos pequeños como los del boceto, repartidos por el sector y lejos de la ruta.
    field: {
      seed: 4242,
      count: 40,
      center: [0, 10, -150],
      extent: [190, 70, 140],
      minRadius: 0.7,
      maxRadius: 3.2,
      clearance: 7,
      palette: ['#9a9083', '#6b6358', '#3d3832'],
    },
  },
}

export default beta
