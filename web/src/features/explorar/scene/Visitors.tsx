import { useEffect, useMemo, useRef, useState, type JSX, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Mesh,
  type MeshStandardMaterial,
} from 'three'
import { applyImpact, type FlightState } from '../engine/flight'
import { initialVisitors, stepVisitors, visitorFade, type Visitor, type VisitorEvent, type VisitorKind, type VisitorState } from '../engine/visitors'
import { LIGHT_DIR } from './light'
import { GLOW_FRAG, GLOW_VERT } from './shaders/glow'
import { STREAK_FRAG, STREAK_VERT } from './shaders/streak'
import { rockGeometry } from './SmallBodies'
import { loadTexture } from './textureCache'
import { Trail, type Emitter } from './Trail'

/**
 * Tiempo de los shaders acotado: con tiempos muy grandes, el ruido por seno pierde precisión en
 * algunas GPU (sobre todo en Windows) y se ve en bloques. Cada 5 minutos el patrón da un salto leve.
 */
const shaderTime = (t: number) => t % 300

interface StreakOptions {
  core: string
  edge: string
  /** Ancho en la cabeza y al final, largo y curvatura (fracción del largo). */
  w0: number
  w1: number
  length: number
  curve: number
  /** Cuánto se apaga a lo largo (exponente), filamentos 0..1, destellos 0..2 y velocidad del flujo. */
  falloff: number
  fil: number
  glitter: number
  flow: number
  /** Movimiento de la cola: ondulación, ancho que respira y pulsos de luz (0 = quieta). */
  wave: number
  seed: number
}

function makeStreak(o: StreakOptions): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    uniforms: {
      uHead: { value: new Vector3() },
      uAxis: { value: new Vector3(0, 0, 1) },
      uBend: { value: new Vector3() },
      uLength: { value: o.length },
      uCurve: { value: o.curve },
      uW0: { value: o.w0 },
      uW1: { value: o.w1 },
      uCore: { value: new Color(o.core) },
      uEdge: { value: new Color(o.edge) },
      uAlpha: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: o.seed },
      uFil: { value: o.fil },
      uGlitter: { value: o.glitter },
      uFalloff: { value: o.falloff },
      uFlow: { value: o.flow },
      uWave: { value: o.wave },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  })
}

function useStreak(o: StreakOptions): ShaderMaterial {
  // Las opciones son fijas para cada visitante: el material se crea una vez.
  const m = useMemo(() => makeStreak(o), [])
  useEffect(() => () => m.dispose(), [m])
  return m
}

function setStreak(m: ShaderMaterial, head: Vector3, axis: Vector3, bend: Vector3, alpha: number, time: number) {
  const u = m.uniforms
  u.uHead!.value.copy(head)
  u.uAxis!.value.copy(axis)
  u.uBend!.value.copy(bend)
  u.uAlpha!.value = alpha
  u.uTime!.value = shaderTime(time)
}

interface GlowOptions {
  /** 0 = coma de cometa (gas), 1 = estrella de puntas. */
  mode: 0 | 1
  color: string
  core: string
  /** Cuánto se alarga hacia atrás del movimiento. */
  stretch: number
  seed: number
}

function useGlow(o: GlowOptions): ShaderMaterial {
  const m = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: {
          uColor: { value: new Color(o.color) },
          uCore: { value: new Color(o.core) },
          uAlpha: { value: 0 },
          uTime: { value: 0 },
          uSeed: { value: o.seed },
          uDir: { value: new Vector2(1, 0) },
          uStretch: { value: o.stretch },
          uMode: { value: o.mode },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        premultipliedAlpha: true,
      }),
    [],
  )
  useEffect(() => () => m.dispose(), [m])
  return m
}

/**
 * Coloca el brillo de la cabeza: mira a la cámara y recibe la dirección del movimiento en el plano
 * de la pantalla (para alargarse hacia atrás).
 */
