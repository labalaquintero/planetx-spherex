import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Group,
  type Mesh,
  type PointLight,
} from 'three'
import { DIVE, diveFrame, type DivePlan } from '../engine/dive'
import type { SceneObject } from '../engine/types'
import { mulberry32 } from '../engine/random'
import { NOISE, OUTPUT } from './shaders/common'

/** Travesía en curso (la escribe FlightRig y la lee este efecto). */
export interface ActiveDive {
  plan: DivePlan
  /** Reloj de la escena al empezar (s). */
  t0: number
}

const GAS_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

/**
 * Interior del planeta gaseoso, visto desde dentro: nubes en la paleta del planeta, estiradas en la
 * dirección del viaje y corriendo hacia atrás (efecto túnel), con un resplandor al frente y relámpagos.
 */
const GAS_FRAG = /* glsl */ `
uniform vec3 uCenter;
uniform float uRadius;
uniform vec3 uDir;
uniform float uTime;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uAtmo;
uniform float uFlash;
uniform float uDepth;
varying vec3 vWorld;
${NOISE}
void main() {
  vec3 view = normalize(vWorld - cameraPosition);
  float ahead = dot(view, uDir);
  // Espacio de ruido estirado a lo largo del viaje y desplazado con el tiempo: vetas que pasan hacia atrás.
  vec3 q = view * 3.0;
  vec3 qd = uDir * dot(q, uDir);
  vec3 qp = q - qd;
  vec3 p = qp * 2.4 + qd * 0.45 + uDir * (uTime * 2.6);
  float n = ex_fbm(p, 5);
  float n2 = ex_fbm(p * 2.3 + vec3(7.1, 3.3, 1.7), 4);
  // Bandas de nubes del gigante gaseoso (según la latitud dentro del planeta).
  float lat = (vWorld.y - uCenter.y) / uRadius;
  float bands = 0.5 + 0.5 * sin(lat * 16.0 + n * 5.0);
  vec3 col = mix(uC0, uC1, smoothstep(0.28, 0.72, n));
  col = mix(col, uC2, smoothstep(0.55, 0.85, n2) * 0.75);
  col = mix(col, uAtmo, 0.3 * bands);
  // Más oscuro a los lados y en lo hondo; resplandor al frente (hacia la salida).
  col *= (0.45 + 0.65 * smoothstep(-0.3, 1.0, ahead)) * (1.0 - 0.35 * uDepth);
  col += uAtmo * pow(max(ahead, 0.0), 10.0) * 1.1;
  // Relámpago: toda la nube se ilumina desde dentro.
  col += mix(uAtmo, vec3(1.0), 0.6) * uFlash * (0.35 + 0.9 * n2);
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
}
`

/** Relámpagos en la parte interior (DIVE.flashes, fracciones de la secuencia), con caída rápida. */
function lightning(u: number): number {
  let f = 0
  for (const at of DIVE.flashes) {
    const d = (u - at) * DIVE.seconds
    if (d >= 0 && d < 0.35) f = Math.max(f, Math.exp(-d * 12) * (0.7 + 0.3 * Math.sin(d * 90)))
  }
  return f
}

interface Props {
  dive: MutableRefObject<ActiveDive | null>
  objects: readonly SceneObject[]
}

const LINES = 420

