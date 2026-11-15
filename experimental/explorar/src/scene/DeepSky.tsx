import { useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type WebGLCubeRenderTarget } from 'three'
import type { Bounds } from '../engine/flight'
import { mulberry32 } from '../engine/random'
import { bakeCube } from './bake'
import { BAKE_DECODE, BAKE_ENCODE, DIR_VERT, NOISE, OUTPUT } from './shaders/common'

/**
 * Profundidad del cielo: estrellas cercanas fijas en el sector (dan paralaje al volar, a diferencia
 * del cielo lejano, que acompaña a la cámara) y capas de nebulosa a distancia finita, aditivas y
 * tenues (horneadas una vez en cubemaps). Cantidad y capas según la calidad.
 */
export function DeepSky({ bounds, stars, layers, cube, animate }: { bounds: Bounds; stars: number; layers: number; cube: number; animate: boolean }) {
  const center = useMemo(
    () => [0, 1, 2].map((i) => (bounds.min[i]! + bounds.max[i]!) / 2) as [number, number, number],
    [bounds],
  )
  // Radio que envuelve todo el sector (del centro a una esquina del área de vuelo). Estrellas cercanas y
  // nebulosa van por fuera: así quedan siempre detrás de los planetas (no se pintan encima de los lejanos)
  // y la nave nunca sale de la nebulosa (no se ve como una bola desde fuera).
  const reach = useMemo(
    () => Math.max(760, 0.5 * Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2])),
    [bounds],
  )
  return (
    <group position={center}>
      {stars > 0 && <NearStars count={stars} animate={animate} inner={reach * 1.02} />}
      {Array.from({ length: layers }, (_, i) => (
        <NebulaShell key={i} index={i} cube={cube} radius={reach * 1.1 + i * 260} />
      ))}
    </group>
  )
}

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
varying vec3 vColor;
varying float vTw;
void main() {
  vColor = aColor;
  vTw = 0.8 + 0.2 * sin(uTime * (0.4 + aPhase * 2.0) + aPhase * 30.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // Tamaño según distancia, acotado: las cercanas se ven algo mayores, nunca discos.
  gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 3.6);
  gl_Position = projectionMatrix * mv;
}
`
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vTw;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, r);
  gl_FragColor = vec4(vColor * vTw * a, a);
  ${OUTPUT}
}
`

function NearStars({ count, animate, inner }: { count: number; animate: boolean; inner: number }) {
  const height = useThree((s) => s.size.height)
  const geometry = useMemo(() => {
    const r = mulberry32(909)
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const phase = new Float32Array(count)
    const col = new Float32Array(count * 3)
    const tmp = new Color()
    for (let i = 0; i < count; i++) {
      // Capa justo por fuera del sector (desde `inner`, unas 500 unidades de grosor).
      const z = r() * 2 - 1
      const a = r() * Math.PI * 2
      const k = Math.sqrt(1 - z * z)
      const d = inner + Math.pow(r(), 0.7) * 500
      pos[i * 3] = Math.cos(a) * k * d
      pos[i * 3 + 1] = z * d
      pos[i * 3 + 2] = Math.sin(a) * k * d
      size[i] = 300 + Math.pow(r(), 3) * 1400
      phase[i] = r()
      // Temperatura de color: mayoría blancas azuladas, algunas cálidas.
      const t = r()
      tmp.setHSL(t < 0.75 ? 0.6 : 0.08, t < 0.75 ? 0.35 : 0.55, 0.72 + r() * 0.2)
      col[i * 3] = tmp.r
      col[i * 3 + 1] = tmp.g
      col[i * 3 + 2] = tmp.b
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    g.setAttribute('aPhase', new BufferAttribute(phase, 1))
    g.setAttribute('aColor', new BufferAttribute(col, 3))
    return g
  }, [count, inner])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useFrame((state) => {
    material.uniforms.uScale!.value = height / 720
    if (animate) material.uniforms.uTime!.value = state.clock.elapsedTime
  })
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />
}

/**
 * Horneado de una capa: lo que antes se sumaba en pantalla con mezcla aditiva (color · alfa²), ya
 * calculado. Solo depende de la dirección en el espacio de la cáscara.
 */
const NEB_BAKE_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uSeed;
uniform float uAlpha;
varying vec3 vDir;
${NOISE}
${BAKE_ENCODE}
void main() {
  vec3 d = normalize(vDir) * 2.0 + uSeed;
  vec3 w = vec3(ex_fbm(d * 1.3, 4), ex_fbm(d * 1.3 + 7.7, 4), ex_fbm(d * 1.3 + 3.1, 4));
  float n = ex_fbm(d * 1.9 + w * 2.2, 5);
  float wisps = smoothstep(0.52, 0.85, n);
  float holes = smoothstep(0.35, 0.7, ex_fbm(d * 3.7 + w, 3));
  vec3 col = mix(uA, uB, smoothstep(0.4, 0.9, w.x));
  float a = wisps * holes * uAlpha;
  gl_FragColor = ex_encode(col * a * a);
}
`
const NEB_FRAG = /* glsl */ `
uniform samplerCube uNeb;
varying vec3 vDir;
${BAKE_DECODE}
void main() {
  gl_FragColor = vec4(ex_decode(textureCube(uNeb, normalize(vDir)).rgb), 1.0);
  ${OUTPUT}
}
`

/** Capa de nebulosa (cáscara esférica vista por dentro): violeta–magenta y turquesa apagados. */
function NebulaShell({ index, cube, radius }: { index: number; cube: number; radius: number }) {
  const gl = useThree((s) => s.gl)
  // En un efecto (no en useMemo): con StrictMode, el cubemap desechado no se reutiliza vacío.
  const [baked, setBaked] = useState<WebGLCubeRenderTarget | null>(null)
  useEffect(() => {
    const rt = bakeCube(
      gl,
      NEB_BAKE_FRAG,
      {
        uA: { value: new Color(index === 0 ? '#4c1d95' : '#0e7490') },
        uB: { value: new Color(index === 0 ? '#9d174d' : '#1e3a8a') },
        uSeed: { value: 3.7 + index * 11.3 },
        uAlpha: { value: index === 0 ? 0.55 : 0.4 },
      },
      cube,
    )
    setBaked(rt)
    return () => rt.dispose()
  }, [gl, index, cube])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: DIR_VERT,
        fragmentShader: NEB_FRAG,
        uniforms: { uNeb: { value: null } },
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        // Ya viene multiplicado: se suma tal cual (ONE, ONE).
        premultipliedAlpha: true,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  if (!baked) return null
  material.uniforms.uNeb!.value = baked.texture
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false} rotation={[0.3 * index, 1.1 * index, 0]}>
      <sphereGeometry args={[radius, 48, 24]} />
    </mesh>
  )
}
