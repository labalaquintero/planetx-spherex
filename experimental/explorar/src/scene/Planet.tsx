import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, Euler, Quaternion, RingGeometry, ShaderMaterial, Vector3, type Group } from 'three'
import type { SceneObject } from '../engine/types'
import { AMBIENT_RGB, LIGHT_DIR } from './light'
import { loadTexture } from './textureCache'
import { mulberry32 } from '../engine/random'
import { ATMOS_FRAG, ATMOS_VERT, PLANET_FRAG, PLANET_VERT, RING_FRAG, RING_VERT } from './shaders/planet'

const DEG = Math.PI / 180
/** Inclinación de la cara del anillo hacia la cámara de entrada (radianes). */
const RING_OPEN = 0.42

interface Props {
  o: SceneObject
  spin: boolean
  /** Octavas del ruido de superficie (calidad). */
  octaves: number
}

/**
 * Planeta o esfera con superficie procedural por ruido (en GPU, sin texturas), atmósfera fresnel
 * y, si tiene, anillo translúcido con sombra mutua planeta ↔ anillo. Todo iluminado por LIGHT_DIR.
 */
export function Planet({ o, spin, octaves }: Props) {
  const spinRef = useRef<Group>(null)
  const ring = o.ring
  const center = useMemo(() => new Vector3(...o.position), [o])
  // Orientación del anillo en el mundo (la misma que se aplica a su malla).
  const ringQuat = useMemo(() => {
    const tilt = new Quaternion().setFromEuler(new Euler(0, 0, (ring?.tiltDeg ?? 0) * DEG))
    const open = new Quaternion().setFromEuler(new Euler(-Math.PI / 2 + RING_OPEN, 0, 0))
    return tilt.multiply(open)
  }, [ring])
  const ringNormal = useMemo(() => new Vector3(0, 0, 1).applyQuaternion(ringQuat), [ringQuat])
  const colors = useMemo(() => o.palette.map((c) => new Color(c)), [o])
  // Tres vórtices en direcciones sembradas (solo los usa el modo «storms»).
  const vortices = useMemo(() => {
    const r = mulberry32(o.seed * 7 + 3)
    return [0, 1, 2].map(() => {
      const z = r() * 1.4 - 0.7 // lejos de los polos
      const a = r() * Math.PI * 2
      const k = Math.sqrt(1 - z * z)
      return new Vector3(Math.cos(a) * k, z, Math.sin(a) * k)
    })
  }, [o])

  const surface = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
        uniforms: {
          uC0: { value: colors[2] },
          uC1: { value: colors[1] },
          uC2: { value: colors[0] },
          uMode: { value: o.surface === 'storms' ? 2 : o.surface === 'bands' ? 1 : 0 },
          uVortex: { value: vortices },
          uGlow: { value: new Color(o.glow ?? '#000000') },
          uGlowStrength: { value: o.glow ? 0.14 : 0 },
          uSeed: { value: o.seed },
          uLight: { value: LIGHT_DIR },
          uAmbient: { value: new Color(...AMBIENT_RGB) },
          uOct: { value: octaves },
          uTime: { value: 0 },
          uCenter: { value: center },
          uRadius: { value: o.radius },
          uHasRing: { value: ring ? 1 : 0 },
          uRingNormal: { value: ringNormal },
          uRingInner: { value: ring?.inner ?? 0 },
          uRingOuter: { value: ring?.outer ?? 1 },
          uRingSeed: { value: o.seed + 5 },
          uMap: { value: null },
          uHasMap: { value: 0 },
          uMapMode: { value: o.texture?.mode === 'palette' ? 1 : 0 },
          uBump: { value: null },
          uHasBump: { value: 0 },
          uBumpScale: { value: 0.9 },
          uRingMap: { value: null },
          uHasRingMap: { value: 0 },
        },
      }),
    // octaves no es dependencia: se actualiza abajo sin recrear el material.
    [o, colors, center, ring, ringNormal, vortices],
  )
  useEffect(() => {
    surface.uniforms.uOct!.value = octaves
  }, [surface, octaves])

  const atmosphere = useMemo(
    () =>
      o.atmosphere
        ? new ShaderMaterial({
            vertexShader: ATMOS_VERT,
            fragmentShader: ATMOS_FRAG,
            uniforms: {
              uColor: { value: new Color(o.atmosphere) },
              uLight: { value: LIGHT_DIR },
              // Mundo frío: atmósfera fina (borde estrecho) y algo más tenue.
              uIntensity: { value: o.surface === 'storms' ? 1.3 : 1.6 },
              uPower: { value: o.surface === 'storms' ? 4.2 : 2.6 },
            },
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
          })
        : null,
    [o],
  )

  const ringGeo = useMemo(() => (ring ? new RingGeometry(o.radius * ring.inner, o.radius * ring.outer, 128, 1) : null), [o, ring])
  const ringMat = useMemo(
    () =>
      ring
        ? new ShaderMaterial({
            vertexShader: RING_VERT,
            fragmentShader: RING_FRAG,
            uniforms: {
              uC0: { value: colors[2] },
              uC1: { value: colors[1] },
              uC2: { value: colors[0] },
              uInner: { value: ring.inner },
              uOuter: { value: ring.outer },
              uSeed: { value: o.seed + 5 },
              uLight: { value: LIGHT_DIR },
              uCenter: { value: center },
              uRadius: { value: o.radius },
              uRingMap: { value: null },
              uHasRingMap: { value: 0 },
            },
            transparent: true,
            side: DoubleSide,
            depthWrite: false,
          })
        : null,
    [o, ring, colors, center],
  )

  useEffect(
    () => () => {
      surface.dispose()
      atmosphere?.dispose()
      ringGeo?.dispose()
      ringMat?.dispose()
    },
    [surface, atmosphere, ringGeo, ringMat],
  )

  // Texturas de referencia: carga progresiva; mientras tanto (o si fallan), superficie procedural.
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => {
    let alive = true
    const tex = o.texture
    if (!tex) return
    const set = (mat: ShaderMaterial | null, name: string, flag: string) => (t: unknown) => {
      if (!alive || !mat) return
      mat.uniforms[name]!.value = t
      mat.uniforms[flag]!.value = 1
      invalidate()
    }
    loadTexture(tex.map).then(set(surface, 'uMap', 'uHasMap'), () => {})
    if (tex.bump) loadTexture(tex.bump, 'data').then(set(surface, 'uBump', 'uHasBump'), () => {})
    if (tex.ringMap) {
      loadTexture(tex.ringMap).then(set(ringMat, 'uRingMap', 'uHasRingMap'), () => {})
      loadTexture(tex.ringMap).then(set(surface, 'uRingMap', 'uHasRingMap'), () => {})
    }
    return () => {
      alive = false
    }
  }, [o, surface, ringMat, invalidate])

  useFrame((state, delta) => {
    if (!spin) return
    if (spinRef.current) spinRef.current.rotation.y += delta * 0.012
    surface.uniforms.uTime!.value = state.clock.elapsedTime
  })

  const segments = o.radius > 6 ? [64, 48] : [32, 24]
  return (
    <group position={[...o.position]}>
      <group ref={spinRef} rotation={[0, 0, (ring ? ring.tiltDeg : 8) * DEG * 0.5]}>
        <mesh material={surface}>
          <sphereGeometry args={[o.radius, segments[0], segments[1]]} />
        </mesh>
      </group>
      {atmosphere && (
        <mesh material={atmosphere} scale={o.surface === 'storms' ? 1.035 : 1.075}>
          <sphereGeometry args={[o.radius, 48, 32]} />
        </mesh>
      )}
      {ringGeo && ringMat && <mesh geometry={ringGeo} material={ringMat} quaternion={ringQuat} renderOrder={2} />}
    </group>
  )
}
