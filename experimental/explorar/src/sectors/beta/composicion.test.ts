import { describe, expect, it } from 'vitest'
import { Euler, MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { NAVE_AJUSTE, OBJETOS_BOCETO, SELECCION_BOCETO } from '../../boceto'
import { cameraFit } from '../../engine/motion'
import { REFERENCE_ASPECT, screenToWorld, worldToScreen } from '../../engine/projection'
import { nearbyObject } from '../../engine/nearest'
import { SHIP, SHIP_KEY_POINTS } from '../../engine/shipSpec'
import { SECTORS } from '..'
import beta from '.'
import { ENTRY_CAMERA } from './objects'

/**
 * Fidelidad al boceto, sin render: se proyecta la escena con la cámara de three (implementación
 * independiente de engine/projection) desde el punto de entrada, en una pantalla 16:9, y se compara
 * con lo medido en docs/referencias/layout.json. Los títulos muestran el error medido.
 */
const TOL = 0.05 // tolerancia en unidades normalizadas de pantalla

const scene = beta.scene!
const entry = scene.waypoints.find((w) => w.id === scene.startId)!
const fit = cameraFit(REFERENCE_ASPECT)

function entryCamera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(fit.fovDeg, REFERENCE_ASPECT, 0.1, 4000)
  cam.position.set(...entry.position)
  cam.rotation.set(MathUtils.degToRad(entry.pitchDeg), MathUtils.degToRad(entry.yawDeg), 0, 'YXZ')
  cam.updateMatrixWorld()
  return cam
}

const cam = entryCamera()
const toScreen = (p: Vector3) => {
  const n = p.clone().project(cam)
  return { u: (n.x + 1) / 2, v: (1 - n.y) / 2 }
}
/** Diámetro en pantalla (en alto de pantalla) de una esfera de radio r en p: depende de la profundidad. */
const apparent = (p: Vector3, r: number) => {
  const d = -p.clone().applyMatrix4(cam.matrixWorldInverse).z
  return (2 * r) / (2 * d * Math.tan(MathUtils.degToRad(fit.fovDeg / 2)))
}

const medidos = OBJETOS_BOCETO.map((b) => {
  const o = scene.objects.find((x) => x.id === b.id)
  if (!o) throw new Error(`β no tiene el objeto ${b.id} del boceto`)
  const s = toScreen(new Vector3(...o.position))
  const err = Math.hypot(s.u - b.ancla.centro[0], s.v - b.ancla.centro[1])
  const r = o.kind === 'ringedPlanet' ? o.radius * (o.ring?.outer ?? 1) : o.radius
  return { b, o, s, err, size: apparent(new Vector3(...o.position), r) }
})

describe('composición de β desde la entrada (boceto 2)', () => {
  it('la cámara de prueba es la de la app en 16:9 (FOV 50°)', () => {
    expect(fit.fovDeg).toBe(50)
    expect(ENTRY_CAMERA.fovDeg).toBe(fit.fovDeg)
  })

  it('cada objeto del boceto existe en la escena con su mismo tipo', () => {
    for (const m of medidos) expect(m.o.kind).toBe(m.b.clase)
  })

  for (const m of medidos) {
    it(`${m.b.id} (${m.b.clase}) cae a ${m.err.toFixed(4)} de su posición en el boceto (tolerancia ${TOL})`, () => {
      expect(m.err).toBeLessThanOrEqual(TOL)
    })
  }

  it('los tamaños aparentes conservan el orden del boceto (empates < 5 %)', () => {
    for (const a of medidos) {
      for (const b of medidos) {
        const da = a.b.ancla.diametro_v
        const db = b.b.ancla.diametro_v
        if (da > db * 1.05) expect(a.size).toBeGreaterThan(b.size)
      }
    }
  })

  it('el tamaño aparente de cada objeto está a menos del 15 % del medido', () => {
    for (const m of medidos) expect(Math.abs(m.size / m.b.ancla.diametro_v - 1)).toBeLessThan(0.15)
  })

  it('projection.ts y three coinciden (ida y vuelta)', () => {
    for (const [u, v, d] of [
      [0.1, 0.1, 150],
      [0.8, 0.6, 80],
      [0.5, 0.5, 10],
    ] as const) {
      const p = screenToWorld(u, v, d, ENTRY_CAMERA)
      const s = toScreen(new Vector3(...p))
      expect(s.u).toBeCloseTo(u, 6)
      expect(s.v).toBeCloseTo(v, 6)
      const back = worldToScreen(p, ENTRY_CAMERA)
      expect(back.depth).toBeCloseTo(d, 6)
    }
  })
})

