import type { SectorConfig } from '../../engine/types'

// Sector aún sin escena: solo se muestra como «Próximamente».
// Para activarlo basta con añadir `scene` (puntos de ruta y objetos) a esta configuración.
const alpha: SectorConfig = {
  id: 'alpha',
  symbol: 'α',
  name: 'Sector α',
  description: 'Un sector cercano de la región. Aún sin explorar en esta demostración.',
  order: 1,
  selector: { x: 31, y: 30, size: 13, colors: ['#e8c8a0', '#5a3a22'], surface: 'rocky', seed: 5, glow: 'rgba(251, 191, 140, 0.45)' },
}

export default alpha
