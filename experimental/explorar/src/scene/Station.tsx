import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, MeshBasicMaterial } from 'three'
import type { SceneObject } from '../engine/types'
import { makeHullTexture } from './textures'

/** Estación: cuerpo cilíndrico con paneles y ventanas, tapas, asa (anillo de atraque) en un extremo y luces de posición. */
export function Station({ o, spin }: { o: SceneObject; spin: boolean }) {
  const length = o.length ?? o.radius * 4
  const hull = useMemo(() => makeHullTexture(o.seed, o.palette), [o])
  useEffect(
    () => () => {
      hull.map.dispose()
      hull.emissive.dispose()
    },
    [hull],
  )
  const ringRef = useRef<Group>(null)
  const lights = useRef<(MeshBasicMaterial | null)[]>([])

  useFrame((state) => {
    if (!spin) return
    const t = state.clock.elapsedTime
    lights.current.forEach((m, i) => {
      // Parpadeo corto, desfasado por luz.
      if (m) m.opacity = (t + i * 0.37) % 1.6 < 0.18 ? 1 : 0.15
    })
  })

  const handle = o.handle ?? { length: o.radius * 2, height: o.radius * 1.2 }
  const rot = (o.rotationDeg ?? [0, 0, 0]).map((d) => (d * Math.PI) / 180) as [number, number, number]
  const tips: [number, number, number][] = [
    [-length / 2 - o.radius * 0.35, 0, 0],
    [length / 2 + handle.length, 0, 0],
    [0, o.radius * 1.02, 0],
    [0, -o.radius * 1.02, 0],
  ]

  return (
    // El cilindro se tiende a lo largo de X (horizontal en pantalla, como en el boceto).
    <group position={[...o.position]} rotation={rot}>
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[o.radius, o.radius, length, 32, 1, false]} />
          <meshStandardMaterial
            map={hull.map}
            emissiveMap={hull.emissive}
            emissive="#ffffff"
            emissiveIntensity={1.4}
            metalness={0.35}
            roughness={0.5}
          />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, (s * length) / 2, 0]}>
            <cylinderGeometry args={[o.radius * 1.08, o.radius * 1.08, o.radius * 0.35, 32]} />
            <meshStandardMaterial color={o.palette[2]} metalness={0.35} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, -length / 2 - o.radius * 0.2, 0]}>
          <cylinderGeometry args={[o.radius * 0.35, o.radius * 0.45, o.radius * 0.35, 16]} />
          <meshStandardMaterial color={o.palette[1]} metalness={0.4} roughness={0.45} />
        </mesh>
      </group>
      {/* Asa del boceto: anillo de atraque que sale del extremo derecho, en el plano de la pantalla. */}
      <group ref={ringRef} position={[length / 2 + handle.length / 2, -o.radius * 0.15, 0]}>
        <mesh scale={[handle.length / handle.height, 1, 1]}>
          <torusGeometry args={[handle.height / 2, o.radius * 0.13, 10, 48]} />
          <meshStandardMaterial color={o.palette[1]} metalness={0.3} roughness={0.5} />
        </mesh>
      </group>
      {tips.map((p, i) => (
        <mesh key={`l${i}`} position={p}>
          <sphereGeometry args={[o.radius * 0.09, 8, 6]} />
          <meshBasicMaterial
            ref={(m) => {
              lights.current[i] = m
            }}
            color={i % 2 ? '#f87171' : '#7dd3fc'}
            transparent
            opacity={0.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