describe('silueta de la nave (boceto 2)', () => {
  // La nave cuelga de la cámara: se proyecta en el espacio de la cámara (sin el giro del punto).
  const shipCam = new PerspectiveCamera(fit.fovDeg, REFERENCE_ASPECT, 0.01, 100)
  shipCam.updateMatrixWorld()
  const objetivo = NAVE_AJUSTE.objetivo_16_9 as unknown as Record<string, [number, number]>
  for (const [name, local] of Object.entries(SHIP_KEY_POINTS)) {
    const p = new Vector3(...local)
      .applyEuler(new Euler(SHIP.pitch, 0, 0))
      .multiplyScalar(fit.shipScale)
      .add(new Vector3(0, fit.shipY, fit.shipZ))
      .project(shipCam)
    const u = (p.x + 1) / 2
    const v = (1 - p.y) / 2
    const t = objetivo[name]!
    const err = Math.hypot(u - t[0], v - t[1])
    it(`${name} a ${err.toFixed(4)} del boceto (tolerancia ${TOL})`, () => {
      expect(err).toBeLessThanOrEqual(TOL)
    })
  }

  it('las proporciones del boceto se conservan: envergadura mayor que el largo visible', () => {
    expect(SHIP.tipX * 2).toBeGreaterThan(SHIP.tailZ - SHIP.noseZ)
  })
})

describe('pantalla de selección (boceto 1)', () => {
  const ids = ['alpha', 'beta', 'epsilon'] as const
  for (const id of ids) {
    const s = SECTORS.find((x) => x.id === id)!
    const m = SELECCION_BOCETO.sectores[id]
    const err = Math.hypot(s.selector.x / 100 - m.centro[0]!, s.selector.y / 100 - m.centro[1]!)
    it(`${id} a ${err.toFixed(4)} de su posición en el boceto (tolerancia 0.01)`, () => {
      expect(err).toBeLessThanOrEqual(0.01)
    })
  }

  it('los tamaños de los sectores conservan el orden del boceto', () => {
    const byMeasured = [...ids].sort((a, b) => SELECCION_BOCETO.sectores[a].diametro_rel_marco - SELECCION_BOCETO.sectores[b].diametro_rel_marco)
    const bySize = [...ids].sort((a, b) => SECTORS.find((x) => x.id === a)!.selector.size - SECTORS.find((x) => x.id === b)!.selector.size)
    expect(bySize).toEqual(byMeasured)
  })

  it('la llamada va a la derecha del sector, como en el boceto', () => {
    expect(SELECCION_BOCETO.llamada?.lado).toBe('derecha')
  })
})

describe('miradores orientados a su objeto', () => {
  for (const id of ['izq', 'der', 'izq_f', 'der_f']) {
    const w = scene.waypoints.find((x) => x.id === id)!
    const focus = nearbyObject(w, scene.objects)!
    it(`${id} encuadra ${focus.id} arriba en pantalla, fuera de la nave`, () => {
      const c = new PerspectiveCamera(fit.fovDeg, REFERENCE_ASPECT, 0.1, 4000)
      c.position.set(...w.position)
      c.rotation.set(MathUtils.degToRad(w.pitchDeg), MathUtils.degToRad(w.yawDeg), 0, 'YXZ')
      c.updateMatrixWorld()
      const n = new Vector3(...focus.position).project(c)
      const u = (n.x + 1) / 2
      const v = (1 - n.y) / 2
      expect(v).toBeGreaterThan(0.15)
      expect(v).toBeLessThan(0.4)
      expect(u).toBeGreaterThan(0.3)
      expect(u).toBeLessThan(0.7)
    })
  }
})
