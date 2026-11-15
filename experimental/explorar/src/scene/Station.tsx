import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, MeshBasicMaterial } from 'three'
import type { SceneObject } from '../engine/types'
import { makeHullTexture } from './textures'

/** Estación: cuerpo cilíndrico con paneles y ventanas, tapas, anillo con radios y luces de posición. */
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

  useFrame((state, delta) => {
    if (!spin) return
    if (ringRef.current) ringRef.current.rotation.y += delta * 0.12
    const t = state.clock.elapsedTime
    lights.current.forEach((m, i) => {
      // Parpadeo corto, desfasado por luz.
      if (m) m.opacity = (t + i * 0.37) % 1.6 < 0.18 ? 1 : 0.15
    })
  })

  const tips: [number, number, number][] = [
    [0, length / 2 + o.radius * 0.35, 0],
    [0, -length / 2 - o.radius * 0.35, 0],
    [o.radius * 2.4, 0, 0],
    [-o.radius * 2.4, 0, 0],
  ]

  return (
    <group position={[...o.position]} rotation={[0, 0.5, 0.18]}>
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
            <cylinderGeometry args={[o.radius * 1.12, o.radius * 1.12, o.radius * 0.5, 32]} />
            <meshStandardMaterial color={o.palette[2]} metalness={0.35} roughness={0.5} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`dock${s}`} position={[0, s * (length / 2 + o.radius * 0.3), 0]}>
            <cylinderGeometry args={[o.radius * 0.35, o.radius * 0.45, o.radius * 0.35, 16]} />
            <meshStandardMaterial color={o.palette[1]} metalness={0.4} roughness={0.45} />
          </mesh>
        ))}
        <group ref={ringRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[o.radius * 2.4, o.radius * 0.28, 12, 64]} />
            <meshStandardMaterial color={o.palette[1]} metalness={0.3} roughness={0.5} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
              <boxGeometry args={[o.radius * 4.8, o.radius * 0.1, o.radius * 0.1]} />
              <meshStandardMaterial color={o.palette[2]} metalness={0.3} roughness={0.5} />
            </mesh>
          ))}
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
    </group>
  )
}
