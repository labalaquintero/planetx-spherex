import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DynamicDrawUsage, Euler, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { mulberry32 } from '../engine/random'
import { scatterBodies, type ScatteredBody } from '../engine/scatter'
import { BASE_FOV_DEG } from '../engine/motion'
import { REFERENCE_ASPECT, worldToScreen } from '../engine/projection'
import type { SceneObject, SectorScene } from '../engine/types'

const VARIANTS = 3

/** Forma base: icosaedro deformado (sombreado plano), una por variante. */
function baseGeometry(seed: number, detail: number): IcosahedronGeometry {
  const g = new IcosahedronGeometry(1, detail)
  const rnd = mulberry32(seed)
  const p = g.attributes.position!
  const shift = new Map<string, number>()
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`
    let k = shift.get(key)
    if (k === undefined) {
      k = 0.68 + rnd() * 0.62
      shift.set(key, k)
    }
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.82, p.getZ(i) * k * 1.05)
  }
  g.computeVertexNormals()
  return g
}

interface Props {
  scene: SectorScene
  /** Cuántos del relleno se dibujan (calidad). */
  debris: number
  spin: boolean
}

/**
 * Cuerpos pequeños: los del boceto (objetos `smallBody`) más el relleno sembrado, todos con
 * instancias (un draw call por forma base) y variación de tamaño, giro y color.
 */
export function SmallBodies({ scene, debris, spin }: Props) {
  const bodies = useMemo<ScatteredBody[]>(() => {
    const listed = scene.objects
      .filter((o: SceneObject) => o.kind === 'smallBody')
      .map((o, i) => {
        const r = mulberry32(o.seed)
        return {
          position: o.position,
          radius: o.radius,
          rotation: [r() * 6.28, r() * 6.28, r() * 6.28] as const,
          spin: (r() * 2 - 1) * 0.3,
          tint: r(),
          variant: i % VARIANTS,
        }
      })
    // La vista inicial reproduce el boceto: el relleno no aparece en ella (salvo muy lejos);
    // se descubre al moverse.
    const start = scene.waypoints.find((w) => w.id === scene.startId)
    const cam = start && { position: start.position, yawDeg: start.yawDeg, pitchDeg: start.pitchDeg, fovDeg: BASE_FOV_DEG, aspect: REFERENCE_ASPECT }
    const inView = (p: readonly [number, number, number]) => {
      if (!cam) return false
      const s = worldToScreen(p, cam)
      return s.depth > 0 && s.depth < 320 && s.u > -0.08 && s.u < 1.08 && s.v > -0.08 && s.v < 1.08
    }
    const extra = scene.field ? scatterBodies(scene.field, scene.waypoints, scene.objects, debris, VARIANTS, inView) : []
    return [...listed, ...extra]
  }, [scene, debris])

  const geometries = useMemo(() => [0, 1, 2].map((v) => baseGeometry(900 + v * 17, v === 2 ? 2 : 1)), [])
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  const palette = scene.field?.palette ?? ['#9a9083', '#6b6358', '#3d3832']
  const refs = useRef<(InstancedMesh | null)[]>([])
  const groups = useMemo(() => [0, 1, 2].map((v) => bodies.filter((b) => b.variant === v)), [bodies])

  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() }), [])

  const write = (time: number) => {
    groups.forEach((list, v) => {
      const mesh = refs.current[v]
      if (!mesh) return
      list.forEach((b, i) => {
        tmp.e.set(b.rotation[0] + b.spin * time, b.rotation[1] + b.spin * time * 0.7, b.rotation[2])
        tmp.q.setFromEuler(tmp.e)
        tmp.p.set(...b.position)
        tmp.s.setScalar(b.radius)
        mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s))
      })
      mesh.instanceMatrix.needsUpdate = true
    })
  }

  useLayoutEffect(() => {
    const c0 = new Color(palette[0])
    const c2 = new Color(palette[2])
    const c = new Color()
    groups.forEach((list, v) => {
      const mesh = refs.current[v]
      if (!mesh) return
      list.forEach((b, i) => mesh.setColorAt(i, c.copy(c2).lerp(c0, 0.35 + b.tint * 0.65)))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    })
    write(0)
  })

  useFrame((state) => {
    if (spin) write(state.clock.elapsedTime)
  })

  return (
    <>
      {groups.map((list, v) =>
        list.length === 0 ? null : (
          <instancedMesh
            key={`${v}-${list.length}`}
            ref={(m) => {
              refs.current[v] = m
            }}
            args={[geometries[v], undefined, list.length]}
            frustumCulled={false}
          >
            <meshStandardMaterial flatShading roughness={0.95} metalness={0} />
          </instancedMesh>
        ),
      )}
    </>
  )
}
