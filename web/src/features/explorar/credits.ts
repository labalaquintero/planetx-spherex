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
    note: 'Reducidas a 1024 px y convertidas a WebP. Superficie de los planetas ilustrativos Orun (teñida hacia su paleta), Calder y Argento (solo su luminancia).',
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
  {
    what: 'Primer mapa infrarrojo de todo el cielo de SPHEREx (PIA26600) y región molecular de Vela (PIA26354)',
    author: 'NASA/JPL-Caltech, misión SPHEREx',
    license: 'Courtesy NASA/JPL-Caltech (política de uso de imágenes de JPL)',
    url: 'https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/',
    assets: ['cielo-spherex', 'vela-spherex', 'plano-galactico', 'burbuja-spherex', 'lazos-spherex', 'filamentos-spherex', 'nebulosa-vela', 'cielo-spherex-original', 'vela-spherex-original'],
    note:
      'Son la superficie de los planetas ilustrativos «Cielo infrarrojo» (el mapa del cielo reproyectado sobre la esfera), ' +
      '«Vela» y «Polvo de Vela» (la imagen de Vela sin estrellas, en franjas), «Plano galáctico» (el perfil de color de la ' +
      'Vía Láctea), «Burbuja», «Lazos galácticos» y «Filamentos» (recortes del mapa), «Nebulosa de Vela» y «Abisal» (el mapa del cielo, solo su luminancia). ' +
      'Generadas con tools/texturas_spherex.py.',
  },
  {
    what: 'Mapas globales de Marte, Ío, Europa, Ganímedes, Fobos y Venus (Viking, Voyager, Galileo y Magellan)',
    author: 'NASA/JPL-Caltech/USGS — Solar System Simulator de JPL (David Seal)',
    license: 'Courtesy NASA/JPL-Caltech (política de uso de imágenes de JPL)',
    url: 'https://maps.jpl.nasa.gov/tmaps/',
    assets: [
      'marte-viking',
      'io-galileo',
      'europa-voyager',
      'ganimedes-voyager',
      'fobos-viking',
      'venus-magellan',
      'marte-viking-original',
      'io-galileo-original',
      'europa-voyager-original',
      'ganimedes-voyager-original',
      'fobos-viking-original',
      'venus-magellan-original',
    ],
    note:
      'Son la superficie de los planetas ilustrativos de α (Óxido, Hielo rayado, Azufre, Surcos, Radar y Cráter) y, ' +
      'solo por su luminancia y recoloreados, de seis planetas de β (Brasa, Jade, Ceniza, Marea, Escarcha y Hollín). ' +
      'Reducidos a 1024 × 512 y convertidos a WebP con tools/alpha/texturas_nasa.py; Europa, Ganímedes y Fobos se recolorean.',
  },
]

export const SOFTWARE_CREDITS: readonly { name: string; license: string }[] = [
  { name: 'three.js', license: 'MIT' },
  { name: 'React', license: 'MIT' },
  { name: '@react-three/fiber', license: 'MIT' },
]