/** Efectos de la travesía: interior gaseoso, líneas de velocidad y luz del gas sobre la nave. */
export function DiveFX({ dive, objects }: Props) {
  const camera = useThree((s) => s.camera)
  const gas = useRef<Mesh>(null)
  const lines = useRef<Group>(null)
  const light = useRef<PointLight>(null)
  const tmp = useMemo(() => ({ q: new Quaternion(), z: new Vector3(0, 0, -1), d: new Vector3(), c: new Vector3() }), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: GAS_VERT,
        fragmentShader: GAS_FRAG,
        uniforms: {
          uCenter: { value: new Vector3() },
          uRadius: { value: 1 },
          uDir: { value: new Vector3(0, 0, -1) },
          uTime: { value: 0 },
          uC0: { value: new Color() },
          uC1: { value: new Color() },
          uC2: { value: new Color() },
          uAtmo: { value: new Color() },
          uFlash: { value: 0 },
          uDepth: { value: 0 },
        },
        side: BackSide,
        // Escribe profundidad: dentro del planeta tapa el cielo, la nebulosa y los demás planetas (la nave,
        // más cerca, sí se ve).
        depthWrite: true,
      }),
    [],
  )
  // Líneas de velocidad en un cilindro alrededor de la nave (marco local: −Z es hacia delante).
  const lineGeo = useMemo(() => {
    const r = mulberry32(31)
    const pos = new Float32Array(LINES * 6)
    for (let i = 0; i < LINES; i++) {
      const a = r() * Math.PI * 2
      const rad = 3 + r() * 26
      const z = -70 + r() * 140
      const len = 4 + r() * 10
      pos.set([Math.cos(a) * rad, Math.sin(a) * rad, z, Math.cos(a) * rad, Math.sin(a) * rad, z + len], i * 6)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return g
  }, [])
  const lineMat = useMemo(() => new LineBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }), [])
  useEffect(
    () => () => {
      material.dispose()
      lineGeo.dispose()
      lineMat.dispose()
    },
    [material, lineGeo, lineMat],
  )
  const current = useRef<string | null>(null)

  useFrame((state, delta) => {
    const d = dive.current
    const g = gas.current
    if (!g || !lines.current || !light.current) return
    if (!d) {
      g.visible = false
      lines.current.visible = false
      light.current.intensity = 0
      current.current = null
      return
    }
    const { plan } = d
    const u = material.uniforms
    // Colores del planeta que se cruza (una vez por travesía).
    if (current.current !== plan.id) {
      const o = objects.find((x) => x.id === plan.id)
      if (o) {
        u.uC0!.value.set(o.palette[2])
        u.uC1!.value.set(o.palette[1])
        u.uC2!.value.set(o.palette[0])
        u.uAtmo!.value.set(o.atmosphere ?? o.palette[0])
        lineMat.color.set(o.atmosphere ?? '#e0f2fe').lerp(new Color('#ffffff'), 0.5)
      }
      current.current = plan.id
    }
    const t = state.clock.elapsedTime - d.t0
    const f = diveFrame(plan, t)
    tmp.c.set(...plan.center)
    const camInside = camera.position.distanceTo(tmp.c) < plan.radius * 0.995
    // El interior solo se ve con la cámara dentro del planeta.
    g.visible = camInside
    g.position.copy(tmp.c)
    g.scale.setScalar(plan.radius * 0.99)
    u.uCenter!.value.copy(tmp.c)
    u.uRadius!.value = plan.radius
    u.uDir!.value.set(...plan.dir)
    u.uTime!.value = t
    u.uFlash!.value = lightning(f.u)
    u.uDepth!.value = f.depth
    // Líneas de velocidad: corren hacia atrás alrededor de la nave mientras está dentro (y al salir).
    tmp.d.set(...plan.dir)
    tmp.q.setFromUnitVectors(tmp.z, tmp.d)
    lines.current.visible = f.phase !== 'approach' || f.u > DIVE.enterAt * 0.7
    lines.current.position.set(...f.position)
    lines.current.quaternion.copy(tmp.q)
    const arr = lineGeo.attributes.position!.array as Float32Array
    const speed = (f.phase === 'inside' ? 220 : 120) * Math.min(delta, 0.05)
    for (let i = 0; i < LINES; i++) {
      for (const k of [2, 5]) {
        arr[i * 6 + k]! += speed
      }
      if (arr[i * 6 + 2]! > 70) {
        arr[i * 6 + 2]! -= 140
        arr[i * 6 + 5]! -= 140
      }
    }
    lineGeo.attributes.position!.needsUpdate = true
    lineMat.opacity = Math.min(0.85, 0.15 + f.depth * 0.9) * (f.phase === 'exit' ? 1 - (f.u - DIVE.exitAt) / (1 - DIVE.exitAt) : 1)
    // Luz del gas sobre la nave (y destello del relámpago).
    light.current.position.set(...f.position)
    light.current.color.copy(u.uAtmo!.value)
    light.current.intensity = f.depth * 6 + u.uFlash!.value * 18
  })

  return (
    <>
      <mesh ref={gas} material={material} visible={false} frustumCulled={false} renderOrder={-1.5}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
      <group ref={lines} visible={false}>
        <lineSegments geometry={lineGeo} material={lineMat} frustumCulled={false} />
      </group>
      <pointLight ref={light} intensity={0} distance={40} decay={1.2} />
    </>
  )
}
