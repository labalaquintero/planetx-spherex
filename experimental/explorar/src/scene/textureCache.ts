import { LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { TEXTURES, type TextureId } from './assets'

const cache = new Map<string, Promise<Texture>>()
const loader = new TextureLoader()

/**
 * Carga (una vez) una textura empaquetada. Las de color van en sRGB; las de datos (relieve,
 * transparencia del anillo) en lineal. Si falla, la escena sigue con la superficie procedural.
 */
export function loadTexture(id: string, kind: 'color' | 'data' = 'color'): Promise<Texture> {
  const key = `${id}|${kind}`
  let p = cache.get(key)
  if (!p) {
    const url = TEXTURES[id as TextureId]
    if (!url) return Promise.reject(new Error(`textura desconocida: ${id}`))
    p = loader.loadAsync(url).then((t) => {
      t.colorSpace = kind === 'color' ? SRGBColorSpace : LinearSRGBColorSpace
      t.wrapS = RepeatWrapping
      t.anisotropy = 4
      return t
    })
    cache.set(key, p)
  }
  return p
}
