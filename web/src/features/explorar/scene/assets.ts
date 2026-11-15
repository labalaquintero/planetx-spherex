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
  // Imágenes de SPHEREx (NASA/JPL-Caltech) convertidas en superficie con tools/texturas_spherex.py.
  'cielo-spherex': new URL('./assets/cielo-spherex.webp', import.meta.url).href,
  'vela-spherex': new URL('./assets/vela-spherex.webp', import.meta.url).href,
  'plano-galactico': new URL('./assets/plano-galactico.webp', import.meta.url).href,
  'burbuja-spherex': new URL('./assets/burbuja-spherex.webp', import.meta.url).href,
  'lazos-spherex': new URL('./assets/lazos-spherex.webp', import.meta.url).href,
  'filamentos-spherex': new URL('./assets/filamentos-spherex.webp', import.meta.url).href,
  'nebulosa-vela': new URL('./assets/nebulosa-vela.webp', import.meta.url).href,
  // Mapas globales de NASA/JPL/USGS para los planetas de α (tools/alpha/texturas_nasa.py).
  'marte-viking': new URL('./assets/marte-viking.webp', import.meta.url).href,
  'io-galileo': new URL('./assets/io-galileo.webp', import.meta.url).href,
  'europa-voyager': new URL('./assets/europa-voyager.webp', import.meta.url).href,
  'ganimedes-voyager': new URL('./assets/ganimedes-voyager.webp', import.meta.url).href,
  'fobos-viking': new URL('./assets/fobos-viking.webp', import.meta.url).href,
  'venus-magellan': new URL('./assets/venus-magellan.webp', import.meta.url).href,
  // Mapas globales de NASA/JPL/USGS para siete planetas de β (tools/texturas_nasa_beta.py).
  'neptuno-voyager': new URL('./assets/neptuno-voyager.webp', import.meta.url).href,
  'encelado-voyager': new URL('./assets/encelado-voyager.webp', import.meta.url).href,
  'japeto-voyager': new URL('./assets/japeto-voyager.webp', import.meta.url).href,
  'calisto-voyager': new URL('./assets/calisto-voyager.webp', import.meta.url).href,
  'tetis-voyager': new URL('./assets/tetis-voyager.webp', import.meta.url).href,
  'mimas-voyager': new URL('./assets/mimas-voyager.webp', import.meta.url).href,
  'tierra-relieve': new URL('./assets/tierra-relieve.webp', import.meta.url).href,
} as const

export type TextureId = keyof typeof TEXTURES
