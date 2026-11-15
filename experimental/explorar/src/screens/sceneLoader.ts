/**
 * Carga diferida del chunk de three. Una sola promesa compartida: la selección la dispara al
 * pasar el cursor o enfocar un sector disponible, y así el salto se superpone a la descarga.
 */
type SceneModule = typeof import('../scene/SectorScene')

let pending: Promise<SceneModule> | null = null

export function loadScene(): Promise<SceneModule> {
  if (!pending) {
    pending = import('../scene/SectorScene')
    pending.catch(() => {
      pending = null // permite reintentar si falló
    })
  }
  return pending
}
