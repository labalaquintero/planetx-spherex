import { useMemo } from 'react'
import { mulberry32 } from '../engine/random'
import type { SectorConfig } from '../engine/types'

interface Props {
  sectors: readonly SectorConfig[]
  onEnter: (sectorId: string) => void
}

/** Campo estelar decorativo y determinista (SVG en línea: sin imágenes ni red). */
function StarField() {
  const stars = useMemo(() => {
    const rnd = mulberry32(7)
    return Array.from({ length: 160 }, (_, i) => ({
      id: i,
      x: rnd() * 100,
      y: rnd() * 100,
      r: 0.05 + rnd() * 0.16,
      o: 0.25 + rnd() * 0.65,
    }))
  }, [])
  return (
    <svg className="ex-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {stars.map((s) => (
        <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="#dbe7ff" opacity={s.o} />
      ))}
    </svg>
  )
}

export function SectorSelect({ sectors, onEnter }: Props) {
  return (
    <section className="ex-select" aria-label="Selección de sector">
      <StarField />
      <h2 className="ex-sr-only">Elige un sector para explorar</h2>
      <ul className="ex-sector-list">
        {sectors.map((s) => {
          const soon = !s.scene
          const cardId = `ex-card-${s.id}`
          return (
            <li
              key={s.id}
              className="ex-sector-item"
              style={{ left: `${s.selector.x}%`, top: `${s.selector.y}%` }}
            >
              <button
                type="button"
                className="ex-sector"
                data-soon={soon || undefined}
                aria-label={`${s.name}${soon ? ', próximamente' : ', entrar'}`}
                aria-describedby={cardId}
                aria-disabled={soon || undefined}
                style={{
                  width: `${s.selector.size}cqmin`,
                  background: `radial-gradient(circle at 32% 30%, ${s.selector.colors[0]}, ${s.selector.colors[1]} 72%)`,
                }}
                onClick={() => {
                  if (!soon) onEnter(s.id)
                }}
              >
                <span className="ex-sector-symbol" aria-hidden="true">
                  {s.symbol}
                </span>
              </button>
              <div className="ex-card" id={cardId} role="tooltip">
                <p className="ex-card-title">{s.name}</p>
                <p className="ex-card-text">{s.description}</p>
                {soon && <p className="ex-card-badge">Próximamente</p>}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="ex-disclaimer">Representación ilustrativa, no son datos reales de SPHEREx.</p>
    </section>
  )
}
