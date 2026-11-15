import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, IcosahedronGeometry, RingGeometry, RepeatWrapping, type Mesh } from 'three'
import { mulberry32 } from '../engine/random'
import type { SceneObject } from '../engine/types'
import { makeHullTexture, makeRingTexture, makeSurfaceTexture } from './textures'

const DEG = Math.PI / 180

function useDisposable<T extends { dispose(): void }>(factory: () => T, deps: unknown[]): T {
  const value = useMemo(factory, deps)
  useEffect(() => () => value.dispose(), [value])
  return value
}

/** Giro lento y opcional (se apaga con prefers-reduced-motion). */
function useSpin(spin: boolean, speed: number) {
  const ref = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (spin && ref.current) ref.current.rotation.y += delta * speed
  })
  return ref
}

function Planet({ o, spin }: { o: SceneObject; spin: boolean }) {
  const map = useDisposable(() => makeSurfaceTexture(o), [o])
  const ref = useSpin(spin, 0.015)
  const ring = o.ring
  const ringTex = useDisposable(() => makeRingTexture(o.seed + 5, o.palette), [o])
  const ringGeo = useDisposable(() => {
    // RingGeometry reparte la UV en ángulo; aquí se necesita u = distancia radial normalizada.
    if (!ring) return new RingGeometry(1, 2, 4)
    const g = new RingGeometry(o.radius * ring.inner, o.radius * ring.outer, 96, 1)
    const p = g.attributes.position!
    const uv = g.attributes.uv!
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getY(i))
      uv.setXY(i, (d - o.radius * ring.inner) / (o.radius * (ring.outer - ring.inner)), 0.5)
    }
    return g
  }, [o, ring])

  return (
    <group position={[...o.position]}>
      <mesh ref={ref} rotation={[0, 0, (ring ? ring.tiltDeg : 8) * DEG * 0.4]}>
        <sphereGeometry args={[o.radius, 48, 32]} />
        <meshStandardMaterial map={map} roughness={0.95} metalness={0} />
      </mesh>
      {ring && (
        <group rotation={[0, 0, ring.tiltDeg * DEG]}>
          <mesh geometry={ringGeo} rotation={[-Math.PI / 2 + 0.42, 0, 0]}>
            <meshLambertMaterial map={ringTex} transparent side={DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function SmallSphere({ o, spin }: { o: SceneObject; spin: boolean }) {
  const map = useDisposable(() => makeSurfaceTexture({ ...o, surface: 'rocky' }), [o])
  const ref = useSpin(spin, 0.05)
  return (
    <mesh ref={ref} position={[...o.position]}>
      <sphereGeometry args={[o.radius, 32, 20]} />
      <meshStandardMaterial map={map} roughness={0.9} />
    </mesh>
  )
}

/** Cuerpo pequeño: icosaedro deformado con una semilla (pocos polígonos, sombreado plano). */
function SmallBody({ o, spin }: { o: SceneObject; spin: boolean }) {
  const geometry = useDisposable(() => {
    const g = new IcosahedronGeometry(o.radius, 1)
    const rnd = mulberry32(o.seed)
    const p = g.attributes.position!
    // Mismo desplazamiento para vértices coincidentes: si no, la malla se abriría.
    const shift = new Map<string, number>()
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`
      let k = shift.get(key)
      if (k === undefined) {
        k = 0.7 + rnd() * 0.6
        shift.set(key, k)
      }
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k)
    }
    g.computeVertexNormals()
    return g
  }, [o])
  const ref = useSpin(spin, 0.05 + (o.seed % 7) * 0.01)
  return (
    <mesh ref={ref} geometry={geometry} position={[...o.position]} rotation={[o.seed, o.seed * 2, 0]}>
      <meshStandardMaterial color={o.palette[0]} flatShading roughness={1} />
    </mesh>
  )
}

/** Cuerpo cilíndrico con un anillo alrededor, eje horizontal. */
function Station({ o, spin }: { o: SceneObject; spin: boolean }) {
  const length = o.length ?? o.radius * 4
  const hull = useDisposable(() => {
    const t = makeHullTexture(o.seed, o.palette)
    t.repeat.set(4, 1)
    t.wrapS = t.wrapT = RepeatWrapping
    return t
  }, [o])
  const ringRef = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (spin && ringRef.current) ringRef.current.rotation.y += delta * 0.12
  })
  return (
    <group position={[...o.position]} rotation={[0, 0.5, 0.18]}>
      {/* El cilindro se tiende a lo largo de X */}
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[o.radius, o.radius, length, 28, 1, false]} />
          <meshStandardMaterial map={hull} emissiveMap={hull} emissive="#ffffff" emissiveIntensity={0.35} metalness={0.1} roughness={0.55} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, (s * length) / 2, 0]}>
            <cylinderGeometry args={[o.radius * 1.12, o.radius * 1.12, o.radius * 0.5, 28]} />
            <meshStandardMaterial color={o.palette[2]} metalness={0.1} roughness={0.5} />
          </mesh>
        ))}
        {/* Anillo habitable alrededor del cuerpo, por el centro */}
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[o.radius * 2.4, o.radius * 0.28, 10, 56]} />
          <meshStandardMaterial color={o.palette[1]} metalness={0.1} roughness={0.5} />
        </mesh>
        {/* Radios que unen el anillo con el cuerpo */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]} position={[0, 0, 0]}>
            <boxGeometry args={[o.radius * 4.8, o.radius * 0.1, o.radius * 0.1]} />
            <meshStandardMaterial color={o.palette[2]} metalness={0.1} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function SceneObjects({ objects, spin }: { objects: readonly SceneObject[]; spin: boolean }) {
  return (
    <>
      {objects.map((o) => {
        switch (o.kind) {
          case 'planet':
          case 'ringedPlanet':
            return <Planet key={o.id} o={o} spin={spin} />
          case 'sphere':
            return <SmallSphere key={o.id} o={o} spin={spin} />
          case 'smallBody':
            return <SmallBody key={o.id} o={o} spin={spin} />
          case 'station':
            return <Station key={o.id} o={o} spin={spin} />
        }
      })}
    </>
  )
}
