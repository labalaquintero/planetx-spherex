/** Tipos del motor. Un sector se describe solo con datos: el motor no conoce a ningún sector. */

export type Direction = 'forward' | 'back' | 'left' | 'right'

export type Vec3 = readonly [x: number, y: number, z: number]

/** Convención de ejes: se mira hacia -Z; +X es la derecha; +Y es arriba. */
export interface Waypoint {
  readonly id: string
  /** Nombre que muestra el HUD. */
  readonly name: string
  readonly position: Vec3
  /** Giro a la izquierda (positivo) o a la derecha (negativo), en grados. */
  readonly yawDeg: number
  /** Mirar hacia arriba (positivo) o hacia abajo (negativo), en grados. */
  readonly pitchDeg: number
  /** Objeto que el HUD nombra como «cercano» en este punto. Sin valor, se usa el etiquetado más próximo. */
  readonly focusId?: string
  /** Vecino al que se llega con cada dirección. Una dirección ausente no tiene punto. */
  readonly links: Readonly<Partial<Record<Direction, string>>>
}

/** Solo los tipos que aparecen en el boceto. No se añaden entidades nuevas. */
export type SceneObjectKind = 'planet' | 'ringedPlanet' | 'station' | 'smallBody' | 'sphere'

export interface SceneObject {
  readonly id: string
  readonly kind: SceneObjectKind
  /** Etiqueta del HUD. Sin etiqueta, el objeto no cuenta como «cercano». */
  readonly label?: string
  readonly position: Vec3
  /** Radio en unidades de escena (en la estación, el radio del cilindro). */
  readonly radius: number
  /** Semilla de la textura / forma procedural: mismo valor, mismo aspecto. */
  readonly seed: number
  /** Colores base de la textura procedural (CSS hex). */
  readonly palette: readonly [string, string, string]
  /** Planeta con bandas (gigante gaseoso) o con superficie moteada (rocoso). */
  readonly surface?: 'bands' | 'rocky'
  /** Solo planeta con anillo: radios interno y externo en múltiplos del radio. */
  readonly ring?: { readonly inner: number; readonly outer: number; readonly tiltDeg: number }
  /** Solo estación: longitud del cilindro. */
  readonly length?: number
}

export interface SectorScene {
  readonly startId: string
  readonly waypoints: readonly Waypoint[]
  readonly objects: readonly SceneObject[]
}

export interface SectorConfig {
  readonly id: string
  /** Símbolo que se muestra en la pantalla de selección (α, β, ε). */
  readonly symbol: string
  readonly name: string
  readonly description: string
  /** Orden en la lista y en el foco por teclado. */
  readonly order: number
  /** Posición de la esfera en la pantalla de selección, en % del campo estelar. */
  readonly selector: {
    readonly x: number
    readonly y: number
    /** Diámetro en % del ancho mínimo del campo. */
    readonly size: number
    /** Colores (claro, oscuro) de la superficie de la esfera. */
    readonly colors: readonly [string, string]
    /** Superficie procedural del cuerpo de la selección y su semilla. */
    readonly surface: 'bands' | 'rocky'
    readonly seed: number
    /** Color del halo (CSS). */
    readonly glow: string
  }
  /** «Próximamente» si no hay escena. Un sector es navegable si y solo si trae `scene`. */
  readonly scene?: SectorScene
}
