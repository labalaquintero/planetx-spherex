import { describe, expect, it } from 'vitest'
import { obstaclesOf } from '../../engine/flight'
import { validateGraph } from '../../engine/graph'
import { validateFocus } from '../../engine/nearest'
import { worldToScreen } from '../../engine/projection'
import { scatterBodies } from '../../engine/scatter'
import { smallBodiesOf } from '../../scene/bodies'
import alpha, { FIELD, FRACCION_RECORTE } from '.'
import { aPantalla, CAMPO, FUENTES, LADO_PX, RECORTE } from './campo'
import { ENTRY_CAMERA, EXTRAS, OBJECTS } from './objects'
import { TEXTURES } from '../../scene/assets'

const scene = alpha.scene!

/** Tolerancia explícita: medio píxel del recorte de 64 px, llevado a la pantalla de entrada. */
const TOL_V = (0.5 / LADO_PX) * RECORTE.alto
const TOL_U = TOL_V / ENTRY_CAMERA.aspect

describe('sector α: datos de partida', () => {
  it('el campo medido viene de los dos recortes reales y está ordenado por brillo', () => {
    expect(CAMPO.fuente.epocas).toHaveLength(2)
    expect(CAMPO.fuente.epocas.map((e) => e.observation_id)).toEqual(['2025W19_1B_0241_1', '2025W44_2B_0322_1'])
    expect(FUENTES.length).toBe(CAMPO.deteccion.fuentes_conservadas)
    const brillos = FUENTES.map((f) => f.brillo_relativo)
    expect(brillos[0]).toBe(1)
    expect(brillos).toEqual([...brillos].sort((a, b) => b - a))
    for (const f of FUENTES) {
      expect(f.u).toBeGreaterThan(0)
      expect(f.u).toBeLessThan(1)
      expect(f.v).toBeGreaterThan(0)
      expect(f.v).toBeLessThan(1)
    }
  })
})

describe('sector α: escena', () => {
  it('tiene escena, así que sale como disponible y su grafo y focos son válidos', () => {
    expect(validateGraph(scene.waypoints, scene.startId)).toEqual([])
    expect(validateFocus(scene.waypoints, scene.objects)).toEqual([])
  })

  it('cada objeto está sobre una fuente real: su centro, visto desde la entrada, cae en el centroide medido (±0,5 px)', () => {
    expect(OBJECTS.map((o) => o.id)).toEqual(FUENTES.map((f) => f.id))
    for (const f of FUENTES) {
      const o = OBJECTS.find((x) => x.id === f.id)!
      const s = worldToScreen(o.position, ENTRY_CAMERA)
      const want = aPantalla(f.u, f.v)
      expect(Math.abs(s.u - want.u), `${f.id} u`).toBeLessThanOrEqual(TOL_U)
      expect(Math.abs(s.v - want.v), `${f.id} v`).toBeLessThanOrEqual(TOL_V)
      expect(s.depth).toBeGreaterThan(0)
    }
  })

  it('el objeto focal es la fuente más brillante y la entrada la nombra', () => {
    const entry = scene.waypoints.find((w) => w.id === scene.startId)!
    expect(entry.focusId).toBe(FUENTES[0]!.id)
    expect(OBJECTS.find((o) => o.id === entry.focusId)!.kind).toBe('planet')
  })

  it('pocos cuerpos grandes y solo los tipos permitidos', () => {
    const allowed = new Set(['planet', 'ringedPlanet', 'station', 'sphere', 'smallBody'])
    for (const o of OBJECTS) expect(allowed.has(o.kind)).toBe(true)
    expect(OBJECTS.filter((o) => o.kind !== 'smallBody').length).toBeLessThanOrEqual(4)
  })

  it('los objetos no se solapan entre sí ni tapan un punto de ruta', () => {
    const reach = (o: (typeof OBJECTS)[number]) => o.radius * (o.ring?.outer ?? 1)
    for (const a of OBJECTS) {
      for (const b of OBJECTS) {
        if (a.id >= b.id) continue
        const d = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2])
        expect(d, `${a.id}–${b.id}`).toBeGreaterThan(reach(a) + reach(b))
      }
    }
    for (const ob of obstaclesOf(OBJECTS)) {
      for (const w of scene.waypoints) {
        const d = Math.hypot(w.position[0] - ob.center[0], w.position[1] - ob.center[1], w.position[2] - ob.center[2])
        expect(d, `${w.id} dentro de ${ob.id}`).toBeGreaterThan(ob.radius)
      }
    }
  })
})

