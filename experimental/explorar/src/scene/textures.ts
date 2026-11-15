import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { mulberry32 } from '../engine/random'
import type { SceneObject } from '../engine/types'

/** Ruido de valor periódico en X (la textura de una esfera debe cerrar sin costura). */
function makeNoise(seed: number) {
  const rnd = mulberry32(seed)
  const lattice = new Float32Array(256 * 256)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rnd()
  const at = (x: number, y: number, period: number) =>
    lattice[(y & 255) * 256 + ((((x % period) + period) % period) & 255)] as number
  const smooth = (t: number) => t * t * (3 - 2 * t)

  const value = (x: number, y: number, period: number): number => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = smooth(x - xi)
    const fy = smooth(y - yi)
    const a = at(xi, yi, period)
    const b = at(xi + 1, yi, period)
    const c = at(xi, yi + 1, period)
    const d = at(xi + 1, yi + 1, period)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }

  /** Suma de octavas. `basePeriod` es el nº de celdas en X de la primera octava. */
  return (x: number, y: number, basePeriod: number, octaves: number): number => {
    let sum = 0
    let amp = 0.5
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      const f = 2 ** o
      sum += amp * value(x * f, y * f, basePeriod * f)
      norm += amp
      amp *= 0.5
    }
    return sum / norm
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Rampa de tres colores: 0 → c0, 0.5 → c1, 1 → c2. */
function ramp(colors: readonly [number, number, number][], t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * 2
  const i = Math.min(1, Math.floor(x))
  const f = x - i
  const a = colors[i] as [number, number, number]
  const b = colors[i + 1] as [number, number, number]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

function finish(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.anisotropy = 4
  return tex
}

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2D no disponible')
  return [canvas, ctx]
}

/** Textura procedural de un planeta (o esfera): bandas de gigante gaseoso o superficie moteada con cráteres. */
export function makeSurfaceTexture(o: Pick<SceneObject, 'seed' | 'palette' | 'surface'>): CanvasTexture {
  const W = 512
  const H = 256
  const [canvas, ctx] = canvas2d(W, H)
  const img = ctx.createImageData(W, H)
  const noise = makeNoise(o.seed)
  const colors = o.palette.map(hexToRgb)
  const bands = o.surface === 'bands'

  for (let py = 0; py < H; py++) {
    const v = py / H
    for (let px = 0; px < W; px++) {
      const u = px / W
      let t: number
      if (bands) {
        // Franjas horizontales (ruido casi solo en Y), torcidas por turbulencia.
        const warp = (noise(u * 4, v * 6, 4, 3) - 0.5) * 0.12
        const band = noise(0, (v + warp) * 14, 1, 3)
        const fine = noise(u * 24, v * 40, 24, 2)
        t = band * 0.85 + fine * 0.15
      } else {
        t = noise(u * 6, v * 3, 6, 5)
      }
      const [r, g, b] = ramp(colors as [number, number, number][], t)
      const i = (py * W + px) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  if (!bands) {
    // Cráteres: anillos oscuros con borde claro (se repiten a ambos lados para cerrar la costura).
    const rnd = mulberry32(o.seed + 1)
    for (let n = 0; n < 46; n++) {
      const cx = rnd() * W
      const cy = H * 0.12 + rnd() * H * 0.76
      const r = 2 + rnd() * rnd() * 16
      for (const dx of [-W, 0, W]) {
        ctx.beginPath()
        ctx.arc(cx + dx, cy, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.20)'
        ctx.fill()
        ctx.lineWidth = Math.max(1, r * 0.14)
        ctx.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx.stroke()
      }
    }
  }
  return finish(canvas)
}

/** Textura radial del anillo (u = 0 borde interno, u = 1 borde externo), con huecos y opacidad variable. */
export function makeRingTexture(seed: number, palette: SceneObject['palette']): CanvasTexture {
  const W = 512
  const [canvas, ctx] = canvas2d(W, 4)
  const noise = makeNoise(seed)
  const colors = palette.map(hexToRgb) as [number, number, number][]
  const img = ctx.createImageData(W, 4)
  for (let px = 0; px < W; px++) {
    const u = px / W
    const n = noise(0, u * 30, 1, 3)
    const gap = u > 0.58 && u < 0.64 ? 0.08 : 1 // una división marcada
    const edge = Math.min(1, u * 14, (1 - u) * 14) // se desvanece en los bordes
    const alpha = Math.min(1, Math.max(0, (n * 1.3 - 0.1) * gap * edge))
    const [r, g, b] = ramp(colors, 0.25 + n * 0.6)
    for (let py = 0; py < 4; py++) {
      const i = (py * W + px) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = alpha * 235
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** Paneles y ventanas del cuerpo cilíndrico de la estación (se repite a lo largo). */
export function makeHullTexture(seed: number, palette: SceneObject['palette']): CanvasTexture {
  const W = 256
  const H = 128
  const [canvas, ctx] = canvas2d(W, H)
  const rnd = mulberry32(seed)
  ctx.fillStyle = palette[0]
  ctx.fillRect(0, 0, W, H)
  // Paneles
  for (let x = 0; x < W; x += 32) {
    ctx.fillStyle = rnd() > 0.5 ? palette[1] : palette[0]
    ctx.fillRect(x + 1, 0, 30, H)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(x, 0, 1, H)
  }
  // Ventanas encendidas
  for (let row = 0; row < 3; row++) {
    const y = 26 + row * 36
    for (let x = 4; x < W; x += 8) {
      if (rnd() < 0.7) {
        ctx.fillStyle = rnd() < 0.85 ? '#ffe9a8' : '#9fd0ff'
        ctx.fillRect(x, y, 4, 3)
      }
    }
  }
  const tex = finish(canvas)
  tex.wrapT = RepeatWrapping
  return tex
}
