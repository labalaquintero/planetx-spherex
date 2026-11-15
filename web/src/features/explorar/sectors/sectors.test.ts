import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { validateGraph } from '../engine/graph'
import { nearbyObject, nearestLabelled, validateFocus } from '../engine/nearest'
import { InfoCard } from '../screens/InfoCard'
import { SectorSelect } from '../screens/SectorSelect'
import { SECTORS, getSector } from './index'
import beta from './beta'
import { ENTRY_CAMERA, EXTRA_IDS, SKETCH_IDS, SKETCH_REPLACEMENTS } from './beta/objects'
import { objetoBoceto } from './beta/boceto'
import { worldToScreen } from '../engine/projection'
import { fromView } from './view'

describe('registro de sectores', () => {
  it('descubre los sectores en orden, con ids, símbolos y órdenes únicos', () => {
    expect(SECTORS.length).toBeGreaterThan(0)
    expect(new Set(SECTORS.map((s) => s.id)).size).toBe(SECTORS.length)
    expect(new Set(SECTORS.map((s) => s.symbol)).size).toBe(SECTORS.length)
    expect(new Set(SECTORS.map((s) => s.order)).size).toBe(SECTORS.length)
    const orders = SECTORS.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    for (const s of SECTORS) expect(getSector(s.id)).toBe(s)
    expect(getSector('sector-que-no-existe')).toBeUndefined()
  })

  // Sin listas fijas: vale para cualquier sector que se añada o se active.
  describe.each(SECTORS.filter((s) => s.scene).map((s) => [s.id, s] as const))('sector con escena: %s', (_id, sector) => {
    const scene = sector.scene!
    it('su grafo de puntos de ruta es válido (inicio existente, vínculos de ida y vuelta, todo alcanzable)', () => {
      expect(validateGraph(scene.waypoints, scene.startId)).toEqual([])
    })
    it('sus focusId apuntan a objetos con nombre y no hay objetos duplicados', () => {
      expect(validateFocus(scene.waypoints, scene.objects)).toEqual([])
    })
  })

  it('los sectores sin escena aparecen como «Próximamente» en la selección, y los demás como disponibles', () => {
    const html = renderToStaticMarkup(
      createElement(SectorSelect, {
        sectors: SECTORS,
        onEnter: () => {},
        jump: null,
        reduced: true,
        quality: 'low',
        forced: true,
        focusId: null,
      }),
    )
    for (const s of SECTORS) {
      const card = html.slice(html.indexOf(`id="ex-card-${s.id}"`))
      const end = card.indexOf('</div></li>')
      const cardHtml = end > 0 ? card.slice(0, end) : card
      if (s.scene) {
        expect(html).toContain(`aria-label="${s.name}, entrar"`)
        expect(cardHtml).toContain('Disponible')
        expect(cardHtml).not.toContain('Próximamente')
      } else {
        expect(html).toContain(`aria-label="${s.name}, próximamente"`)
        expect(cardHtml).toContain('Próximamente')
      }
    }
  })

  it('las esferas de la selección caben en el campo y no se solapan', () => {
    for (const s of SECTORS) {
      expect(s.selector.x).toBeGreaterThan(5)
      expect(s.selector.x).toBeLessThan(95)
      expect(s.selector.y).toBeGreaterThan(5)
      expect(s.selector.y).toBeLessThan(90)
    }
    for (const a of SECTORS) {
      for (const b of SECTORS) {
        if (a.id >= b.id) continue
        expect(Math.hypot(a.selector.x - b.selector.x, a.selector.y - b.selector.y)).toBeGreaterThan(15)
      }
    }
  })
})

/** Tono (0–360°), saturación y luminosidad HSL de un color #rrggbb. */
function hsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

describe('Ilmara: mundo frío inspirado en WISE 0855 (no un gigante tipo Júpiter)', () => {
  const ilmara = beta.scene!.objects.find((o) => o.id === 'ilmara')!

  it('superficie procedural de tormentas, sin textura de bandas', () => {
    expect(ilmara.surface).toBe('storms')
    expect(ilmara.texture).toBeUndefined()
  })

  it('paleta oscura y fría: ningún color naranja o crema claro (tono 15–65° con saturación y luz altas)', () => {
    for (const c of ilmara.palette) {
      const { h, s, l } = hsl(c)
      expect(h >= 15 && h <= 65 && s > 0.3 && l > 0.4).toBe(false)
    }
    // El tono más claro es violáceo o magenta (frío), no cálido.
    const light = hsl(ilmara.palette[0])
    expect(light.h > 250 || light.h < 10).toBe(true)
    // El más oscuro es casi negro.
    expect(hsl(ilmara.palette[2]).l).toBeLessThan(0.12)
  })

  it('tiene brillo propio tenue y atmósfera (borde Fresnel)', () => {
    expect(ilmara.glow).toBeTruthy()
    expect(ilmara.atmosphere).toBeTruthy()
  })

  it('ningún objeto de β usa una textura de bandas tipo Júpiter', () => {
    for (const o of beta.scene!.objects) expect(o.texture?.map ?? '').not.toMatch(/jupiter/i)
  })
})

