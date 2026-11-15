import { fbm3, makeNoise3 } from '../engine/noise'

export interface SpriteSpec {
  readonly seed: number
  /** Colores claro y oscuro de la superficie (CSS hex). */
  readonly colors: readonly [string, string]
  readonly surface: 'bands' | 'rocky'
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const cache = new Map<string, string>()

/**
 * Dibuja en un canvas 2D una esfera iluminada con superficie procedural (bandas o moteado),
 * terminador suave y oscurecimiento del limbo, y la devuelve como data URL (en memoria: no hay red).
 * Se usa para los sectores de la selección, sin cargar three.
 */
export function sphereSprite(spec: SpriteSpec, size = 192): string {
  const key = `${spec.seed}|${spec.colors.join()}|${spec.surface}|${size}`
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(size, size)
  const noise = makeNoise3(spec.seed)
  const light = rgb(spec.colors[0])
  const dark = rgb(spec.colors[1])
  // Luz clave arriba a la izquierda, ligeramente de frente.
  const L = [-0.55, 0.5, 0.67]
  const r = size / 2 - 1
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - size / 2) / r
      const y = (size / 2 - py - 0.5) / r
      const d2 = x * x + y * y
      const i = (py * size + px) * 4
      if (d2 > 1) {
        img.data[i + 3] = 0
        continue
      }
      const z = Math.sqrt(1 - d2)
      let t: number
      if (spec.surface === 'bands') {
        const warp = fbm3(noise, x * 2.2, y * 2.2, z * 2.2, 3) - 0.5
        t = fbm3(noise, 0.3, (y + warp * 0.25) * 6, 0.7, 3) * 0.8 + fbm3(noise, x * 9, y * 14, z * 9, 2) * 0.2
      } else {
        t = fbm3(noise, x * 3 + 10, y * 3, z * 3, 5)
        t = t * t * 1.25
      }
      t = Math.min(1, Math.max(0, t))
      const diffuse = Math.max(0, x * L[0]! + y * L[1]! + z * L[2]!)
      const shade = 0.07 + 0.93 * Math.pow(diffuse, 0.85)
      const limb = 0.55 + 0.45 * Math.pow(z, 0.4)
      const k = shade * limb
      img.data[i] = (dark[0] + (light[0] - dark[0]) * t) * k
      img.data[i + 1] = (dark[1] + (light[1] - dark[1]) * t) * k
      img.data[i + 2] = (dark[2] + (light[2] - dark[2]) * t) * k
      // Borde antialiasado.
      img.data[i + 3] = Math.min(255, Math.max(0, (1 - Math.sqrt(d2)) * r * 255))
    }
  }
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}
