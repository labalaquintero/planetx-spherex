import { useCallback, useState } from 'react'
import './explorar.css'
import { NavigationScreen } from './screens/NavigationScreen'
import { SectorSelect } from './screens/SectorSelect'
import { SECTORS, getSector } from './sectors'

export interface ExplorarProps {
  /** Clase extra para el contenedor (el componente rellena el tamaño de su contenedor). */
  className?: string
}

/**
 * Extra «Explorar»: selección de sector y navegación en nave.
 * Se dimensiona al 100 % de su contenedor y no hace llamadas de red.
 */
export function Explorar({ className }: ExplorarProps) {
  const [sectorId, setSectorId] = useState<string | null>(null)
  const sector = sectorId ? getSector(sectorId) : undefined
  const exit = useCallback(() => setSectorId(null), [])

  return (
    <div className={className ? `explorar ${className}` : 'explorar'}>
      {sector?.scene ? (
        <NavigationScreen key={sector.id} sector={{ ...sector, scene: sector.scene }} onExit={exit} />
      ) : (
        <SectorSelect sectors={SECTORS} onEnter={setSectorId} />
      )}
    </div>
  )
}
