import type { SectorConfig } from '../../engine/types'

// Sector aún sin escena: ver alpha/index.ts para activarlo.
const epsilon: SectorConfig = {
  id: 'epsilon',
  symbol: 'ε',
  name: 'Sector ε',
  description: 'Un sector del borde de la región. Aún sin explorar en esta demostración.',
  order: 3,
  selector: { x: 45, y: 65, size: 10, colors: ['#b9f0d0', '#1d5b45'] },
}

export default epsilon
