import { describe, expect, it } from 'vitest'
import { approach, arrivalOffset, ARRIVAL_MS, BASE_FOV_DEG, cameraFit, fovKick, jumpFrame, JUMP_MS } from './motion'
import { fbm3, makeNoise3 } from './noise'

describe('approach', () => {
  it('recorre la mitad de la distancia en una vida media', () => {
    expect(approach(0, 10, 100, 100)).toBeCloseTo(5)
  })
  it('es independiente de los FPS (dos pasos de 50 ms = uno de 100 ms)', () => {
    expect(approach(approach(0, 10, 50, 100), 10, 50, 100)).toBeCloseTo(approach(0, 10, 100, 100))
  })
  it('sin vida media salta al objetivo; dt negativo no retrocede', () => {
    expect(approach(3, 7, 16, 0)).toBe(7)
    expect(approach(3, 7, -50, 100)).toBe(3)
  })
})

describe('jumpFrame', () => {
  it('empieza en reposo y termina con destello completo', () => {
    expect(jumpFrame(0)).toEqual({ streak: 0, zoom: 1, flash: 0 })
    const end = jumpFrame(JUMP_MS)
    expect(end.flash).toBe(1)
    expect(end.streak).toBe(1)
    expect(end.zoom).toBeCloseTo(3.2)
  })
  it('las rayas y el zoom crecen de forma monótona', () => {
    let prev = jumpFrame(0)
    for (let ms = 50; ms <= JUMP_MS; ms += 50) {
      const f = jumpFrame(ms)
      expect(f.streak).toBeGreaterThanOrEqual(prev.streak)
      expect(f.zoom).toBeGreaterThanOrEqual(prev.zoom)
      prev = f
    }
  })
  it('se acota fuera de rango', () => {
    expect(jumpFrame(-100)).toEqual(jumpFrame(0))
    expect(jumpFrame(JUMP_MS * 3)).toEqual(jumpFrame(JUMP_MS))
  })
})

describe('arrivalOffset', () => {
  it('parte desde atrás con FOV amplio y termina en el punto exacto', () => {
    const a = arrivalOffset(0)
    expect(a.back).toBeGreaterThan(30)
    expect(a.fov).toBeGreaterThan(20)
    expect(arrivalOffset(ARRIVAL_MS)).toEqual({ back: 0, fov: 0 })
  })
  it('se acerca de forma monótona', () => {
    let prev = arrivalOffset(0).back
    for (let ms = 100; ms <= ARRIVAL_MS; ms += 100) {
      const b = arrivalOffset(ms).back
      expect(b).toBeLessThanOrEqual(prev)
      prev = b
    }
  })
})

describe('fovKick', () => {
  it('0 en reposo y al llegar; máximo a mitad de trayecto', () => {
    expect(fovKick(0)).toBe(0)
    expect(fovKick(1)).toBeCloseTo(0)
    expect(fovKick(0.5)).toBeCloseTo(7)
    expect(fovKick(0.5, 4)).toBeCloseTo(4)
  })
})

describe('cameraFit', () => {
  it('en horizontal conserva el encuadre del boceto', () => {
    expect(cameraFit(16 / 9).fovDeg).toBe(BASE_FOV_DEG)
    expect(cameraFit(1.3)).toEqual(cameraFit(2.4))
  })
  it('en vertical abre el FOV y reduce y baja la nave', () => {
    const land = cameraFit(16 / 9)
    const port = cameraFit(9 / 19.5)
    expect(port.fovDeg).toBeGreaterThan(land.fovDeg)
    expect(port.fovDeg).toBeLessThanOrEqual(92)
    expect(port.shipScale).toBeLessThan(land.shipScale)
    expect(port.shipY).toBeLessThan(land.shipY)
  })
  it('el FOV no disminuye al estrecharse la pantalla', () => {
    let prev = cameraFit(1.2).fovDeg
    for (let a = 1.15; a >= 0.4; a -= 0.05) {
      const f = cameraFit(a).fovDeg
      expect(f).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = f
    }
  })
  it('aspectos inválidos usan el de referencia', () => {
    expect(cameraFit(Number.NaN)).toEqual(cameraFit(16 / 9))
    expect(cameraFit(0)).toEqual(cameraFit(16 / 9))
  })
})

describe('ruido 3D', () => {
  it('es determinista por semilla y está en [0, 1]', () => {
    const a = makeNoise3(7)
    const b = makeNoise3(7)
    const c = makeNoise3(8)
    let differs = false
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37
      const y = i * 0.11
      const z = i * 0.53
      const v = fbm3(a, x, y, z, 4)
      expect(v).toBe(fbm3(b, x, y, z, 4))
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      if (Math.abs(v - fbm3(c, x, y, z, 4)) > 1e-6) differs = true
    }
    expect(differs).toBe(true)
  })
  it('es continuo (valores cercanos para puntos cercanos)', () => {
    const n = makeNoise3(3)
    expect(Math.abs(n(1.5, 2.25, 3.75) - n(1.5001, 2.25, 3.75))).toBeLessThan(0.01)
  })
})
