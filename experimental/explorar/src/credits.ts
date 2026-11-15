/**
 * Créditos visibles en la interfaz (panel «Créditos») y en ATTRIBUTIONS.md. Una prueba comprueba
 * que cada textura empaquetada tiene su crédito aquí y en ATTRIBUTIONS.md.
 */
export interface Credit {
  readonly what: string
  readonly author: string
  readonly license: string
  readonly url: string
  /** Archivos empaquetados (ids de scene/assets.ts) que cubre este crédito. */
  readonly assets: readonly string[]
  readonly note?: string
}

export const ASSET_CREDITS: readonly Credit[] = [
  {
    what: 'Texturas de Saturno y de su anillo',
    author: 'Solar System Scope (INOVE)',
    license: 'CC BY 4.0',
    url: 'https://www.solarsystemscope.com/textures/',
    assets: ['bandas-saturno', 'anillo-saturno'],
    note: 'Reducidas a 1024 px, convertidas a WebP y teñidas hacia la paleta de Orun (planeta ilustrativo).',
  },
  {
    what: 'Mapa de color y de relieve de la Luna (CGI Moon Kit)',
    author: "NASA's Scientific Visualization Studio — Ernie Wright; datos LRO (LROC, LOLA)",
    license: 'Dominio público (NASA)',
    url: 'https://svs.gsfc.nasa.gov/4720/',
    assets: ['luna-color', 'luna-relieve'],
    note: 'Reducidos y coloreados con la paleta de Veshta y de la esfera menor.',
  },
  {
    what: 'Recortes reales del campo de WISE 0855 (dos épocas, 0,99 µm)',
    author: 'NASA/JPL-Caltech, misión SPHEREx (datos de NASA/IPAC IRSA), procesados por el proyecto',
    license: 'Courtesy NASA/JPL-Caltech (política de uso de imágenes de SPHEREx)',
    url: 'https://irsa.ipac.caltech.edu/Missions/spherex.html',
    assets: ['wise0855-2025-05-06', 'wise0855-2025-10-31'],
    note: 'Se muestran en la ficha de Ilmara. Procedencia completa en docs/referencias/wise0855/README.md.',
  },
]

export const SOFTWARE_CREDITS: readonly { name: string; license: string }[] = [
  { name: 'three.js', license: 'MIT' },
  { name: 'React', license: 'MIT' },
  { name: '@react-three/fiber', license: 'MIT' },
]
