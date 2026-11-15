import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, BufferAttribute, BufferGeometry, ShaderMaterial, type Mesh, type Points, type WebGLCubeRenderTarget } from 'three'
import { mulberry32 } from '../engine/random'
import { LIGHT_DIR } from './light'
import { bakeCube, bakedAllFaces } from './bake'
import { SKY_BAKE_FRAG, SKY_CUBE_FRAG, SKY_FRAG, SKY_VERT, STARS_FRAG, STARS_VERT } from './shaders/sky'

interface Props {
  stars: number
  octaves: number
  /** Resolución por cara del cubemap donde se hornea la nebulosa. */
  cube: number
  animate: boolean
}

/**
 * Fondo: esfera de cielo (nebulosa tenue y estrella clave) que acompaña a la cámara, y un campo de
 * estrellas en un único draw call (Points con atributos por estrella: tamaño, color y fase). La
 * nebulosa se hornea una vez en un cubemap; la estrella clave se calcula al vuelo (es nítida).
 */
export function Sky({ stars, octaves, cube, animate }: Props) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const dpr = useThree((s) => s.viewport.dpr)
  const skyRef = useRef<Mesh>(null)
  const starsRef = useRef<Points>(null)

  // En un efecto (no en useMemo): con StrictMode, el cubemap desechado no se reutiliza vacío.
  // 'live': el horneado falló en esta GPU y se usa el shader al vuelo (más caro, pero sin huecos negros).
  const [baked, setBaked] = useState<WebGLCubeRenderTarget | 'live' | null>(null)
  useEffect(() => {
    let rt: WebGLCubeRenderTarget | null = null
    try {
      rt = bakeCube(gl, SKY_BAKE_FRAG, { uOct: { value: Math.min(octaves, 4) } }, cube)
    } catch {
      rt = null
    }
    if (rt && bakedAllFaces(gl, rt)) {
      setBaked(rt)
    } else {
      rt?.dispose()
      rt = null
      setBaked('live')
    }
    return () => rt?.dispose()
  }, [gl, octaves, cube])
  const skyMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_CUBE_FRAG,
        uniforms: { uSky: { value: null }, uLight: { value: LIGHT_DIR }, uStarGain: { value: 1 } },
        side: BackSide,
        depthWrite: false,
      }),
    [],
  )
  const liveMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: { uLight: { value: LIGHT_DIR }, uOct: { value: 4 }, uStarGain: { value: 1 } },
        side: BackSide,
        depthWrite: false,
      }),
    [],
  )
  liveMat.uniforms.uOct!.value = Math.min(octaves, 4)
  if (baked && baked !== 'live') skyMat.uniforms.uSky!.value = baked.texture

  const geometry = useMemo(() => {
    const rnd = mulberry32(2024)
    const pos = new Float32Array(stars * 3)
    const size = new Float32Array(stars)
    const phase = new Float32Array(stars)
    const col = new Float32Array(stars * 3)
    for (let i = 0; i < stars; i++) {
      const z = rnd() * 2 - 1
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(1 - z * z)
      pos[i * 3] = Math.cos(a) * r * 1400
      pos[i * 3 + 1] = z * 1400
      pos[i * 3 + 2] = Math.sin(a) * r * 1400
      // Pocas estrellas brillantes, muchas tenues (como un cielo real).
      const m = Math.pow(rnd(), 3.2)
      size[i] = 1.2 + m * 3.2
      phase[i] = rnd()
      const warm = rnd()
      const lum = 0.35 + m * 0.9
      col[i * 3] = lum * (0.82 + warm * 0.18)
      col[i * 3 + 1] = lum * 0.9
      col[i * 3 + 2] = lum * (1 - warm * 0.22)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    g.setAttribute('aPhase', new BufferAttribute(phase, 1))
    g.setAttribute('aColor', new BufferAttribute(col, 3))
    return g
  }, [stars])

  const starsMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: STARS_VERT,
        fragmentShader: STARS_FRAG,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => {
      skyMat.dispose()
      liveMat.dispose()
      starsMat.dispose()
    },
    [skyMat, liveMat, starsMat],
  )

  useFrame((state) => {
    // El cielo y las estrellas están «en el infinito»: siguen a la cámara.
    skyRef.current?.position.copy(camera.position)
    starsRef.current?.position.copy(camera.position)
    starsMat.uniforms.uPixelRatio!.value = dpr
    if (animate) starsMat.uniforms.uTime!.value = state.clock.elapsedTime
  })

  return (
    <>
      {baked && (
        <mesh ref={skyRef} material={baked === 'live' ? liveMat : skyMat} renderOrder={-2} frustumCulled={false}>
          <sphereGeometry args={[1800, 48, 24]} />
        </mesh>
      )}
      <points ref={starsRef} geometry={geometry} material={starsMat} renderOrder={-1} frustumCulled={false} />
    </>
  )
}
