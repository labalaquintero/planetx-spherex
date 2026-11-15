import { describe, expect, it } from 'vitest'
import attributions from '../ATTRIBUTIONS.md?raw'
import { ASSET_CREDITS } from './credits'
import { TEXTURES } from './scene/assets'
import beta from './sectors/beta'

describe('créditos de los recursos empaquetados', () => {
  it('cada textura empaquetada tiene crédito, y cada crédito apunta a texturas que existen', () => {
    const credited = ASSET_CREDITS.flatMap((c) => c.assets)
    expect([...credited].sort()).toEqual(Object.keys(TEXTURES).sort())
  })

  it('ATTRIBUTIONS.md recoge cada archivo, autor, licencia y URL', () => {
    for (const c of ASSET_CREDITS) {
      expect(attributions).toContain(c.url)
      expect(attributions).toContain(c.license)
      for (const a of c.assets) expect(attributions).toContain(`${a}.webp`)
    }
  })

  it('las licencias son de las permitidas (CC BY o dominio público)', () => {
    for (const c of ASSET_CREDITS) expect(c.license).toMatch(/^(CC BY 4\.0|Dominio público)/)
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
