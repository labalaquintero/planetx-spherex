import type { SectorConfig } from '../engine/types'

/**
 * Registro de sectores: cada carpeta `src/sectors/<id>/index.ts` con una exportación por defecto
 * `SectorConfig` se descubre sola. Añadir o activar un sector no exige tocar el motor ni este archivo.
 */
const modules = import.meta.glob<{ default: SectorConfig }>('./*/index.ts', { eager: true })

export const SECTORS: readonly SectorConfig[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order)

export function getSector(id: string): SectorConfig | undefined {
  return SECTORS.find((s) => s.id === id)
}
