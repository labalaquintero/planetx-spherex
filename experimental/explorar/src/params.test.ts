import { describe, expect, it } from 'vitest'
import { parseParams } from './params'

describe('parseParams', () => {
  it('por defecto: calidad automática y sin depuración', () => {
    expect(parseParams('')).toEqual({ quality: 'auto', debug: false })
  })

  it('?quality=low|high fuerza la calidad (sin distinguir mayúsculas ni espacios)', () => {
    expect(parseParams('?quality=low').quality).toBe('low')
    expect(parseParams('?quality=HIGH').quality).toBe('high')
    expect(parseParams('?quality=%20low%20').quality).toBe('low')
  })

  it('valores desconocidos o vacíos vuelven a automático', () => {
    for (const q of ['?quality=ultra', '?quality=', '?quality=medium', '?quality=1']) {
      expect(parseParams(q).quality).toBe('auto')
    }
  })

  it('?debug activa el contador; ?debug=0/false/off no', () => {
    expect(parseParams('?debug').debug).toBe(true)
    expect(parseParams('?debug=1').debug).toBe(true)
    expect(parseParams('?debug=true').debug).toBe(true)
    expect(parseParams('?debug=0').debug).toBe(false)
    expect(parseParams('?debug=false').debug).toBe(false)
    expect(parseParams('?debug=OFF').debug).toBe(false)
    expect(parseParams('?quality=low&debug').debug).toBe(true)
  })

  it('combina ambos parámetros', () => {
    expect(parseParams('?debug&quality=high')).toEqual({ quality: 'high', debug: true })
  })
})
