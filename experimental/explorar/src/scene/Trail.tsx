import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type PerspectiveCamera, Vector3 } from 'three'
import { mulberry32 } from '../engine/random'
import { TRAIL_FRAG, TRAIL_VERT } from './shaders/sky'

/** Emisor de la estela, escrito por el rig en cada cuadro (en coordenadas del mundo). */
export interface Emitter {
  origin: Vector3
  /** Dirección de salida de los gases (hacia atrás de la nave). */
  direction: Vector3
  /** Velocidad de la nave: las partículas la heredan en parte. */
  velocity: Vector3
  /** Empuje 0..1. */
  thrust: number
}

interface Props {
  count: number
  emitter: MutableRefObject<Emitter>
  animate: boolean
  /** Colores (caliente al nacer, frío al apagarse) y escalas: los usan también las colas de cometa. */
  hot?: string
  cool?: string
  sizeScale?: number
  lifeScale?: number
  speedScale?: number
  /** Fracción de la velocidad del emisor que heredan las partículas. */
  inherit?: number
}

/**
 * Estela del motor en el espacio del mundo (Points aditivos, un draw call): las partículas se
 * quedan atrás cuando la nave avanza, y su cantidad, velocidad y tamaño siguen al empuje.
 */
export function Trail({ count, emitter, animate, hot = '#bae6fd', cool = '#0369a1', sizeScale = 1, lifeScale = 1, speedScale = 1, inherit = 0.6 }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const height = useThree((s) => s.size.height)
  const dpr = useThree((s) => s.viewport.dpr)
  const rnd = useMemo(() => mulberry32(77), [])
  const budget = useRef(0)

  const { geometry, pos, vel, life, maxLife, size } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const life = new Float32Array(count)
    const maxLife = new Float32Array(count).fill(1)
    const size = new Float32Array(count)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aLife', new BufferAttribute(life, 1))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    return { geometry: g, pos, vel, life, maxLife, size }
  }, [count])
  useEffect(() => () => geometry.dispose(), [geometry])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: TRAIL_VERT,
        fragmentShader: TRAIL_FRAG,
        uniforms: { uScale: { value: 1 }, uHot: { value: new Color(hot) }, uCool: { value: new Color(cool).multiplyScalar(0.6) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [hot, cool],
  )
  useEffect(() => () => material.dispose(), [material])

  // Origen del cuadro anterior: los nacimientos se reparten en ese tramo para que la estela sea
  // continua aunque haya pocos cuadros por segundo.
  const prev = useRef<Vector3 | null>(null)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const e = emitter.current
    const k = e.thrust
    const from = prev.current && prev.current.distanceToSquared(e.origin) < 2500 ? prev.current : e.origin
    material.uniforms.uScale!.value = (height * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360))
    if (!animate) {
      life.fill(0)
      life[0] = 0.9
      pos[0] = e.origin.x
      pos[1] = e.origin.y
      pos[2] = e.origin.z
      size[0] = 0.25
    } else {
      const lifeSpan = (0.25 + 0.55 * k) * lifeScale
      budget.current = Math.min(count, budget.current + (count / lifeSpan) * dt * (0.3 + 0.7 * k))
      const speed = (3 + 14 * k) * speedScale
      for (let i = 0; i < count; i++) {
        if (life[i]! > 0) {
          life[i] = life[i]! - dt / maxLife[i]!
          pos[i * 3] = pos[i * 3]! + vel[i * 3]! * dt
          pos[i * 3 + 1] = pos[i * 3 + 1]! + vel[i * 3 + 1]! * dt
          pos[i * 3 + 2] = pos[i * 3 + 2]! + vel[i * 3 + 2]! * dt
        } else if (budget.current >= 1) {
          budget.current -= 1
          const j = 0.12 * Math.max(1, sizeScale * 0.2)
          const f = rnd()
          pos[i * 3] = from.x + (e.origin.x - from.x) * f + (rnd() - 0.5) * j
          pos[i * 3 + 1] = from.y + (e.origin.y - from.y) * f + (rnd() - 0.5) * j
          pos[i * 3 + 2] = from.z + (e.origin.z - from.z) * f + (rnd() - 0.5) * j
          const s = speed * (0.75 + rnd() * 0.5)
          // Hereda el 60 % de la velocidad de la nave: la estela se estira detrás al avanzar.
          vel[i * 3] = e.direction.x * s + e.velocity.x * inherit + (rnd() - 0.5) * 0.8
          vel[i * 3 + 1] = e.direction.y * s + e.velocity.y * inherit + (rnd() - 0.5) * 0.8
          vel[i * 3 + 2] = e.direction.z * s + e.velocity.z * inherit + (rnd() - 0.5) * 0.8
          maxLife[i] = lifeSpan * (0.7 + rnd() * 0.6)
          life[i] = 1
          size[i] = (0.05 + rnd() * 0.05) * (0.7 + 0.9 * k) * sizeScale
        }
      }
    }
    if (prev.current) prev.current.copy(e.origin)
    else prev.current = e.origin.clone()
    geometry.attributes.position!.needsUpdate = true
    geometry.attributes.aLife!.needsUpdate = true
    geometry.attributes.aSize!.needsUpdate = true
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />
}
