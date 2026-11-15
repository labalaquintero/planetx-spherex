import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './explorar.css'
import { createSound } from './audio/sound'
import { SoundToggle } from './audio/SoundToggle'
import { FADE_MS, JUMP_MS } from './engine/motion'
import { initialQuality } from './engine/quality'
import { currentParams } from './params'
import { NavigationScreen } from './screens/NavigationScreen'
import { loadScene } from './screens/sceneLoader'
import { SectorSelect, type JumpState } from './screens/SectorSelect'
import { SECTORS, getSector } from './sectors'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface ExplorarProps {
  /** Clase extra para el contenedor (el componente rellena el tamaño de su contenedor). */
  className?: string
}

type Phase =
  | { readonly kind: 'select'; readonly returnFocus: string | null }
  | { readonly kind: 'jump'; readonly jump: JumpState }
  | { readonly kind: 'nav'; readonly id: string; readonly arrive: boolean }

/**
 * Extra «Explorar»: selección de sector, salto y navegación en nave.
 * Se dimensiona al 100 % de su contenedor y no hace llamadas de red.
 */
export function Explorar({ className }: ExplorarProps) {
  const reduced = usePrefersReducedMotion()
  const params = useMemo(currentParams, [])
  const quality = useMemo(() => initialQuality(params.quality), [params])
  const [phase, setPhase] = useState<Phase>({ kind: 'select', returnFocus: null })
  const token = useRef(0)
  // Sonido: apagado por defecto y sin AudioContext hasta que se enciende con un clic.
  const sound = useMemo(() => createSound(), [])
  const [soundOn, setSoundOn] = useState(false)
  useEffect(() => () => sound.dispose(), [sound])
  const toggleSound = useCallback(() => {
    sound.setEnabled(!sound.enabled)
    setSoundOn(sound.enabled)
  }, [sound])
  const soundButton = <SoundToggle on={soundOn} onToggle={toggleSound} />

  useEffect(
    () => () => {
      token.current++ // invalida un salto pendiente si el componente se desmonta
    },
    [],
  )

  const enter = useCallback(
    (id: string, x: number, y: number) => {
      const sector = getSector(id)
      if (!sector?.scene) return
      const my = ++token.current
      setPhase({ kind: 'jump', jump: { id, start: performance.now(), x, y } })
      if (!reduced) sound.jump()
      const wait = new Promise((r) => setTimeout(r, reduced ? FADE_MS : JUMP_MS))
      // Si el chunk falla, igualmente se entra: la pantalla de navegación muestra el error.
      void Promise.all([wait, loadScene().catch(() => null)]).then(() => {
        if (token.current === my) setPhase({ kind: 'nav', id, arrive: !reduced })
      })
    },
    [reduced, sound],
  )

  const exit = useCallback(() => {
    token.current++
    setPhase((p) => ({ kind: 'select', returnFocus: p.kind === 'nav' ? p.id : null }))
  }, [])

  const navSector = phase.kind === 'nav' ? getSector(phase.id) : undefined

  return (
    <div className={className ? `explorar ${className}` : 'explorar'}>
      {navSector?.scene && phase.kind === 'nav' ? (
        <NavigationScreen
          key={navSector.id}
          sector={{ ...navSector, scene: navSector.scene }}
          onExit={exit}
          arrive={phase.arrive}
          reduced={reduced}
          quality={quality.level}
          forced={quality.forced}
          debug={params.debug}
          extraControls={soundButton}
          onMoved={(d) => sound.move(d)}
        />
      ) : (
        <SectorSelect
          sectors={SECTORS}
          onEnter={enter}
          jump={phase.kind === 'jump' ? phase.jump : null}
          reduced={reduced}
          quality={quality.level}
          forced={quality.forced}
          focusId={phase.kind === 'select' ? phase.returnFocus : null}
          extraControls={soundButton}
        />
      )}
    </div>
  )
}
