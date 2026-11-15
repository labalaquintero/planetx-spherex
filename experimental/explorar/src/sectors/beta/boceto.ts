/**
 * Objetos de β medidos en el boceto de navegación (docs/referencias/layout.json, generado por
 * tools/analizar_bocetos.py). Solo los usa este sector; lo compartido (nave, cruceta y pantalla de
 * selección) está en src/boceto.ts.
 */
import layout from '../../../docs/referencias/layout.json'

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
