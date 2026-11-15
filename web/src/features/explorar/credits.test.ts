import { describe, expect, it } from 'vitest'
import attributions from './ATTRIBUTIONS.md?raw'
import { ASSET_CREDITS } from './credits'
import { TEXTURES } from './scene/assets'
import beta from './sectors/beta'

describe('créditos de los recursos empaquetados', () => {
  it('cada textura e imagen de referencia empaquetada tiene crédito, y cada crédito apunta a archivos que existen', () => {
    const credited = ASSET_CREDITS.flatMap((c) => c.assets)
    const referencias = Object.keys(import.meta.glob('./sectors/*/referencias/*.png')).map((p) => p.split('/').pop()!.replace('.png', ''))
    expect(referencias.length).toBeGreaterThan(0)
    expect([...credited].sort()).toEqual([...Object.keys(TEXTURES), ...referencias].sort())
  })

  it('ATTRIBUTIONS.md recoge cada archivo, autor, licencia y URL', () => {
    for (const c of ASSET_CREDITS) {
      expect(attributions).toContain(c.url)
      expect(attributions).toContain(c.license.split(' (')[0]!)
      for (const a of c.assets) expect(attributions).toMatch(new RegExp(`${a}\\.(webp|png)`))
    }
  })

  it('las licencias son de las permitidas (CC BY, dominio público o crédito NASA/JPL-Caltech)', () => {
    for (const c of ASSET_CREDITS) expect(c.license).toMatch(/^(CC BY 4\.0|Dominio público|Courtesy NASA\/JPL-Caltech)/)
  })

  it('los objetos de β solo usan texturas empaquetadas', () => {
    for (const o of beta.scene!.objects) {
      if (!o.texture) continue
      for (const id of [o.texture.map, o.texture.bump, o.texture.ringMap]) {
        if (id) expect(Object.keys(TEXTURES)).toContain(id)
      }
    }
  })

  it('ningún recurso apunta fuera del propio origen', () => {
    // En node la URL es file://; en jsdom, http://localhost. Nunca otro host.
    for (const url of Object.values(TEXTURES)) expect(url).not.toMatch(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/)
  })
})
