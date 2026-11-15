import { NAVE_AJUSTE, NAVE_MEDIDA } from '../boceto'

/**
 * Geometría y encuadre de la nave, ajustados por mínimos cuadrados a la silueta del boceto
 * (tools/analizar_bocetos.py → layout.json). Coordenadas de la nave: mira a -Z, Y arriba.
 */
const p = NAVE_AJUSTE.parametros

export const SHIP = {
  noseZ: p.nariz_z,
  shoulderZ: p.hombro_z,
  engineZ: p.motor_z,
  tailZ: NAVE_AJUSTE.cola_z,
  tipX: p.punta_x,
  tipZ: p.punta_z,
  /** Ancho del cuerpo medido en el boceto, como fracción de la envergadura. */
  bodyWidth: NAVE_MEDIDA.proporciones.ancho_cuerpo_sobre_envergadura * 2 * p.punta_x,
  /** Cabeceo (nariz arriba, radianes) y encuadre en el espacio de la cámara, en pantalla horizontal. */
  pitch: p.cabeceo,
  scale: p.escala,
  y: p.y,
  z: -4.6,
} as const

/** Puntos de la silueta (en coordenadas de la nave) que se comparan con el boceto. */
export const SHIP_KEY_POINTS: Readonly<Record<string, readonly [number, number, number]>> = {
  nariz: [0, 0, SHIP.noseZ],
  hombro: [0, 0.3, SHIP.shoulderZ],
  ala_izquierda: [-SHIP.tipX, -0.06, SHIP.tipZ],
  ala_derecha: [SHIP.tipX, -0.06, SHIP.tipZ],
  motor_arriba: [0, 0.31, SHIP.engineZ],
  motor_abajo: [0, -0.31, SHIP.tailZ],
}
