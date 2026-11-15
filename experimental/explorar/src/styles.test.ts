import { describe, expect, it } from 'vitest'
import css from './explorar.css?raw'

/**
 * Los estilos de <Explorar /> se montarán dentro del visor: ningún selector puede salir del
 * componente. Cada selector empieza por .explorar o por una clase ex-*, y las animaciones
 * llevan prefijo ex-.
 */
function selectors(source: string): { selectors: string[]; keyframes: string[] } {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  const keyframes: string[] = []
  let depth = 0
  let skipUntilDepth = -1
  let buf = ''
  for (const ch of text) {
    if (ch === '{') {
      const prelude = buf.trim()
      buf = ''
      if (skipUntilDepth < 0) {
        if (prelude.startsWith('@keyframes')) {
          keyframes.push(prelude.replace('@keyframes', '').trim())
          skipUntilDepth = depth
        } else if (!prelude.startsWith('@')) {
          out.push(...prelude.split(',').map((s) => s.trim()))
        }
      }
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === skipUntilDepth) skipUntilDepth = -1
      buf = ''
    } else if (ch === ';') {
      buf = ''
    } else {
      buf += ch
    }
  }
  return { selectors: out, keyframes }
}

describe('encapsulación de explorar.css', () => {
  const parsed = selectors(css)

  it('encuentra reglas (el analizador funciona)', () => {
    expect(parsed.selectors.length).toBeGreaterThan(20)
  })

  it('todos los selectores están dentro de .explorar o usan una clase ex-*', () => {
    const leaking = parsed.selectors.filter((s) => !/^\.(explorar|ex-)/.test(s))
    expect(leaking).toEqual([])
  })

  it('las animaciones llevan prefijo ex-', () => {
    expect(parsed.keyframes.filter((k) => !k.startsWith('ex-'))).toEqual([])
  })

  it('no hay selectores de elemento sueltos, :root, html, body ni *', () => {
    expect(css).not.toMatch(/(^|[\s,}])(:root|html|body)\s*[{,]/m)
  })

  it('el diálogo de créditos recibe la rueda y el arrastre aunque esté dentro del HUD (pointer-events: none)', () => {
    const rule = /\.ex-credits\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toMatch(/pointer-events:\s*auto/)
    expect(rule).toMatch(/overflow-y:\s*auto/)
  })
})
