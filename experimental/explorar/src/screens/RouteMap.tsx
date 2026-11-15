import { useMemo } from 'react'
import { routeMap } from '../engine/routeMap'
import type { Waypoint } from '../engine/types'

interface Props {
  waypoints: readonly Waypoint[]
  /** Punto actual (origen si va en tránsito). */
  at: string
  /** Destino del tránsito en curso, o null. */
  movingTo: string | null
}

/** Indicador de ruta: plano cenital de los puntos, con el actual resaltado y el destino marcado. */
export function RouteMap({ waypoints, at, movingTo }: Props) {
  const map = useMemo(() => routeMap(waypoints), [waypoints])
  const pos = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map])
  const S = 100
  const current = movingTo ?? at
  const index = map.nodes.findIndex((n) => n.id === current) + 1
  const name = pos.get(current)?.name ?? ''
  return (
    <figure className="ex-route" aria-label={`Ruta: punto ${index} de ${map.nodes.length}, ${name}`}>
      <svg viewBox={`0 0 ${S} ${S}`} aria-hidden="true" focusable="false">
        {map.edges.map(([a, b]) => {
          const p = pos.get(a)!
          const q = pos.get(b)!
          const live = movingTo !== null && ((a === at && b === movingTo) || (b === at && a === movingTo))
          return <line key={`${a}-${b}`} x1={p.x * S} y1={p.y * S} x2={q.x * S} y2={q.y * S} data-live={live || undefined} />
        })}
        {map.nodes.map((n) => {
          const state = n.id === movingTo ? 'target' : n.id === at ? (movingTo ? 'origin' : 'current') : 'idle'
          return (
            <g key={n.id} data-state={state}>
              {state === 'current' && <circle className="ex-route-halo" cx={n.x * S} cy={n.y * S} r={9} />}
              <circle cx={n.x * S} cy={n.y * S} r={state === 'idle' ? 3.2 : 4.6} />
            </g>
          )
        })}
      </svg>
      <figcaption className="ex-route-caption">
        <span>Ruta</span>
        <span className="ex-route-count">
          {index}/{map.nodes.length}
        </span>
      </figcaption>
    </figure>
  )
}
