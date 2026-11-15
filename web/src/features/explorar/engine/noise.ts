/**
 * Ruido de valor 3D determinista (sin dependencias). Se usa para dibujar en 2D las esferas de la
 * selección; en la escena 3D el mismo tipo de ruido se calcula en GPU (scene/shaders.ts).
 */
export function makeNoise3(seed: number): (x: number, y: number, z: number) => number {
  // Tabla de permutación sembrada (Fisher-Yates con un LCG).
  const perm = new Uint8Array(512)
  const base = new Uint8Array(256)
  for (let i = 0; i < 256; i++) base[i] = i
  let s = (seed >>> 0) || 1
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    const t = base[i]!
    base[i] = base[j]!
    base[j] = t
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255]!
  const val = (x: number, y: number, z: number) => perm[(perm[(perm[x & 255]! + y) & 511]! + z) & 511]! / 255
  const fade = (t: number) => t * t * (3 - 2 * t)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  return (x, y, z) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const u = fade(x - xi)
    const v = fade(y - yi)
    const w = fade(z - zi)
    const c = (dx: number, dy: number, dz: number) => val(xi + dx, yi + dy, zi + dz)
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
      w,
    )
  }
}

/** Suma de octavas normalizada a [0, 1]. */
export function fbm3(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
  octaves: number,
): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let f = 1
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f, z * f)
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return sum / norm
}
