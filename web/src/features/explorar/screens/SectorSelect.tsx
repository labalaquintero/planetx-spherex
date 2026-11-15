import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { Backdrop, type BackdropArea, type BackdropInput } from '../backdrop/Backdrop'
import { areaRadius, GALAXY, parseRgb } from '../backdrop/galaxy'
import type { QualityLevel } from '../engine/quality'
import type { SectorConfig } from '../engine/types'
import { calloutSide } from '../sectors/selector'
import { Credits } from './Credits'
import { loadScene } from './sceneLoader'

export interface JumpState {
  readonly id: string
  /** performance.now() al iniciar. */
  readonly start: number
  /** Centro del sector elegido en [0, 1] del contenedor. */
  readonly x: number
  readonly y: number
}

interface Props {
  sectors: readonly SectorConfig[]
  onEnter: (sectorId: string, x: number, y: number) => void
  /** Salto en curso (null si no). */
  jump: JumpState | null
  /** Con movimiento reducido: sin paralaje ni animaciones; el salto es un desvanecimiento. */
  reduced: boolean
  quality: QualityLevel
  forced: boolean
  /** Sector que recibe el foco al volver de la navegación. */
  focusId: string | null
  /** Controles extra arriba a la derecha (p. ej., sonido). */
  extraControls?: ReactNode
  /** Se llama al señalar una región nueva (para el tic del sonido). */
  onPoint?: () => void
}

export function SectorSelect({ sectors, onEnter, jump, reduced, quality, forced, focusId, extraControls, onPoint }: Props) {
  const layer = useRef<HTMLElement | null>(null)
  const input = useRef<BackdropInput>({ pointerX: 0, pointerY: 0, jumpStart: null, jumpX: 0.5, jumpY: 0.5, hover: -1 })
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  // Cada sector es una región de la galaxia (la dibuja el fondo; aquí solo va la zona que se señala).
  const areas = useMemo<BackdropArea[]>(
    () => sectors.map((s) => ({ x: s.selector.x, y: s.selector.y, size: s.selector.size, color: parseRgb(s.selector.glow), soon: !s.scene })),
    [sectors],
  )
  const point = (i: number) => {
    if (input.current.hover === i || jump) return
    input.current.hover = i
    onPoint?.()
  }
  const release = (i: number) => {
    if (input.current.hover === i) input.current.hover = -1
  }

  useEffect(() => {
    if (!jump || reduced) {
      input.current.jumpStart = null
      return
    }
    input.current.jumpStart = jump.start
    input.current.hover = sectors.findIndex((s) => s.id === jump.id)
    input.current.jumpX = jump.x
    input.current.jumpY = jump.y
    layer.current?.style.setProperty('--ex-jx', `${(jump.x * 100).toFixed(1)}%`)
    layer.current?.style.setProperty('--ex-jy', `${(jump.y * 100).toFixed(1)}%`)
  }, [jump, reduced, sectors])

  useEffect(() => {
    if (focusId) buttons.current.get(focusId)?.focus()
  }, [focusId])

  const enter = (s: SectorConfig) => {
    if (!s.scene || jump) return
    onEnter(s.id, s.selector.x / 100, s.selector.y / 100)
  }

  return (
    <section
      ref={layer}
      className="ex-select"
      aria-labelledby="ex-select-title"
      data-jumping={jump && !reduced ? '' : undefined}
      data-fading={jump && reduced ? '' : undefined}
      onPointerMove={(e) => {
        if (reduced) return
        const r = e.currentTarget.getBoundingClientRect()
        input.current.pointerX = ((e.clientX - r.left) / r.width) * 2 - 1
        input.current.pointerY = ((e.clientY - r.top) / r.height) * 2 - 1
      }}
      onPointerLeave={() => {
        input.current.pointerX = 0
        input.current.pointerY = 0
      }}
    >
      <Backdrop input={input} areas={areas} layer={layer} animate={!reduced} quality={quality} forced={forced} />

      <header className="ex-select-head">
        <span className="ex-chip">Mapa</span>
        <h2 id="ex-select-title" className="ex-select-title">
          Elige un sector
        </h2>
        <p className="ex-select-sub">Señala una región de la galaxia y entra a volar en nave.</p>
      </header>

      <div className="ex-select-actions">
        <Credits />
        {extraControls}
      </div>

      <ul className="ex-sector-list">
        {sectors.map((s, i) => {
          const soon = !s.scene
          const cardId = `ex-card-${s.id}`
          const style = {
            left: `${s.selector.x}%`,
            top: `${s.selector.y}%`,
            '--ex-r': `${areaRadius(s.selector.size)}`,
            '--ex-ratio': `${GALAXY.areaRatio}`,
            '--ex-tilt': `${-GALAXY.angleDeg}deg`,
            '--ex-glow': s.selector.glow,
          } as CSSProperties
          return (
            <li
              key={s.id}
              className="ex-sector-item"
              style={style}
              data-target={jump?.id === s.id ? '' : undefined}
              data-callout={calloutSide(s.selector.x)}
            >
              <button
                ref={(el) => {
                  if (el) buttons.current.set(s.id, el)
                  else buttons.current.delete(s.id)
                }}
                type="button"
                className="ex-area"
                data-soon={soon || undefined}
                aria-label={`${s.name}${soon ? ', próximamente' : ', entrar'}`}
                aria-describedby={cardId}
                aria-disabled={soon || undefined}
                onPointerEnter={() => {
                  point(i)
                  if (!soon) void loadScene().catch(() => {})
                }}
                onPointerLeave={() => release(i)}
                onFocus={() => {
                  point(i)
                  if (!soon) void loadScene().catch(() => {})
                }}
                onBlur={() => release(i)}
                onClick={() => enter(s)}
              />
              <span className="ex-area-label" aria-hidden="true">
                <span className="ex-area-name">{s.name}</span>
                <span className="ex-area-state">{soon ? 'Próximamente' : 'Disponible'}</span>
              </span>
              <div className="ex-card" id={cardId} role="tooltip">
                <div className="ex-card-head">
                  <span className="ex-chip ex-chip-muted">{s.name}</span>
                  {soon ? (
                    <span className="ex-chip ex-chip-warn">Próximamente</span>
                  ) : (
                    <span className="ex-chip">Disponible</span>
                  )}
                </div>
                <p className="ex-card-text">{s.description}</p>
                {s.scene && (
                  <p className="ex-card-meta">
                    {s.scene.objects.filter((o) => o.label).length} objetos con nombre · vuelo libre
                  </p>
                )}
                {!soon && <p className="ex-card-cta">Clic o Enter para entrar</p>}
              </div>
            </li>
          )
        })}
      </ul>

      <span className="ex-select-veil" aria-hidden="true" />

      <footer className="ex-select-foot">
        <p className="ex-disclaimer">Representación ilustrativa, no son datos reales de SPHEREx.</p>
        <p className="ex-keys" aria-hidden="true">
          <kbd>Tab</kbd> recorrer · <kbd>Enter</kbd> entrar
        </p>
      </footer>
    </section>
  )
}
