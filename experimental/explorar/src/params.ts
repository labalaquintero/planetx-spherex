/** Parámetros de URL del extra: ?quality=low|high fuerza la calidad; ?debug muestra el contador de FPS. */
export type QualityParam = 'auto' | 'low' | 'high'

export interface ExplorarParams {
  readonly quality: QualityParam
  readonly debug: boolean
}

export function parseParams(search: string): ExplorarParams {
  const p = new URLSearchParams(search)
  const q = p.get('quality')?.trim().toLowerCase()
  const quality: QualityParam = q === 'low' || q === 'high' ? q : 'auto'
  // ?debug, ?debug=1 y ?debug=true lo activan; ?debug=0 y ?debug=false no.
  const d = p.get('debug')
  const debug = d !== null && !/^(0|false|no|off)$/i.test(d.trim())
  return { quality, debug }
}

/** Lee la URL actual del navegador (en pruebas o SSR, valores por defecto). */
export function currentParams(): ExplorarParams {
  return parseParams(typeof window === 'undefined' ? '' : window.location.search)
}
