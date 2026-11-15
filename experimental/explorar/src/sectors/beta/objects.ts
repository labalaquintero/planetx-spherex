import type { SceneObject } from '../../engine/types'
import { fromView } from '../view'

/**
 * Composición tomada del boceto (solo como guía). Las posiciones se declaran como «dónde se ven
 * desde la entrada» (fromView) y las formas se completan de manera plausible. Todo es ilustrativo.
 */
export const OBJECTS: readonly SceneObject[] = [
  // Dos planetas grandes arriba a la izquierda.
  {
    id: 'ilmara',
    kind: 'planet',
    label: 'Ilmara (planeta)',
    position: fromView(-0.76, 0.5, 170),
    radius: 20,
    seed: 11,
    palette: ['#d9b48a', '#a8683c', '#6b3a22'],
    surface: 'bands',
    atmosphere: '#fdba74',
  },
  {
    id: 'veshta',
    kind: 'planet',
    label: 'Veshta (planeta)',
    position: fromView(-0.7, 0.8, 250),
    radius: 17,
    seed: 23,
    palette: ['#9fb4c9', '#5a7392', '#2c3f58'],
    surface: 'rocky',
    atmosphere: '#7dd3fc',
  },
  // Planeta con anillo arriba a la derecha.
  {
    id: 'orun',
    kind: 'ringedPlanet',
    label: 'Orun (planeta con anillo)',
    position: fromView(0.58, 0.36, 210),
    radius: 13,
    seed: 37,
    palette: ['#e8d9b0', '#c2a56c', '#8a6e3c'],
    surface: 'bands',
    ring: { inner: 1.45, outer: 2.3, tiltDeg: 24 },
    atmosphere: '#fde68a',
  },
  // Objeto cilíndrico con anillo, a la derecha al medio.
  {
    id: 'ancla',
    kind: 'station',
    label: 'Estación Ancla',
    position: [70, -18, -150],
    radius: 4,
    length: 20,
    seed: 41,
    palette: ['#cfd6de', '#a3adb9', '#5d6775'],
  },
  // Esfera pequeña cerca del centro-derecha.
  {
    id: 'esfera',
    kind: 'sphere',
    label: 'Esfera menor',
    position: [38, -4, -120],
    radius: 3.4,
    seed: 53,
    palette: ['#c9d8e6', '#8da6bf', '#4c6580'],
  },
  // Cuerpos pequeños dispersos (sin etiqueta).
  { id: 'c1', kind: 'smallBody', position: fromView(-0.62, 0.6, 120), radius: 1.6, seed: 101, palette: ['#8c8478', '#665f55', '#3d3832'] },
  { id: 'c2', kind: 'smallBody', position: fromView(-0.58, 0.38, 140), radius: 2.2, seed: 102, palette: ['#8c8478', '#665f55', '#3d3832'] },
  { id: 'c3', kind: 'smallBody', position: fromView(-0.33, 0.52, 190), radius: 2.6, seed: 103, palette: ['#8c8478', '#665f55', '#3d3832'] },
  { id: 'c4', kind: 'smallBody', position: fromView(0.26, 0.33, 230), radius: 3, seed: 104, palette: ['#8c8478', '#665f55', '#3d3832'] },
  { id: 'c5', kind: 'smallBody', position: [-20, -12, -70], radius: 1.4, seed: 105, palette: ['#8c8478', '#665f55', '#3d3832'] },
  { id: 'c6', kind: 'smallBody', position: [14, 10, -60], radius: 1.1, seed: 106, palette: ['#8c8478', '#665f55', '#3d3832'] },
  { id: 'c7', kind: 'smallBody', position: [-52, -6, -110], radius: 2, seed: 107, palette: ['#8c8478', '#665f55', '#3d3832'] },
  { id: 'c8', kind: 'smallBody', position: [-6, 16, -140], radius: 1.8, seed: 108, palette: ['#8c8478', '#665f55', '#3d3832'] },
]