describe('planetas añadidos fuera del boceto', () => {
  const extras = beta.scene!.objects.filter((o) => EXTRA_IDS.includes(o.id))

  it('hay al menos tres, con nombre, y solo de los tipos del boceto', () => {
    expect(extras.length).toBeGreaterThanOrEqual(3)
    for (const o of extras) {
      expect(o.label).toBeTruthy()
      expect(['planet', 'ringedPlanet', 'sphere']).toContain(o.kind)
    }
  })

  it('no aparecen en la vista inicial, que sigue siendo la del boceto (salvo el que ocupa el lugar de la estación)', () => {
    const replacements = Object.values(SKETCH_REPLACEMENTS)
    for (const o of extras.filter((x) => !replacements.includes(x.id))) {
      const s = worldToScreen(o.position, ENTRY_CAMERA)
      // Margen: su radio aparente no debe asomar al encuadre.
      const r = s.depth > 0 ? o.radius / (s.depth * Math.tan((ENTRY_CAMERA.fovDeg * Math.PI) / 360)) / 2 : 0
      const visible = s.depth > 0 && s.u + r * 0.6 > 0 && s.u - r * 0.6 < 1 && s.v + r > 0 && s.v - r < 1
      expect(visible, o.id).toBe(false)
    }
  })

  it('el planeta que sustituye a la estación queda en su sitio del boceto', () => {
    for (const [retired, id] of Object.entries(SKETCH_REPLACEMENTS)) {
      const o = beta.scene!.objects.find((x) => x.id === id)!
      const s = worldToScreen(o.position, ENTRY_CAMERA)
      const [u, v] = objetoBoceto(retired).ancla.centro
      expect(Math.hypot(s.u - u, s.v - v), id).toBeLessThan(0.01)
      expect(o.kind).toBe('planet')
    }
  })

  it('no se parecen a Júpiter: ninguna paleta naranja o crema clara', () => {
    for (const o of extras) {
      for (const c of o.palette) {
        const { h, s, l } = hsl(c)
        expect(h >= 15 && h <= 65 && s > 0.3 && l > 0.6, `${o.id} ${c}`).toBe(false)
      }
    }
  })
})

describe('fichas de contexto de β (panel izquierdo al acercarse)', () => {
  const named = beta.scene!.objects.filter((o) => o.label)

  it('cada objeto con nombre tiene ficha con título, resumen y datos', () => {
    for (const o of named) {
      expect(o.info, o.id).toBeDefined()
      expect(o.info!.title.length).toBeGreaterThan(3)
      expect(o.info!.summary.length).toBeGreaterThan(40)
      expect(o.info!.facts.length).toBeGreaterThan(0)
    }
  })

  it('Ilmara muestra los dos recortes reales de WISE 0855, con crédito', () => {
    const info = named.find((o) => o.id === 'ilmara')!.info!
    expect(info.summary).toMatch(/WISE 0855/)
    expect(info.images).toHaveLength(2)
    for (const img of info.images) expect(img.src).toMatch(/wise0855-2025-(05-06|10-31)/)
    expect(info.credit).toMatch(/NASA\/JPL-Caltech/)
  })

  it('la ficha de Ilmara se dibuja con sus dos imágenes pixeladas, pies de foto y crédito', () => {
    const info = named.find((o) => o.id === 'ilmara')!.info!
    const html = renderToStaticMarkup(createElement(InfoCard, { info }))
    expect(html.match(/<img /g)).toHaveLength(2)
    expect(html.match(/data-pixelated="true"/g)).toHaveLength(2)
    expect(html).toContain('SPHEREx · 6 may 2025')
    expect(html).toContain('SPHEREx · 31 oct 2025')
    expect(html).toContain('NASA/JPL-Caltech')
  })

  it('toda ficha con imagen indica su crédito y deja claro que el objeto es inventado o ilustrativo', () => {
    for (const o of named) {
      const info = o.info!
      if (info.images.length > 0) expect(info.credit, o.id).toBeTruthy()
      expect(`${info.summary} ${info.facts.join(' ')}`, o.id).toMatch(/inventad|ilustra/i)
    }
  })
})