function placeGlow(mesh: Mesh, m: ShaderMaterial, camera: Camera, pos: Vector3, velocity: Vector3, alpha: number, time: number, tmp: { q: Quaternion; v: Vector3 }) {
  mesh.position.copy(pos)
  mesh.quaternion.copy(camera.quaternion)
  tmp.q.copy(camera.quaternion).invert()
  tmp.v.copy(velocity).applyQuaternion(tmp.q)
  const u = m.uniforms
  u.uDir!.value.set(tmp.v.x, tmp.v.y)
  u.uAlpha!.value = alpha
  u.uTime!.value = shaderTime(time)
}

/** Componente de `toward` perpendicular a `axis`, normalizado (o cero si son paralelos). */
function perpendicular(out: Vector3, toward: Vector3, axis: Vector3): Vector3 {
  out.copy(toward).addScaledVector(axis, -toward.dot(axis))
  const l = out.length()
  return l > 1e-4 ? out.multiplyScalar(1 / l) : out.set(0, 0, 0)
}

const ANTI_SUN = LIGHT_DIR.clone().multiplyScalar(-1)
const UP = new Vector3(0, 1, 0)

interface Shared {
  quad: BufferGeometry
  ribbon: BufferGeometry
  rock: BufferGeometry
}

interface ViewProps {
  id: number
  sim: MutableRefObject<VisitorState>
  shared: Shared
  /** Partículas extra (destellos y polvo); apagadas en calidad baja. */
  detail: boolean
}

const find = (sim: MutableRefObject<VisitorState>, id: number): Visitor | undefined => sim.current.active.find((x) => x.id === id)

function useScratch() {
  return useMemo(
    () => ({ pos: new Vector3(), vel: new Vector3(), back: new Vector3(), axis: new Vector3(), bend: new Vector3(), zero: new Vector3(), q: new Quaternion(), v: new Vector3() }),
    [],
  )
}

/**
 * Cometa: coma turquesa de gas turbulento (procedural y animada, alargada hacia atrás) y dos colas
 * cuyos filamentos corren hacia el final. La de polvo, ancha, blanca y violeta, se curva un poco; la
 * de iones, fina y azul, se abre hacia el lado contrario a la estrella.
 */
function CometView({ id, sim, shared, detail }: ViewProps) {
  const camera = useThree((s) => s.camera)
  const head = useRef<Mesh>(null)
  const glow = useGlow({ mode: 0, color: '#2dd4bf', core: '#f0fdff', stretch: 1.6, seed: id * 1.37 })
  const dust = useStreak({ core: '#f5f3ff', edge: '#8b5cf6', w0: 1.4, w1: 28, length: 120, curve: 0.12, falloff: 1.2, fil: 1, glitter: 0, flow: 0.18, wave: 0.7, seed: id })
  const ion = useStreak({ core: '#cffafe', edge: '#3b82f6', w0: 0.6, w1: 9, length: 160, curve: 0, falloff: 1.5, fil: 0.8, glitter: 0, flow: 0.45, wave: 1, seed: id + 7 })
  const emitter = useRef<Emitter>({ origin: new Vector3(), direction: ANTI_SUN.clone(), velocity: new Vector3(), thrust: 1 })
  const tmp = useScratch()
  useFrame((state) => {
    const v = find(sim, id)
    if (!v || !head.current) return
    const f = visitorFade(v)
    const time = state.clock.elapsedTime
    tmp.pos.set(...v.position)
    tmp.vel.set(...v.velocity)
    placeGlow(head.current, glow, camera, tmp.pos, tmp.vel, f, time, tmp)
    tmp.back.copy(tmp.vel).multiplyScalar(-1).normalize()
    perpendicular(tmp.bend, ANTI_SUN, tmp.back)
    setStreak(dust, tmp.pos, tmp.back, tmp.bend, 0.9 * f, time)
    tmp.axis.copy(tmp.back).addScaledVector(tmp.bend, 0.18).normalize()
    setStreak(ion, tmp.pos, tmp.axis, tmp.zero, 0.7 * f, time)
    const e = emitter.current
    e.origin.copy(tmp.pos)
    e.direction.copy(tmp.axis)
  })
  return (
    <>
      <mesh ref={head} geometry={shared.quad} material={glow} scale={34} frustumCulled={false} renderOrder={3} />
      <mesh geometry={shared.ribbon} material={ion} frustumCulled={false} renderOrder={2} />
      <mesh geometry={shared.ribbon} material={dust} frustumCulled={false} renderOrder={2} />
      {detail && (
        <Trail count={120} emitter={emitter} animate hot="#f0fdff" cool="#6366f1" sizeScale={5} lifeScale={4} speedScale={0.5} inherit={0} />
      )}
    </>
  )
}

