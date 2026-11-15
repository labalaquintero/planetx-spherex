/**
 * ¿Puede este navegador crear un contexto WebGL? Se comprueba antes de montar la escena para
 * mostrar un aviso claro en lugar de una pantalla en blanco.
 */
export function detectWebGL(createCanvas: () => { getContext(kind: string): unknown } = () => document.createElement('canvas')): boolean {
  try {
    const canvas = createCanvas()
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}