describe('objetos del sector β', () => {
  const objects = beta.scene!.objects

  it('ids únicos y solo cuerpos naturales (la estación del boceto se retiró)', () => {
    expect(new Set(objects.map((o) => o.id)).size).toBe(objects.length)
    const kinds = new Set(objects.map((o) => o.kind))
    expect([...kinds].sort()).toEqual(['planet', 'ringedPlanet', 'smallBody', 'sphere'])
  })

  it('composición del boceto: 2 planetas, 1 con anillo, 1 esfera y varios cuerpos pequeños (sin la estación)', () => {
    // Solo los objetos medidos del boceto; los añadidos fuera de él se prueban aparte.
    const count = (k: string) => objects.filter((o) => SKETCH_IDS.includes(o.id) && o.kind === k).length
    expect(count('planet')).toBe(2)
    expect(count('ringedPlanet')).toBe(1)
    expect(count('station')).toBe(0)
    expect(count('sphere')).toBe(1)
    expect(count('smallBody')).toBeGreaterThanOrEqual(4)
  })

  it('los datos específicos de cada tipo están presentes', () => {
    for (const o of objects) {
      if (o.kind === 'ringedPlanet') expect(o.ring && o.ring.outer > o.ring.inner).toBe(true)
      if (o.kind === 'station') expect(o.length).toBeGreaterThan(o.radius)
      if (o.kind === 'planet' || o.kind === 'ringedPlanet') expect(o.surface).toBeDefined()
    }
  })

  it('ningún punto de ruta queda dentro de un objeto', () => {
    for (const w of beta.scene!.waypoints) {
      for (const o of objects) {
        const d = Math.hypot(...(w.position.map((v, i) => v - o.position[i]!) as [number, number, number]))
        expect(d).toBeGreaterThan(o.radius * (o.ring?.outer ?? 1) + 5)
      }
    }
  })

  it('cada punto nombra un objeto cercano para el HUD y los focusId son válidos', () => {
    expect(validateFocus(beta.scene!.waypoints, objects)).toEqual([])
    for (const w of beta.scene!.waypoints) {
      expect(nearbyObject(w, objects)?.label).toBeTruthy()
    }
  })
})

describe('nearestLabelled', () => {
  it('ignora los objetos sin etiqueta y mide a la superficie', () => {
    const base = { kind: 'sphere', seed: 1, palette: ['#000', '#000', '#000'] } as const
    const found = nearestLabelled(
      [0, 0, 0],
      [
        { ...base, id: 'sin', position: [1, 0, 0], radius: 0.1 },
        { ...base, id: 'pequeño', label: 'P', position: [0, 0, -10], radius: 1 },
        { ...base, id: 'grande', label: 'G', position: [0, 0, -12], radius: 8 },
      ],
    )
    expect(found?.id).toBe('grande')
    expect(nearestLabelled([0, 0, 0], [])).toBeUndefined()
  })
})

describe('nearbyObject y validateFocus', () => {
  const base = { kind: 'sphere', seed: 1, palette: ['#000', '#000', '#000'] } as const
  const objs = [
    { ...base, id: 'cerca', label: 'Cerca', position: [0, 0, -5], radius: 1 },
    { ...base, id: 'lejos', label: 'Lejos', position: [0, 0, -90], radius: 1 },
    { ...base, id: 'mudo', position: [0, 0, -50], radius: 1 },
  ] as const
  const wp = { id: 'w', name: 'w', position: [0, 0, 0], yawDeg: 0, pitchDeg: 0, links: {} } as const

  it('el focusId manda sobre la distancia', () => {
    expect(nearbyObject(wp, objs)?.id).toBe('cerca')
    expect(nearbyObject({ ...wp, focusId: 'lejos' }, objs)?.id).toBe('lejos')
  })

  it('validateFocus detecta focusId inexistente, sin etiqueta y objetos duplicados', () => {
    expect(validateFocus([{ ...wp, focusId: 'nada' }], objs)).toHaveLength(1)
    expect(validateFocus([{ ...wp, focusId: 'mudo' }], objs)[0]).toContain('etiqueta')
    expect(validateFocus([], [objs[0], objs[0]])[0]).toContain('duplicado')
    expect(validateFocus([{ ...wp, focusId: 'cerca' }], objs)).toEqual([])
  })
})

describe('fromView', () => {
  it('el centro de la pantalla cae sobre el eje de visión', () => {
    expect(fromView(0, 0, 100)).toEqual([0, 0, -100])
  })

  it('arriba-izquierda queda a -X, +Y y delante', () => {
    const [x, y, z] = fromView(-1, 1, 100)
    expect(x).toBeLessThan(0)
    expect(y).toBeGreaterThan(0)
    expect(z).toBe(-100)
  })
})
