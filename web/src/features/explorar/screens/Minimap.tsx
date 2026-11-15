import { useMemo } from 'react'
import type { Bounds } from '../engine/flight'
import { altitude01, boundsRect, headingDeg, toMap, type MapFrame } from '../engine/minimap'
import type { SceneObject, Vec3 } from '../engine/types'

interface Props {
  bounds: Bounds
  objects: readonly SceneObject[]
  position: Vec3
  yaw: number
  /** 0..1: cercanía al borde del área (para resaltar el límite). */
  edge: number
  size: number
}

const KIND_COLOR: Record<string, string> = {
  planet: '#fdba74',
  ringedPlanet: '#fde68a',
  station: '#cbd5e1',
  sphere: '#94a3b8',
  smallBody: '#64748b',
}

/**
 * Mapa cenital del sector: el rectángulo es el área visitable; los objetos, a escala; la flecha,
 * la nave con su rumbo y su cono de visión. A la derecha, la altura dentro del área.
 */
export function Minimap({ bounds, objects, position, yaw, edge, size }: Props) {
  const frame: MapFrame = useMemo(() => ({ size, padding: 10, bounds }), [size, bounds])
  const rect = boundsRect(frame)
  const k = rect.w / (bounds.max[0] - bounds.min[0])
  const me = toMap(position, frame)
  const alt = altitude01(position, bounds)
  const statics = useMemo(() => {
    const list = objects.map((o) => {
      const p = toMap(o.position, frame)
      const r = Math.max(o.kind === 'smallBody' ? 1.5 : 3, o.radius * k * (o.ring ? 1.4 : 1))
      const left = p.x > size * 0.55
      return { o, p, r, left, ly: p.y + 3 }
    })
    // Etiquetas sin solaparse: si dos del mismo lado quedan a < 11 px en vertical, la segunda baja.
    const labelled = list.filter((x) => x.o.label).sort((a, b) => a.ly - b.ly)
    for (let i = 1; i < labelled.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = labelled[j]!
        const b = labelled[i]!
        if (a.left === b.left && Math.abs(a.p.x - b.p.x) < 70 && b.ly - a.ly < 11) b.ly = a.ly + 11
      }
    }
    return list
  }, [objects, frame, k, size])
  return (
    <figure className="ex-minimap" aria-label="Mapa del sector">
      <div className="ex-minimap-body">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
          <defs>
            <pattern id="ex-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0H0V16" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx="6" fill="url(#ex-grid)" />
          <rect
            className="ex-minimap-bounds"
            data-edge={edge > 0.5 || undefined}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            rx="6"
          />
          {statics.map(({ o, p, r, left, ly }) => (
            <g key={o.id}>
              {o.ring && <ellipse cx={p.x} cy={p.y} rx={r * 1.6} ry={r * 0.55} fill="none" stroke={KIND_COLOR[o.kind]} strokeOpacity="0.6" />}
              {/* Planetas con su propio color (el más claro de su paleta); el resto, por tipo. */}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={o.kind === 'planet' || o.kind === 'ringedPlanet' ? o.palette[0] : KIND_COLOR[o.kind]}
                fillOpacity={o.label ? 0.9 : 0.6}
              />
              {o.label && (
                // A la izquierda del punto si está en la mitad derecha, para no salirse del mapa.
                <text
                  x={left ? p.x - r * (o.ring ? 1.7 : 1) - 3 : p.x + r + 3}
                  y={ly}
                  textAnchor={left ? 'end' : 'start'}
                  className="ex-minimap-label"
                >
                  {o.label}
                </text>
              )}
            </g>
          ))}
          <g transform={`translate(${me.x} ${me.y}) rotate(${headingDeg(yaw)})`}>
            <path d="M0 0 L-22 -34 A40 40 0 0 1 22 -34 Z" fill="rgba(56,189,248,0.14)" />
            <path d="M0 -8 L5.5 6 L0 3 L-5.5 6 Z" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1" />
          </g>
        </svg>
        <div className="ex-minimap-alt" aria-hidden="true">
          <span className="ex-minimap-alt-mark" style={{ bottom: `${alt * 100}%` }} />
        </div>
      </div>
      <figcaption className="ex-route-caption">
        <span>Área del sector</span>
        <span className="ex-route-count">{edge > 0.5 ? 'límite' : 'dentro'}</span>
      </figcaption>
    </figure>
  )
}
