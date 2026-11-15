import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DynamicDrawUsage, Euler, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type MeshStandardMaterial } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fbm3, makeNoise3 } from '../engine/noise'
import type { ScatteredBody } from '../engine/scatter'
import { loadTexture } from './textureCache'

/**
 * Forma base de roca: icosaedro subdividido deformado con ruido suave (bultos y entrantes, no
 * pinchos), con normales suavizadas para que el relieve de la textura se lea bien. La usan también
 * los asteroides que cruzan el sector.
 */
export function rockGeometry(seed: number, detail: number): BufferGeometry {
  const ico = new IcosahedronGeometry(1, detail)
  ico.deleteAttribute('normal')
  const g = mergeVertices(ico)
  const noise = makeNoise3(seed)
  const p = g.attributes.position!
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const k = 0.62 + 0.62 * fbm3(noise, x * 1.4 + 5, y * 1.4, z * 1.4, 4)
    p.setXYZ(i, x * k, y * k * 0.8, z * k * 1.08)
  }
  g.computeVertexNormals()
  return g
}

interface Props {
  bodies: readonly ScatteredBody[]
  palette: readonly [string, string, string]
  spin: boolean
}

/**
 * Cuerpos pequeños instanciados (un draw call por forma base), con variación de tamaño, giro y
 * tono. La superficie usa el mapa lunar de NASA (color y relieve) teñido por instancia.
 */
export function SmallBodies({ bodies, palette, spin }: Props) {
  const geometries = useMemo(() => [0, 1, 2].map((v) => rockGeometry(900 + v * 17, 3)), [])
  // Textura lunar (color + relieve) en las rocas; mientras carga, color liso.
  const invalidate = useThree((st) => st.invalidate)
  const materials = useRef<(MeshStandardMaterial | null)[]>([])
  const setMaterial = (v: number) => (m: MeshStandardMaterial | null) => {
    materials.current[v] = m
  }
  useEffect(() => {
    let alive = true
    Promise.all([loadTexture('luna-color'), loadTexture('luna-relieve', 'data')]).then(([map, bump]) => {
      if (!alive) return
      for (const m of materials.current) {
        if (!m) continue
        m.map = map
        m.bumpMap = bump
        m.needsUpdate = true
      }
      invalidate()
    }, () => {})
    return () => {
      alive = false
    }
  }, [invalidate, bodies])
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

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
            <meshStandardMaterial ref={setMaterial(v)} roughness={0.92} metalness={0} bumpScale={2.2} />
          </instancedMesh>
        ),
      )}
    </>
  )
}
