import type { SectorConfig } from '../../engine/types'

// Sector aún sin escena: ver alpha/index.ts para activarlo.
const epsilon: SectorConfig = {
  id: 'epsilon',
  symbol: 'ε',
  name: 'Sector ε',
  description: 'Un sector del borde de la región. Aún sin explorar en esta demostración.',
  order: 3,
  selector: { x: 46, y: 70, size: 12, colors: ['#c7e8d4', '#1d4a3c'], surface: 'rocky', seed: 21, glow: 'rgba(134, 239, 172, 0.4)' },
}

export default epsilon
