import { Vector3 } from 'three'

/**
 * Dirección hacia la estrella clave (en el mundo). Toda la iluminación sale de aquí: la luz
 * direccional de la nave y la estación, los shaders de planetas, anillos y atmósferas, y el
 * propio disco de la estrella que se dibuja en el cielo.
 */
export const LIGHT_DIR = new Vector3(0.85, 0.3, -0.45).normalize()
/** Luz ambiente tenue, azulada (relleno del cielo). */
export const AMBIENT_RGB: [number, number, number] = [0.028, 0.036, 0.06]