describe('sector α: relleno', () => {
  it('la cantidad sale de la densidad de fuentes medida en el recorte', () => {
    expect(FIELD.count).toBe(Math.round((FUENTES.length * (1 - FRACCION_RECORTE)) / FRACCION_RECORTE))
    expect(FIELD.minRadius).toBeLessThan(FIELD.maxRadius)
  })

  it('es determinista: misma semilla, mismos cuerpos', () => {
    const a = scatterBodies(FIELD, scene.waypoints, scene.objects, FIELD.count)
    const b = scatterBodies(FIELD, scene.waypoints, scene.objects, FIELD.count)
    expect(a.length).toBeGreaterThan(0)
    expect(b).toEqual(a)
    expect(smallBodiesOf(scene, 200)).toEqual(smallBodiesOf(scene, 200))
  })

  it('el relleno no invade la vista del recorte real', () => {
    const listed = OBJECTS.filter((o) => o.kind === 'smallBody').length
    for (const b of smallBodiesOf(scene, 200).slice(listed)) {
      const s = worldToScreen(b.position, ENTRY_CAMERA)
      const insideRecorte = s.depth > 0 && s.depth < 320 && s.u > 0 && s.u < 1 && s.v > 0 && s.v < 1
      expect(insideRecorte).toBe(false)
    }
  })
})

describe('sector α: planetas con mapas de la NASA', () => {
  it('los cuerpos con nombre usan texturas empaquetadas y tienen ficha con imagen y crédito', () => {
    const named = scene.objects.filter((o) => o.label)
    expect(named.length).toBe(6)
    for (const o of named) {
      expect(o.texture, o.id).toBeDefined()
      expect(Object.keys(TEXTURES)).toContain(o.texture!.map)
      expect(o.info, o.id).toBeDefined()
      expect(o.info!.images.length).toBeGreaterThan(0)
      expect(o.info!.credit).toMatch(/NASA\/JPL/)
      expect(`${o.info!.summary} ${o.info!.facts.join(' ')}`).toMatch(/ilustrativ/i)
    }
  })

  it('no repiten las texturas de β: son planetas distintos', () => {
    const betaMaps = ['luna-color', 'bandas-saturno', 'cielo-spherex', 'vela-spherex', 'plano-galactico', 'burbuja-spherex', 'lazos-spherex', 'filamentos-spherex', 'nebulosa-vela']
    for (const o of scene.objects) if (o.texture) expect(betaMaps, o.id).not.toContain(o.texture.map)
  })

  it('los de fuera del recorte no asoman en la vista de entrada ni se solapan con nada', () => {
    for (const o of EXTRAS) {
      const s = worldToScreen(o.position, ENTRY_CAMERA)
      const r = s.depth > 0 ? o.radius / (s.depth * Math.tan((ENTRY_CAMERA.fovDeg * Math.PI) / 360)) / 2 : 0
      const visible = s.depth > 0 && s.u + r > 0 && s.u - r < 1 && s.v + r > 0 && s.v - r < 1
      expect(visible, o.id).toBe(false)
      for (const b of scene.objects) {
        if (b.id === o.id) continue
        const d = Math.hypot(o.position[0] - b.position[0], o.position[1] - b.position[1], o.position[2] - b.position[2])
        expect(d, `${o.id}–${b.id}`).toBeGreaterThan(o.radius + b.radius * (b.ring?.outer ?? 1) + 10)
      }
      for (const w of scene.waypoints) {
        const d = Math.hypot(o.position[0] - w.position[0], o.position[1] - w.position[1], o.position[2] - w.position[2])
        expect(d, `${o.id} y ${w.id}`).toBeGreaterThan(o.radius + 20)
      }
    }
  })
})
