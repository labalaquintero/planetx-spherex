import { useEffect, useMemo, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, ShaderMaterial } from 'three'
import type { FlightState } from '../engine/flight'
import { SHIP } from '../engine/shipSpec'
import { OUTPUT } from './shaders/common'

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
  float a = f * uStrength;
  gl_FragColor = vec4(uColor * a, a);
  ${OUTPUT}
}
`

/**
 * Destello de «escudo» alrededor de la nave: invisible en vuelo normal; se enciende muy tenue al rozar
 * un objeto y algo más en un impacto, y se apaga solo. Efecto, no un objeto de la escena.
 */
export function Shield({ state, animate }: { state: MutableRefObject<FlightState>; animate: boolean }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uColor: { value: new Color('#7dd3fc') }, uStrength: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    const s = state.current
    // Leve: con el bloom, un valor alto tapa la nave y medio planeta con un resplandor blanco.
    material.uniforms.uStrength!.value = animate ? Math.min(0.55, s.contact * 0.22 + s.jolt * 0.5) : 0
  })
  const len = (SHIP.tailZ - SHIP.noseZ) / 2 + 0.3
  return (
    <mesh material={material} scale={[SHIP.tipX + 0.4, 0.9, len]} position={[0, 0, (SHIP.tailZ + SHIP.noseZ) / 2]} renderOrder={5}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  )
}
