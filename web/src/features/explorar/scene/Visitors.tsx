import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, Vector3, type Group } from 'three'
import { applyImpact, type FlightState } from '../engine/flight'
import { initialVisitors, stepVisitors, type VisitorEvent, type VisitorKind, type VisitorState } from '../engine/visitors'
import { LIGHT_DIR } from './light'
import { Trail, type Emitter } from './Trail'

/** Textura de la coma: halo radial (canvas en memoria). */
function makeGlow(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(210,240,255,0.75)')
  g.addColorStop(0.5, 'rgba(125,211,252,0.18)')
  g.addColorStop(1, 'rgba(125,211,252,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

const ANTI_SUN = LIGHT_DIR.clone().multiplyScalar(-1)

function VisitorView({ id, kind, sim, glow }: { id: number; kind: VisitorKind; sim: MutableRefObject<VisitorState>; glow: CanvasTexture }) {
  const group = useRef<Group>(null)
  const emitter = useRef<Emitter>({ origin: new Vector3(), direction: ANTI_SUN.clone(), velocity: new Vector3(), thrust: 1 })
  useFrame(() => {
    const v = sim.current.active.find((x) => x.id === id)
    if (!v || !group.current) return
    group.current.position.set(...v.position)
    const e = emitter.current
    e.origin.set(...v.position)
    if (kind === 'comet') {
      // La cola de un cometa apunta lejos de la estrella, no hacia atrás de su movimiento.
      e.direction.copy(ANTI_SUN)
      e.velocity.set(0, 0, 0)
    } else {
      e.direction.set(-v.velocity[0], -v.velocity[1], -v.velocity[2]).normalize()
      e.velocity.set(0, 0, 0)
    }
  })
  const comet = kind === 'comet'
  return (
    <>
      <group ref={group}>
        <mesh rotation={[id, id * 2, 0]}>
          {/* Núcleo pequeño y encendido: la coma lo envuelve (no debe tapar el brillo). */}
          <icosahedronGeometry args={[comet ? 0.55 : 0.35, 1]} />
          <meshStandardMaterial
            color={comet ? '#9ca3af' : '#78716c'}
            emissive={comet ? '#e0f2fe' : '#fdba74'}
            emissiveIntensity={comet ? 0.7 : 1.1}
            flatShading
            roughness={0.95}
          />
        </mesh>
        <sprite scale={comet ? 20 : 4}>
          <spriteMaterial map={glow} color={comet ? '#e0f2fe' : '#fde68a'} blending={AdditiveBlending} depthWrite={false} transparent />
        </sprite>
      </group>
      <Trail
        count={comet ? 260 : 90}
        emitter={emitter}
        animate
        hot={comet ? '#e0f2fe' : '#fef3c7'}
        cool={comet ? '#38bdf8' : '#f59e0b'}
        sizeScale={comet ? 16 : 5}
        lifeScale={comet ? 4.5 : 0.8}
        speedScale={comet ? 0.9 : 0.4}
        inherit={0}
      />
    </>
  )
}

interface Props {
  flight: MutableRefObject<FlightState>
  /** Si es false (movimiento reducido), los impactos no sacuden la nave. */
  animate: boolean
  onEvent?: (e: VisitorEvent) => void
}

/** Cometas y meteoritos ocasionales; si uno alcanza a la nave, la empuja y la sacude un momento. */
export function Visitors({ flight, animate, onEvent }: Props) {
  const sim = useRef<VisitorState>(initialVisitors())
  const [ids, setIds] = useState<{ id: number; kind: VisitorKind }[]>([])
  const glow = useMemo(makeGlow, [])
  useEffect(() => () => glow.dispose(), [glow])
  const handler = useRef(onEvent)
  handler.current = onEvent

  useFrame((_, delta) => {
    const r = stepVisitors(sim.current, delta, flight.current.position, flight.current.yaw)
    sim.current = r.state
    if (r.events.length === 0) return
    let changed = false
    for (const e of r.events) {
      if (e.type === 'impact' && animate) flight.current = applyImpact(flight.current, e.dir, e.strength)
      if (e.type !== 'impact') changed = true
      handler.current?.(e)
    }
    if (changed) setIds(r.state.active.map((v) => ({ id: v.id, kind: v.kind })))
  })

  return (
    <>
      {ids.map((v) => (
        <VisitorView key={v.id} id={v.id} kind={v.kind} sim={sim} glow={glow} />
      ))}
    </>
  )
}
