import { SELECCION_BOCETO } from '../boceto'

/**
 * Posición y tamaño de cada sector en la pantalla de selección, medidos en el boceto 1
 * (centro dentro del marco, en %). El diámetro dibujado es pequeño (6–9 % del ancho del marco):
 * se conserva la proporción entre sectores y se escala ×1,6 para que sean cómodos de señalar.
 */
export const SELECTOR_SCALE = 1.6

type Id = keyof typeof SELECCION_BOCETO.sectores

export function selectorFromSketch(id: Id): { x: number; y: number; size: number } {
  const s = SELECCION_BOCETO.sectores[id]
  const aspect = SELECCION_BOCETO.marco.aspecto // ancho/alto del marco
  return {
    x: Math.round(s.centro[0]! * 1000) / 10,
    y: Math.round(s.centro[1]! * 1000) / 10,
    // size se expresa en cqmin (el lado corto del campo, que es el alto del marco).
    size: Math.round(s.diametro_rel_marco * aspect * 100 * SELECTOR_SCALE * 10) / 10,
  }
}

/** Lado de la tarjeta: a la derecha como en el boceto, salvo si el sector está muy a la derecha. */
export function calloutSide(x: number): 'right' | 'left' {
  return x > 70 ? 'left' : 'right'
}
