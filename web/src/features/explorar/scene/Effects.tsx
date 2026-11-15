import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { LENS_SHADER } from './shaders/lens'

/**
 * Postproceso con los pases de three (sin dependencias nuevas): antialiasing MSAA en el
 * composer, brillo (bloom) suave en lo muy brillante y un pase de lente (aberración cromática
 * ligera, grano fino y viñeta). Al desmontarse,
 * react-three-fiber vuelve a pintar la escena sin composer.
 */
export function Bloom({ strength, samples, chromatic, grain }: { strength: number; samples: number; chromatic: number; grain: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const { composer, bloom, lens } = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples })
    const composer = new EffectComposer(gl, target)
    composer.addPass(new RenderPass(scene, camera))
    // UnrealBloomPass trabaja internamente en mips de media resolución y menos.
    const bloom = new UnrealBloomPass(new Vector2(256, 256), strength, 0.75, 0.9)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    const lens = new ShaderPass(LENS_SHADER)
    composer.addPass(lens)
    return { composer, bloom, lens }
    // strength se aplica en su propio efecto, sin recrear el composer.
  }, [gl, scene, camera, samples])
  useEffect(() => {
    composer.setPixelRatio(dpr)
    composer.setSize(size.width, size.height)
  }, [composer, size, dpr])
  useEffect(() => {
    bloom.strength = strength
    lens.uniforms.uCA!.value = chromatic
    lens.uniforms.uGrain!.value = grain
  }, [bloom, lens, strength, chromatic, grain])
  useEffect(() => () => composer.dispose(), [composer])

  useFrame((state, delta) => {
    lens.uniforms.uTime!.value = state.clock.elapsedTime
    composer.render(delta)
  }, 1)
  return null
}
