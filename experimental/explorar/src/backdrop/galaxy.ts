/**
 * Geometría de la galaxia de la pantalla de selección (lógica pura, compartida por el shader y el
 * HTML). Las coordenadas «uv» son las del shader: origen en el centro del lienzo, y hacia arriba y
 * unidades del alto del lienzo (x va de −aspecto/2 a +aspecto/2).
 *
 * La galaxia es un disco espiral inclinado: en pantalla es una elipse de semiejes `major` y `minor`
 * girada `angleRad`. Cada sector es una región elíptica dentro de ese disco, con la misma inclinación.
 */

/** Altura del centro de la galaxia (fracción desde arriba) e inclinación de su eje mayor. */
export const GALAXY = {
  centerY: 0.47,
  /** Negativo: el eje mayor baja de izquierda a derecha. */
  angleDeg: -14,
  /** Proporción alto/ancho de las regiones de sector (un círculo del disco visto inclinado). */
  areaRatio: 0.62,
  /** Desplazamiento de paralaje de la galaxia y de sus regiones, en unidades del alto. */
  parallax: 0.02,
} as const

export interface GalaxyLayout {
  readonly cx: number
  readonly cy: number
  readonly major: number
  readonly minor: number
  readonly angleRad: number
}

/** La galaxia ocupa casi todo el ancho; en pantallas estrechas se aplana menos para cubrir el alto. */
export function galaxyLayout(aspect: number): GalaxyLayout {
  const major = Math.min(0.47 * aspect, 0.95)
  const minor = Math.max(Math.min(major * 0.5, 0.44), 0.3)
  return { cx: 0, cy: 0.5 - GALAXY.centerY, major, minor, angleRad: (GALAXY.angleDeg * Math.PI) / 180 }
}

/** Centro de un sector (x, y en % del contenedor) en coordenadas uv. */
export function areaUv(xPct: number, yPct: number, aspect: number): [number, number] {
  return [(xPct / 100 - 0.5) * aspect, 0.5 - yPct / 100]
}

/** Semieje mayor de la región de un sector (uv), a partir de su tamaño en el boceto (cqmin). */
export function areaRadius(size: number): number {
  return Math.min(0.13, Math.max(0.085, (size / 100) * 0.7))
}

/**
 * Escala de las regiones según el ancho: en pantallas anchas no cambian; en estrechas (verticales) se
 * reducen con el ancho para no solaparse. El CSS hace lo mismo con min(…cqh, …cqw).
 */
export const AREA_WIDTH_FACTOR = 0.85
export function areaScale(aspect: number): number {
  return Math.min(1, aspect * AREA_WIDTH_FACTOR)
}

/** Distancia al centro del disco, desproyectada (1 = borde de la galaxia). */
export function diskRadius(p: readonly [number, number], g: GalaxyLayout): number {
  const x = p[0] - g.cx
  const y = p[1] - g.cy
  const c = Math.cos(g.angleRad)
  const s = Math.sin(g.angleRad)
  const qx = c * x + s * y
  const qy = -s * x + c * y
  return Math.hypot(qx / g.major, qy / g.minor)
}

/** Color CSS (#rgb, #rrggbb, rgb() o rgba()) a componentes 0..1; gris claro si no se reconoce. */
export function parseRgb(css: string): [number, number, number] {
  const s = css.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s)
  if (hex) {
    const h = hex[1]!
    const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s)
  if (fn) return [Number(fn[1]) / 255, Number(fn[2]) / 255, Number(fn[3]) / 255]
  return [0.8, 0.85, 0.9]
}
