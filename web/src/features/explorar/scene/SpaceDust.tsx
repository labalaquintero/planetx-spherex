import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, Vector3, type LineSegments } from 'three'
import { mulberry32 } from '../engine/random'

/**
 * Polvo fino alrededor de la cámara (segmentos aditivos, un draw call). Da referencia de
 * movimiento: casi invisible quieto, se estira en rayas cortas con la velocidad. Es un efecto, no un
 * objeto de la escena.
 */
export function SpaceDust({ count, animate }: { count: number; animate: boolean }) {
  const camera = useThree((s) => s.camera)
  const BOX = 70
  const ref = useRef<LineSegments>(null)
  const prev = useRef(new Vector3())
  const vel = useRef(new Vector3())
  const seeds = useMemo(() => {
    const r = mulberry32(31)
    return Float32Array.from({ length: count * 3 }, () => (r() - 0.5) * BOX)
  }, [count])
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 6), 3))
    return g
  }, [count])
  useEffect(() => () => geometry.dispose(), [geometry])
  const material = useMemo(
    () => new LineBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    const dt = Math.max(1e-3, Math.min(delta, 0.1))
    const c = camera.position
    vel.current.set((c.x - prev.current.x) / dt, (c.y - prev.current.y) / dt, (c.z - prev.current.z) / dt)
    prev.current.copy(c)
    if (vel.current.length() > 200) vel.current.set(0, 0, 0) // teletransporte (llegada): sin raya
    const streak = animate ? 0.035 : 0
    const a = geometry.attributes.position!.array as Float32Array
    for (let i = 0; i < count; i++) {
      // Posición envuelta en una caja que acompaña a la cámara.
      const wrap = (s: number, cc: number) => cc + ((((s - cc) % BOX) + BOX * 1.5) % BOX) - BOX / 2
      const x = wrap(seeds[i * 3]!, c.x)
      const y = wrap(seeds[i * 3 + 1]!, c.y)
      const z = wrap(seeds[i * 3 + 2]!, c.z)
      a[i * 6] = x
      a[i * 6 + 1] = y
      a[i * 6 + 2] = z
      a[i * 6 + 3] = x - vel.current.x * streak - 0.02
      a[i * 6 + 4] = y - vel.current.y * streak
      a[i * 6 + 5] = z - vel.current.z * streak
    }
    geometry.attributes.position!.needsUpdate = true
    material.opacity = 0.1 + Math.min(0.28, vel.current.length() / 90)
  })

  return <lineSegments ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />
}
