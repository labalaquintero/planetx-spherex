import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type PerspectiveCamera, type Vector3 } from 'three'
import { mulberry32 } from '../engine/random'
import { TRAIL_FRAG, TRAIL_VERT } from './shaders/sky'

interface Props {
  count: number
  /** Tobera y dirección de salida en el espacio del rig (se recalculan si cambia el encuadre). */
  origin: Vector3
  direction: Vector3
  /** Empuje actual 0..1 (se lee en cada cuadro). */
  thrust: () => number
  animate: boolean
}

/**
 * Estela de partículas del motor (Points aditivos, un draw call). Cuanto más empuje, más
 * partículas, más rápidas y más largas: reacciona al avanzar.
 */
export function Trail({ count, origin, direction, thrust, animate }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const height = useThree((s) => s.size.height)
  const dpr = useThree((s) => s.viewport.dpr)
  const rnd = useMemo(() => mulberry32(77), [])
  const state = useRef({ budget: 0 })

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
        uniforms: { uScale: { value: 1 }, uHot: { value: new Color('#7dd3fc').multiplyScalar(0.9) }, uCool: { value: new Color('#0369a1').multiplyScalar(0.6) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const k = thrust()
    material.uniforms.uScale!.value = (height * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360))
    if (!animate) {
      // Movimiento reducido: un brillo fijo y corto, sin partículas en movimiento.
      for (let i = 0; i < count; i++) life[i] = 0
      life[0] = 0.9
      pos[0] = origin.x
      pos[1] = origin.y
      pos[2] = origin.z
      size[0] = 0.06
    } else {
      const lifeSpan = 0.25 + 0.45 * k
      state.current.budget += ((count / lifeSpan) * dt * (0.35 + 0.65 * k))
      const speed = 2 + 10 * k
      for (let i = 0; i < count; i++) {
        if (life[i]! > 0) {
          life[i] = life[i]! - dt / maxLife[i]!
          pos[i * 3] = pos[i * 3]! + vel[i * 3]! * dt
          pos[i * 3 + 1] = pos[i * 3 + 1]! + vel[i * 3 + 1]! * dt
          pos[i * 3 + 2] = pos[i * 3 + 2]! + vel[i * 3 + 2]! * dt
        } else if (state.current.budget >= 1) {
          state.current.budget -= 1
          const j = 0.09
          pos[i * 3] = origin.x + (rnd() - 0.5) * j
          pos[i * 3 + 1] = origin.y + (rnd() - 0.5) * j
          pos[i * 3 + 2] = origin.z + (rnd() - 0.5) * j
          const s = speed * (0.75 + rnd() * 0.5)
          vel[i * 3] = direction.x * s + (rnd() - 0.5) * 0.6
          vel[i * 3 + 1] = direction.y * s + (rnd() - 0.5) * 0.6
          vel[i * 3 + 2] = direction.z * s + (rnd() - 0.5) * 0.6
          maxLife[i] = lifeSpan * (0.7 + rnd() * 0.6)
          life[i] = 1
          size[i] = (0.022 + rnd() * 0.022) * (0.7 + 0.8 * k)
        }
      }
      state.current.budget = Math.min(state.current.budget, count)
    }
    geometry.attributes.position!.needsUpdate = true
    geometry.attributes.aLife!.needsUpdate = true
    geometry.attributes.aSize!.needsUpdate = true
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />
}
