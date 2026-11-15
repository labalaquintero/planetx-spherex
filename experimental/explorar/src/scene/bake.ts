import {
  BackSide,
  CubeCamera,
  LinearFilter,
  Mesh,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  WebGLCubeRenderTarget,
  type IUniform,
  type WebGLRenderer,
} from 'three'
import { DIR_VERT } from './shaders/common'

/**
 * Horneado en cubemap de lo que solo depende de la dirección (nebulosa del cielo y capas de
 * nebulosa): se calcula una vez al entrar, no en cada píxel de cada cuadro. Es lo que más pesa en
 * GPUs integradas y pantallas con escalado (p. ej. Windows al 125–150 %). La codificación de 8
 * bits está en `shaders/common.ts` (BAKE_ENCODE / BAKE_DECODE).
 *
 * Renderiza un shader de dirección (`vDir`) en un cubemap de `size` px por cara.
 */
export function bakeCube(gl: WebGLRenderer, fragmentShader: string, uniforms: Record<string, IUniform>, size: number): WebGLCubeRenderTarget {
  const rt = new WebGLCubeRenderTarget(size, {
    type: UnsignedByteType,
    format: RGBAFormat,
    generateMipmaps: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  })
  const scene = new Scene()
  const geo = new SphereGeometry(10, 64, 32)
  const mat = new ShaderMaterial({ vertexShader: DIR_VERT, fragmentShader, uniforms, side: BackSide, depthWrite: false, depthTest: false })
  scene.add(new Mesh(geo, mat))
  const camera = new CubeCamera(0.1, 100, rt)
  camera.update(gl, scene)
  geo.dispose()
  mat.dispose()
  return rt
}

/**
 * Comprueba que las seis caras se hornearon (lee un píxel del centro de cada una). Para shaders cuyo
 * resultado nunca es negro puro, como el cielo: si alguna cara salió vacía (fallo del driver), hay
 * que usar el shader al vuelo para no dejar media pantalla negra.
 */
export function bakedAllFaces(gl: WebGLRenderer, rt: WebGLCubeRenderTarget): boolean {
  const px = new Uint8Array(4)
  const c = Math.floor(rt.width / 2)
  try {
    for (let face = 0; face < 6; face++) {
      gl.readRenderTargetPixels(rt, c, c, 1, 1, px, face)
      if (px[0]! + px[1]! + px[2]! === 0) return false
    }
  } catch {
    return false
  }
  return true
}
