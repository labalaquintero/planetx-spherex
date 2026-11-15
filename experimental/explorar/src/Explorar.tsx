import { useState } from 'react'
import './explorar.css'
import { SECTORS, getSector } from './sectors'
import { SectorSelect } from './screens/SectorSelect'

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

  return (
    <div className={className ? `explorar ${className}` : 'explorar'}>
      {sector?.scene ? (
        <p className="ex-sr-only">Navegación en {sector.name}</p>
      ) : (
        <SectorSelect sectors={SECTORS} onEnter={setSectorId} />
      )}
    </div>
  )
}
