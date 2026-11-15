import { aimAt, REFERENCE_ASPECT } from '../../engine/projection'
import type { SectorConfig, SmallBodyField, Waypoint } from '../../engine/types'
import { selectorFromSketch } from '../selector'
import { CAMPO, RECORTE } from './campo'
import { ENTRY_CAMERA, OBJECTS } from './objects'
import { WAYPOINTS } from './waypoints'

/**
 * Sector α: campo de WISE 0855 a partir de los dos recortes reales de SPHEREx (ver README.md).
 * Los miradores laterales miran a su fuente, arriba en pantalla, donde la nave no la tapa.
 */
const AIMED = new Set(['izq', 'der'])
const ROUTE: readonly Waypoint[] = WAYPOINTS.map((w) => {
  const focus = OBJECTS.find((o) => o.id === w.focusId)
  if (!AIMED.has(w.id) || !focus) return w
  const screen = { u: w.position[0] < 0 ? 0.42 : 0.58, v: 0.3 }
  return { ...w, ...aimAt(w.position, focus.position, screen, ENTRY_CAMERA.fovDeg, ENTRY_CAMERA.aspect) }
})

/**
 * Relleno fuera del recorte con la misma densidad de fuentes medida dentro: el recorte ocupa esta
 * fracción de la vista de entrada, así que fuera caben fuentes × (1 − fracción) / fracción cuerpos.
 * Tamaños entre la roca más pequeña y la más grande colocadas sobre fuentes reales.
 */
export const FRACCION_RECORTE = (RECORTE.alto * RECORTE.alto) / REFERENCE_ASPECT
const rocas = OBJECTS.filter((o) => o.kind === 'smallBody').map((o) => o.radius)
const r1 = (x: number) => Math.round(x * 10) / 10

export const FIELD: SmallBodyField = {
  seed: 855,
  count: Math.round((CAMPO.deteccion.fuentes_conservadas * (1 - FRACCION_RECORTE)) / FRACCION_RECORTE),
  center: [0, 5, -190],
  extent: [230, 80, 170],
  minRadius: r1(Math.min(...rocas)),
  maxRadius: r1(Math.max(...rocas)),
  clearance: 14,
  palette: ['#8f96a3', '#5d6470', '#2f343c'],
}

const alpha: SectorConfig = {
  id: 'alpha',
  symbol: 'α',
  name: 'Sector α',
  description:
    'Campo de observación compuesto sobre las fuentes reales de dos recortes de SPHEREx alrededor de WISE 0855. Representación ilustrativa.',
  order: 1,
  selector: { ...selectorFromSketch('alpha'), colors: ['#e8c8a0', '#5a3a22'], surface: 'rocky', seed: 5, glow: 'rgba(251, 191, 140, 0.45)' },
  scene: {
    startId: 'entry',
    waypoints: ROUTE,
    objects: OBJECTS,
    field: FIELD,
  },
}

export default alpha
