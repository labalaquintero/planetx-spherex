import { CanvasTexture, LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace } from 'three'
import { mulberry32 } from '../engine/random'

/**
 * Mapas procedurales del casco de la nave (canvas en memoria, sin archivos): paneles con juntas,
 * escotillas y remaches. Devuelve albedo (sRGB), rugosidad y normal (lineales), con la misma
 * distribución de paneles para que encajen entre sí.
 */
export function makeHullMaps(seed = 7, size = 512): { map: CanvasTexture; roughness: CanvasTexture; normal: CanvasTexture } {
  const rnd = mulberry32(seed)
  const canvas = () => {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('canvas 2D no disponible')
    return [c, ctx] as const
  }
  const [albC, alb] = canvas()
  const [rouC, rou] = canvas()
  const [, h] = canvas() // altura: base para el normal map

  alb.fillStyle = '#c9d2de'
  alb.fillRect(0, 0, size, size)
  rou.fillStyle = 'rgb(92,92,92)'
  rou.fillRect(0, 0, size, size)
  h.fillStyle = 'rgb(128,128,128)'
  h.fillRect(0, 0, size, size)

  // Paneles: filas de alto variable, juntas verticales desplazadas (como chapas).
  let y = 0
  while (y < size) {
    const rowH = 28 + Math.floor(rnd() * 46)
    let x = -Math.floor(rnd() * 40)
    while (x < size) {
      const w = 40 + Math.floor(rnd() * 90)
      const tone = 196 + Math.floor((rnd() - 0.5) * 22)
      alb.fillStyle = `rgb(${tone - 6},${tone},${tone + 10})`
      alb.fillRect(x + 1, y + 1, w - 2, rowH - 2)
      const r = 70 + Math.floor(rnd() * 50)
      rou.fillStyle = `rgb(${r},${r},${r})`
      rou.fillRect(x + 1, y + 1, w - 2, rowH - 2)
      // Junta: surco en la altura y línea oscura en el albedo.
      h.fillStyle = 'rgb(60,60,60)'
      h.fillRect(x, y, w, 1)
      h.fillRect(x, y, 1, rowH)
      alb.fillStyle = 'rgba(40,48,60,0.55)'
      alb.fillRect(x, y, w, 1)
      alb.fillRect(x, y, 1, rowH)
      // Algunas escotillas y remaches.
      if (rnd() < 0.18) {
        const hw = 10 + rnd() * 16
        const hx = x + 6 + rnd() * Math.max(1, w - hw - 12)
        const hy = y + 6 + rnd() * Math.max(1, rowH - hw - 12)
        h.fillStyle = 'rgb(150,150,150)'
        h.fillRect(hx, hy, hw, hw * 0.6)
        alb.fillStyle = 'rgba(70,80,95,0.35)'
        alb.fillRect(hx, hy, hw, hw * 0.6)
      }
      if (rnd() < 0.5) {
        h.fillStyle = 'rgb(175,175,175)'
        for (let k = 4; k < w - 4; k += 9) h.fillRect(x + k, y + 3, 2, 2)
      }
      x += w
    }
    y += rowH
  }

  // Normal map a partir de la altura (Sobel).
  const hd = h.getImageData(0, 0, size, size).data
  const [nC, n] = canvas()
  const out = n.createImageData(size, size)
  const H = (px: number, py: number) => hd[(((py + size) % size) * size + ((px + size) % size)) * 4]! / 255
  const strength = 2.2
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = (H(px + 1, py) - H(px - 1, py)) * strength
      const dy = (H(px, py + 1) - H(px, py - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (py * size + px) * 4
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      out.data[i + 3] = 255
    }
  }
  n.putImageData(out, 0, 0)

  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new CanvasTexture(c)
    t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace
    t.wrapS = t.wrapT = RepeatWrapping
    t.anisotropy = 8
    return t
  }
  return { map: tex(albC, true), roughness: tex(rouC, false), normal: tex(nC, false) }
}
