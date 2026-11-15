import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js'

/**
 * Postproceso con los pases de three (sin dependencias nuevas): antialiasing MSAA en el
 * composer, brillo (bloom) sutil solo en lo muy brillante y viñeta suave. Al desmontarse,
 * react-three-fiber vuelve a pintar la escena sin composer.
 */
export function Bloom({ strength, samples }: { strength: number; samples: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const { composer, bloom } = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples })
    const composer = new EffectComposer(gl, target)
    composer.addPass(new RenderPass(scene, camera))
    // UnrealBloomPass trabaja internamente en mips de media resolución y menos.
    const bloom = new UnrealBloomPass(new Vector2(256, 256), strength, 0.55, 0.88)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    const vignette = new ShaderPass(VignetteShader)
    vignette.uniforms.offset!.value = 1.05
    vignette.uniforms.darkness!.value = 1.15
    composer.addPass(vignette)
    return { composer, bloom }
    // strength se aplica en su propio efecto, sin recrear el composer.
  }, [gl, scene, camera, samples])
  useEffect(() => {
    composer.setPixelRatio(dpr)
    composer.setSize(size.width, size.height)
  }, [composer, size, dpr])
  useEffect(() => {
    bloom.strength = strength
  }, [bloom, strength])
  useEffect(() => () => composer.dispose(), [composer])

  useFrame((_, delta) => composer.render(delta), 1)
  return null
}
