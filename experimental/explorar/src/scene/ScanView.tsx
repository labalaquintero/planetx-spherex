import { useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, AgXToneMapping, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import { dragTurn, relaxTurn, scanProgress, STILL, type Turn } from '../engine/scan'
import type { SceneObject } from '../engine/types'
import { Bloom } from './Effects'
import { LIGHT_DIR } from './light'
import { Planet } from './Planet'
import { Sky } from './Sky'

/** Entrada del puntero que escribe el HTML (sin renders): arrastre acumulado y zoom. */
export interface ScanInput {
  dx: number
  dy: number
  dragging: boolean
  zoom: number
}

interface Props {
  object: SceneObject
  input: MutableRefObject<ScanInput>
  /** false con movimiento reducido: sin barrido animado ni giro automático. */
  animate: boolean
  octaves: number
}

const Y = new Vector3(0, 1, 0)
/** La cámara mira con la luz de la estrella a unos 50° de lado: se ve la cara de día y el terminador. */
const VIEW_DIR = LIGHT_DIR.clone().applyAxisAngle(Y, -0.9).normalize()

/** Cámara: en la dirección VIEW_DIR, a una distancia que encuadra el cuerpo (y su anillo). */
function Rig({ radius, extent, input }: { radius: number; extent: number; input: MutableRefObject<ScanInput> }) {
  const camera = useThree((s) => s.camera)
  const zoom = useRef(1)
  useFrame((_, delta) => {
    zoom.current += (input.current.zoom - zoom.current) * (1 - Math.exp(-8 * Math.min(delta, 0.1)))
    const dist = (radius * extent * 3.9) / zoom.current
    camera.position.copy(VIEW_DIR).multiplyScalar(dist)
    camera.lookAt(0, 0, 0)
    camera.near = Math.max(0.01, dist - radius * extent * 2)
    camera.far = dist + 2000
    camera.updateProjectionMatrix()
  })
  return null
}

/**
 * Cuerpo escaneado: el mismo Planet de la escena (mismas texturas, colores, atmósfera y anillo) en el
 * origen, dentro de un grupo que el arrastre gira como un globo bajo la luz fija de la estrella. Encima,
 * una retícula del escáner y un anillo que barre de polo a polo mientras dura el escaneo.
 */
function Body({ object, input, animate, octaves }: Props) {
  const group = useRef<Group>(null)
  const grid = useRef<MeshBasicMaterial>(null)
  const sweep = useRef<Mesh>(null)
  const turn = useRef<Turn>(STILL)
  const t0 = useRef<number | null>(null)
  const camera = useThree((s) => s.camera)
  const tmp = useMemo(() => ({ up: new Vector3(), right: new Vector3(), q: new Quaternion() }), [])
  const o = useMemo<SceneObject>(() => ({ ...object, position: [0, 0, 0], surface: object.surface ?? 'rocky' }), [object])
  const r = object.radius

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const p = animate ? scanProgress((state.clock.elapsedTime - t0.current) * 1000) : 1
    // Giro: el arrastre del puntero manda; sin arrastre, inercia y giro automático lento.
    const inp = input.current
    let yaw: number
    let pitch: number
    if (inp.dragging || inp.dx || inp.dy) {
      const d = dragTurn(inp.dx, inp.dy, dt)
      yaw = d.yaw
      pitch = d.pitch
      turn.current = d.turn
      inp.dx = 0
      inp.dy = 0
    } else {
      const d = relaxTurn(turn.current, dt)
      yaw = animate ? d.yaw : 0
      pitch = d.pitch
      turn.current = d.turn
    }
    const g = group.current
    if (g && (yaw || pitch)) {
      // Ejes de la pantalla: arrastrar a la derecha gira hacia la derecha, arriba hacia arriba.
      tmp.up.copy(camera.up).normalize()
      tmp.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      tmp.q.setFromAxisAngle(tmp.up, yaw)
      g.quaternion.premultiply(tmp.q)
      tmp.q.setFromAxisAngle(tmp.right, pitch)
      g.quaternion.premultiply(tmp.q)
    }
    // Retícula: solo mientras dura el barrido; al terminar se apaga y el planeta queda limpio.
    if (grid.current) {
      grid.current.opacity = 0.3 * (1 - p)
      grid.current.visible = p < 1
    }
    // Anillo de barrido: baja de polo a polo y desaparece al terminar.
    if (sweep.current) {
      const y = (1 - 2 * p) * r * 1.02
      const k = Math.sqrt(Math.max(0, 1.04 * r * r - y * y))
      sweep.current.position.y = y
      sweep.current.scale.setScalar(Math.max(0.001, k))
      sweep.current.visible = p < 1
    }
  })

  return (
    <>
      <group ref={group}>
        <Planet o={o} spin={animate} octaves={Math.max(octaves, 5)} segments={[128, 96]} bumpScale={0.15} />
        <mesh scale={r * 1.03}>
          <sphereGeometry args={[1, 36, 18]} />
          <meshBasicMaterial ref={grid} wireframe color="#38bdf8" transparent opacity={0.45} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      </group>
      <mesh ref={sweep} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.012, 8, 96]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.9} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </>
  )
}

/** Vista 3D del escaneo (chunk diferido, como la escena). */
export default function ScanView(props: Props) {
  const extent = props.object.ring ? props.object.ring.outer : 1.12
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.1, far: 4000, position: [0, 0, 10] }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: AgXToneMapping, toneMappingExposure: 1.0 }}
      frameloop="always"
      // Medir sin transformaciones: el panel se abre con una animación de escala.
      resize={{ offsetSize: true }}
      aria-hidden="true"
    >
      {/* El mismo cielo de la escena (nebulosa, estrellas y la estrella del sector) y un brillo suave. */}
      <Sky stars={3600} octaves={5} cube={1024} animate={props.animate} />
      <Rig radius={props.object.radius} extent={extent} input={props.input} />
      <Body {...props} />
      <Bloom strength={0.25} samples={4} chromatic={0} grain={0} />
    </Canvas>
  )
}