/** Estrella fugaz: estrella de puntas que gira y titila, y un rastro fino lleno de destellos que corren. */
function MeteorView({ id, sim, shared, detail }: ViewProps) {
  const camera = useThree((s) => s.camera)
  const head = useRef<Mesh>(null)
  const glow = useGlow({ mode: 1, color: '#fde68a', core: '#fffbeb', stretch: 0.7, seed: id * 2.11 })
  const trail = useStreak({ core: '#ffffff', edge: '#a5b4fc', w0: 0.3, w1: 3.6, length: 60, curve: 0.12, falloff: 1.1, fil: 0.4, glitter: 1.4, flow: 0.6, wave: 0.5, seed: id })
  const emitter = useRef<Emitter>({ origin: new Vector3(), direction: new Vector3(), velocity: new Vector3(), thrust: 1 })
  const tmp = useScratch()
  useFrame((state) => {
    const v = find(sim, id)
    if (!v || !head.current) return
    const f = visitorFade(v)
    const time = state.clock.elapsedTime
    tmp.pos.set(...v.position)
    tmp.vel.set(...v.velocity)
    placeGlow(head.current, glow, camera, tmp.pos, tmp.vel, f, time, tmp)
    tmp.back.copy(tmp.vel).multiplyScalar(-1).normalize()
    // El rastro se arquea un poco hacia abajo, como en las ilustraciones clásicas.
    perpendicular(tmp.bend, UP, tmp.back).multiplyScalar(-1)
    setStreak(trail, tmp.pos, tmp.back, tmp.bend, f, time)
    const e = emitter.current
    e.origin.copy(tmp.pos)
    e.direction.copy(tmp.back)
  })
  return (
    <>
      <mesh ref={head} geometry={shared.quad} material={glow} scale={16} frustumCulled={false} renderOrder={3} />
      <mesh geometry={shared.ribbon} material={trail} frustumCulled={false} renderOrder={2} />
      {detail && (
        <Trail count={70} emitter={emitter} animate hot="#ffffff" cool="#c7d2fe" sizeScale={3} lifeScale={1.8} speedScale={0.2} inherit={0} />
      )}
    </>
  )
}

/**
 * Asteroide: roca alargada con cráteres (textura lunar en tonos cálidos) que gira dando tumbos, con
 * un borde levemente encendido y una estela de polvo que fluye.
 */
