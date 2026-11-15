/**
 * Datos medidos de los bocetos (docs/referencias/layout.json, generado por
 * tools/analizar_bocetos.py). Es la única fuente de la composición: la escena de β, la nave y la
 * pantalla de selección se colocan a partir de aquí.
 */
import layout from '../docs/referencias/layout.json'

export type ClaseBoceto = 'planet' | 'ringedPlanet' | 'station' | 'sphere' | 'smallBody'

export interface AnclaBoceto {
  readonly centro: readonly [number, number]
  readonly diametro_v: number
  readonly largo_v?: number
  readonly asa_largo_v?: number
  readonly asa_alto_v?: number
}

export interface ObjetoBoceto {
  readonly id: string
  readonly clase: ClaseBoceto
  readonly confianza: string
  readonly nota: string
  readonly angulo_deg: number
  readonly elongacion: number
  readonly ancla: AnclaBoceto
}

export const OBJETOS_BOCETO: readonly ObjetoBoceto[] = layout.navegacion.objetos as unknown as ObjetoBoceto[]

export function objetoBoceto(id: string): ObjetoBoceto {
  const o = OBJETOS_BOCETO.find((x) => x.id === id)
  if (!o) throw new Error(`layout.json no tiene el objeto «${id}»`)
  return o
}

export const NAVE_AJUSTE = layout.navegacion.nave.ajuste
export const NAVE_MEDIDA = layout.navegacion.nave
export const CRUCETA_BOCETO = layout.navegacion.cruceta
export const SELECCION_BOCETO = layout.seleccion
