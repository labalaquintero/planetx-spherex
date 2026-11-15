import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { mulberry32 } from '../engine/random'
import type { SceneObject } from '../engine/types'

/** Paneles y ventanas del cuerpo cilíndrico de la estación (canvas en memoria; sin archivos). */
export function makeHullTexture(seed: number, palette: SceneObject['palette']): { map: CanvasTexture; emissive: CanvasTexture } {
  const W = 256
  const H = 128
  const make = () => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('canvas 2D no disponible')
    return [c, ctx] as const
  }
  const [mapCanvas, ctx] = make()
  const [emiCanvas, ectx] = make()
  const rnd = mulberry32(seed)
  ctx.fillStyle = palette[0]
  ctx.fillRect(0, 0, W, H)
  ectx.fillStyle = '#000'
  ectx.fillRect(0, 0, W, H)
  for (let x = 0; x < W; x += 32) {
    ctx.fillStyle = rnd() > 0.5 ? palette[1] : palette[0]
    ctx.fillRect(x + 1, 0, 30, H)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(x, 0, 1, H)
  }
  for (let row = 0; row < 3; row++) {
    const y = 26 + row * 36
    for (let x = 4; x < W; x += 8) {
      if (rnd() < 0.7) {
        const color = rnd() < 0.85 ? '#ffe9a8' : '#bae6fd'
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(x, y, 4, 3)
        ectx.fillStyle = color
        ectx.fillRect(x, y, 4, 3)
      }
    }
  }
  const finish = (canvas: HTMLCanvasElement) => {
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(4, 1)
    t.anisotropy = 4
    return t
  }
  return { map: finish(mapCanvas), emissive: finish(emiCanvas) }
}