function AsteroidView({ id, sim, shared, detail }: ViewProps) {
  const rock = useRef<Mesh>(null)
  const material = useRef<MeshStandardMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)
  const dust = useStreak({ core: '#d6c3a5', edge: '#57534e', w0: 1.6, w1: 7, length: 30, curve: 0, falloff: 2.2, fil: 1, glitter: 0, flow: 0.25, wave: 0.6, seed: id })
  const emitter = useRef<Emitter>({ origin: new Vector3(), direction: new Vector3(), velocity: new Vector3(), thrust: 0.4 })
  const tmp = useScratch()
  const v0 = find(sim, id)
  const radius = v0?.radius ?? 2.5
  const seed = v0?.seed ?? 0.5
  const spin = useMemo(() => new Vector3(0.3 + seed * 0.5, 0.2 + (1 - seed) * 0.4, 0.1), [seed])
  useEffect(() => {
    let alive = true
    Promise.all([loadTexture('luna-color'), loadTexture('luna-relieve', 'data')]).then(([map, bump]) => {
      if (!alive || !material.current) return
      material.current.map = map
      material.current.bumpMap = bump
      material.current.needsUpdate = true
      invalidate()
    }, () => {})
    return () => {
      alive = false
    }
  }, [invalidate])
  useFrame((state, delta) => {
    const v = find(sim, id)
    if (!v || !rock.current) return
    const f = visitorFade(v)
    tmp.pos.set(...v.position)
    rock.current.position.copy(tmp.pos)
    rock.current.rotation.x += spin.x * delta
    rock.current.rotation.y += spin.y * delta
    rock.current.rotation.z += spin.z * delta
    rock.current.scale.set(radius * 1.45, radius * 0.85, radius).multiplyScalar(0.3 + 0.7 * f)
    // Brillo tenue que late: la roca no se ve como un recorte plano contra el fondo.
    if (material.current) material.current.emissiveIntensity = 0.05 + 0.04 * Math.sin(state.clock.elapsedTime * 2.3 + seed * 10)
    tmp.back.set(-v.velocity[0], -v.velocity[1], -v.velocity[2]).normalize()
    setStreak(dust, tmp.pos, tmp.back, tmp.zero, 0.16 * f, state.clock.elapsedTime)
    const e = emitter.current
    e.origin.copy(tmp.pos)
    e.direction.copy(tmp.back)
  })
  return (
    <>
      <mesh ref={rock} geometry={shared.rock} rotation={[seed * 6, seed * 3, 0]} scale={0.001}>
        <meshStandardMaterial ref={material} color="#b08866" emissive="#7c2d12" emissiveIntensity={0.05} roughness={0.95} metalness={0} bumpScale={6} />
      </mesh>
      <mesh geometry={shared.ribbon} material={dust} frustumCulled={false} renderOrder={2} />
      {detail && (
        // Fragmentos de polvo que se desprenden y quedan atrás.
        <Trail count={50} emitter={emitter} animate hot="#e7d8c0" cool="#57534e" sizeScale={4} lifeScale={3} speedScale={0.25} inherit={0} />
      )}
    </>
  )
}

const VIEWS: Record<VisitorKind, (p: ViewProps) => JSX.Element> = { comet: CometView, meteor: MeteorView, asteroid: AsteroidView }

interface Props {
  flight: MutableRefObject<FlightState>
  /** Si es false (movimiento reducido), los impactos no sacuden la nave. */
  animate: boolean
  /** Partículas extra en cometas, estrellas fugaces y asteroides (no en calidad baja). */
  detail: boolean
  /** Semilla fija (capturas comparables); sin ella, una distinta en cada visita. */
  seed?: number
  onEvent?: (e: VisitorEvent) => void
}

/** Semilla distinta en cada visita: el cielo no repite la misma secuencia. */
function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

/** Cometas, estrellas fugaces y asteroides ocasionales; si uno alcanza a la nave, la empuja y la sacude. */
export function Visitors({ flight, animate, detail, seed, onEvent }: Props) {
  const sim = useRef<VisitorState>(initialVisitors(seed ?? randomSeed()))
  const [ids, setIds] = useState<{ id: number; kind: VisitorKind }[]>([])
  const shared = useMemo<Shared>(() => ({ quad: new PlaneGeometry(1, 1), ribbon: new PlaneGeometry(1, 1, 1, 40), rock: rockGeometry(4242, 3) }), [])
  useEffect(
    () => () => {
      shared.quad.dispose()
      shared.ribbon.dispose()
      shared.rock.dispose()
    },
    [shared],
  )
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
      {ids.map((v) => {
        const View = VIEWS[v.kind]
        return <View key={v.id} id={v.id} sim={sim} shared={shared} detail={detail} />
      })}
    </>
  )
}
