import { describe, expect, it } from 'vitest'
import * as backdrop from '../../backdrop/shader'
import * as glow from './glow'
import * as streak from './streak'

/**
 * En GLSL, pow(x, y) no está definido si x < 0: muchas GPU (Chrome en Windows, vía D3D) devuelven NaN,
 * que se ve como píxeles o líneas negras (y el bloom los agranda). Los cuadrados se escriben x * x.
 */
const sources = Object.entries({ ...backdrop, ...glow, ...streak }).filter(([, v]) => typeof v === 'string') as [string, string][]

describe('shaders sin pow de base negativa', () => {
  it('no elevan expresiones con signo a una potencia', () => {
    for (const [name, src] of sources) expect(src, name).not.toMatch(/pow\(\s*\(/)
  })

  it('la estela acota su coordenada a lo largo antes de pow(1 − t)', () => {
    expect(streak.STREAK_FRAG).toMatch(/clamp\(vUv\.y, 0\.0, 1\.0\)/)
    expect(streak.STREAK_FRAG).not.toMatch(/pow\(1\.0 - t/)
  })
})
