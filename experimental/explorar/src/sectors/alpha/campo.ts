/**
 * Campo real de WISE 0855 medido por tools/alpha/analizar_wise0855.py (docs/referencias/alpha/
 * campo-wise0855.json): dos recortes de SPHEREx de 64 × 64 px. Aquí solo se tipa el JSON y se
 * define cómo se lleva el recorte a la pantalla de entrada del sector.
 */
import campo from '../../../docs/referencias/alpha/campo-wise0855.json'
import { REFERENCE_ASPECT } from '../../engine/projection'

export interface FuenteMedida {
  readonly id: string
  readonly brillo_relativo: number
  /** Centroide en el recorte: u a la derecha, v hacia abajo (0..1). */
  readonly u: number
  readonly v: number
  readonly area_px: number
  readonly radio_equivalente_px: number
  readonly cociente_flujo_e2_e1: number | null
  readonly desplazamiento_px: number
}

export const CAMPO = campo
export const FUENTES: readonly FuenteMedida[] = campo.fuentes as readonly FuenteMedida[]
export const LADO_PX = campo.rejilla.alto_px

export function fuente(id: string): FuenteMedida {
  const f = FUENTES.find((x) => x.id === id)
  if (!f) throw new Error(`campo-wise0855.json no tiene la fuente «${id}»`)
  return f
}

/**
 * El recorte es cuadrado y se coloca centrado en la vista de entrada (16:9), ocupando el 84 % del
 * alto y dejando un margen arriba. Lo de fuera del recorte (los lados) es relleno ilustrativo.
 * No se estira: conserva las posiciones relativas de las fuentes.
 */
export const RECORTE = { alto: 0.84, arriba: 0.04 } as const

export function aPantalla(u: number, v: number): { u: number; v: number } {
  return {
    u: 0.5 + ((u - 0.5) * RECORTE.alto) / REFERENCE_ASPECT,
    v: RECORTE.arriba + v * RECORTE.alto,
  }
}

/** Diámetro aparente (fracción del alto de pantalla) de una mancha del recorte. */
export function diametroEnPantalla(f: FuenteMedida): number {
  return ((2 * f.radio_equivalente_px) / LADO_PX) * RECORTE.alto
}
