import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector2 } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

/**
 * Brillo (bloom) sutil con los pases que trae three (sin dependencias nuevas). Solo lo recogen
 * las zonas muy brillantes: la estrella clave, la tobera, los acentos y las luces de la estación.
 * Al desmontarse, react-three-fiber vuelve a pintar la escena sin composer.
 */
export function Bloom({ strength }: { strength: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const { composer, bloom } = useMemo(() => {
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))
    // UnrealBloomPass trabaja internamente en mips de media resolución y menos.
    const bloom = new UnrealBloomPass(new Vector2(256, 256), strength, 0.5, 0.9)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    return { composer, bloom }
    // strength se aplica en su propio efecto, sin recrear el composer.
  }, [gl, scene, camera])
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
