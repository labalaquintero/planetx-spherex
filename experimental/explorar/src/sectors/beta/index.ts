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
  scene: { startId: 'entry', waypoints: WAYPOINTS, objects: OBJECTS },
}

export default beta
