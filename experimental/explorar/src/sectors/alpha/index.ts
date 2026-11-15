import type { SectorConfig } from '../../engine/types'

// Sector aún sin escena: solo se muestra como «Próximamente».
// Para activarlo basta con añadir `scene` (puntos de ruta y objetos) a esta configuración.
const alpha: SectorConfig = {
  id: 'alpha',
  symbol: 'α',
  name: 'Sector α',
  description: 'Un sector cercano de la región. Aún sin explorar en esta demostración.',
  order: 1,
  selector: { x: 31, y: 26, size: 9, colors: ['#ffd9a0', '#7a4a1c'] },
}

export default alpha
