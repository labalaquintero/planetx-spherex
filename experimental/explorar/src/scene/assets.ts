/**
 * Texturas empaquetadas (src/scene/assets/, generadas con tools/preparar_texturas.py). Vite las
 * emite como archivos propios y solo se descargan desde el mismo origen al entrar en un sector.
 * Fuentes y licencias: ATTRIBUTIONS.md.
 */
export const TEXTURES = {
  'bandas-saturno': new URL('./assets/bandas-saturno.webp', import.meta.url).href,
  'anillo-saturno': new URL('./assets/anillo-saturno.webp', import.meta.url).href,
  'luna-color': new URL('./assets/luna-color.webp', import.meta.url).href,
  'luna-relieve': new URL('./assets/luna-relieve.webp', import.meta.url).href,
} as const

export type TextureId = keyof typeof TEXTURES
