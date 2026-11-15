import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { BackSide, Mesh, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry } from 'three'
import { LIGHT_DIR } from './light'
import { SKY_FRAG, SKY_VERT } from './shaders/sky'

/**
 * Mapa de entorno para los reflejos de los metales (nave, estación): se genera una vez, en el
 * navegador, a partir del propio cielo (nebulosa y estrella clave). Así los reflejos coinciden con
 * lo que se ve, sin archivos HDR ni red.
 */
export function SkyEnvironment({ intensity = 1 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const envScene = new Scene()
    const geo = new SphereGeometry(100, 48, 24)
    const mat = new ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uLight: { value: LIGHT_DIR }, uOct: { value: 4 }, uStarGain: { value: 0.12 } },
      side: BackSide,
      depthWrite: false,
    })
    envScene.add(new Mesh(geo, mat))
    const pmrem = new PMREMGenerator(gl)
    const rt = pmrem.fromScene(envScene, 0.02)
    scene.environment = rt.texture
    scene.environmentIntensity = intensity
    invalidate()
    return () => {
      scene.environment = null
      rt.dispose()
      pmrem.dispose()
      geo.dispose()
      mat.dispose()
    }
  }, [gl, scene, intensity, invalidate])
  return null
}
