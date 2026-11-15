import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import { mulberry32 } from '../engine/random'

/** Campo de estrellas de fondo: puntos en una esfera grande. Determinista y sin texturas. */
export function Stars({ count = 1800, radius = 1400 }: { count?: number; radius?: number }) {
  const geometry = useMemo(() => {
    const rnd = mulberry32(2024)
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Dirección uniforme sobre la esfera.
      const z = rnd() * 2 - 1
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(1 - z * z)
      pos[i * 3] = Math.cos(a) * r * radius
      pos[i * 3 + 1] = z * radius
      pos[i * 3 + 2] = Math.sin(a) * r * radius
      const warm = rnd()
      const lum = 0.45 + rnd() * 0.55
      col[i * 3] = lum * (0.8 + warm * 0.2)
      col[i * 3 + 1] = lum * 0.9
      col[i * 3 + 2] = lum * (1 - warm * 0.2)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('color', new BufferAttribute(col, 3))
    return g
  }, [count, radius])

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={1.6} sizeAttenuation={false} vertexColors depthWrite={false} />
    </points>
  )
}
