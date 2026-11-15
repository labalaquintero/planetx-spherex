/**
 * Datos medidos de los bocetos (docs/referencias/layout.json, generado por
 * tools/analizar_bocetos.py) que comparten todos los sectores: la nave, la cruceta y la pantalla de
 * selección. Los objetos de cada sector viven en su carpeta (p. ej. src/sectors/beta/boceto.ts).
 */
import layout from '../docs/referencias/layout.json'

export const NAVE_AJUSTE = layout.navegacion.nave.ajuste
export const NAVE_MEDIDA = layout.navegacion.nave
export const CRUCETA_BOCETO = layout.navegacion.cruceta
export const SELECCION_BOCETO = layout.seleccion
