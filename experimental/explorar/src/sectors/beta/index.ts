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
  selector: { x: 64, y: 35, size: 11, colors: ['#8fc2ff', '#1c3f78'] },
  scene: { startId: 'entry', waypoints: WAYPOINTS, objects: OBJECTS },
}

export default beta
