import type { ObjectInfo } from '../../engine/types'
// «?no-inline»: los PNG son pequeños y Vite los incrustaría en base64 en el chunk principal.
import WISE_MAYO from './referencias/wise0855-2025-05-06.png?no-inline'
import WISE_OCTUBRE from './referencias/wise0855-2025-10-31.png?no-inline'

/**
 * Contexto de los objetos de β para el HUD. Los objetos son ilustrativos; cada ficha dice de qué
 * referencia real parte y muestra esa imagen (empaquetada, sin red).
 */
// Mismos archivos que usa la escena (no se duplican en el build); se referencian directamente para no
// arrastrar el registro de texturas al chunk principal.
const LUNA = new URL('../../scene/assets/luna-color.webp', import.meta.url).href
const SATURNO = new URL('../../scene/assets/bandas-saturno.webp', import.meta.url).href

export const BETA_INFO: Readonly<Record<string, ObjectInfo>> = {
  ilmara: {
    title: 'Mundo frío inspirado en WISE 0855',
    summary:
      'Ilmara es inventado, pero parte de WISE 0855−0714: una enana marrón muy fría a unos 7,4 años luz del Sol, ' +
      'descubierta en 2014 con datos del telescopio WISE. Con una temperatura estimada de unos 250–285 K ' +
      '(entre −20 y 10 °C) es de los objetos de tipo estelar más fríos conocidos.',
    facts: [
      'Las enanas marrones no tienen masa suficiente para fusionar hidrógeno: brillan sobre todo en infrarrojo.',
      'Abajo, recortes reales de SPHEREx del campo de WISE 0855 en dos épocas (0,99 µm, 64 × 64 px).',
      'Los colores, los vórtices y el brillo de Ilmara son una ilustración.',
    ],
    images: [
      { src: WISE_MAYO, caption: 'SPHEREx · 6 may 2025', pixelated: true },
      { src: WISE_OCTUBRE, caption: 'SPHEREx · 31 oct 2025', pixelated: true },
    ],
    credit: 'Imágenes: NASA/JPL-Caltech, SPHEREx (NASA/IPAC IRSA).',
  },
  veshta: {
    title: 'Planeta rocoso',
    summary:
      'Veshta es inventado. Su superficie usa el mapa de color y relieve de la Luna obtenido por la sonda ' +
      'Lunar Reconnaissance Orbiter (LRO) de la NASA, recoloreado en tonos azules.',
    facts: [
      'Los cráteres y mares que se ven son lunares; el relieve sale del altímetro láser LOLA.',
      'Su tamaño y su posición siguen el boceto del sector.',
    ],
    images: [{ src: LUNA, caption: 'Mapa de color de la Luna (LRO)' }],
    credit: 'Imagen: NASA Scientific Visualization Studio, dominio público.',
  },
  orun: {
    title: 'Planeta con anillo',
    summary:
      'Orun es inventado. Su superficie y su anillo parten de mapas de Saturno, teñidos hacia su paleta. ' +
      'El anillo proyecta su sombra sobre el planeta y el planeta sobre el anillo.',
    facts: [
      'Los anillos planetarios son innumerables partículas de hielo y roca: aquí la nave puede cruzarlos.',
      'La inclinación del anillo se midió en el boceto (unos 11°).',
    ],
    images: [{ src: SATURNO, caption: 'Mapa de Saturno (base de la textura)' }],
    credit: 'Imagen: Solar System Scope, CC BY 4.0.',
  },
  ancla: {
    title: 'Estación del boceto',
    summary:
      'Estación ilustrativa tomada del boceto: un cilindro con un anillo de atraque en un extremo. ' +
      'No representa ninguna estación real.',
    facts: ['Las luces que parpadean marcan sus extremos.', 'Su posición y su tamaño se midieron en el boceto.'],
    images: [],
  },
  esfera: {
    title: 'Esfera menor',
    summary: 'Pequeña esfera rocosa inventada, tomada del boceto. Usa el mismo mapa lunar de la NASA que Veshta, con otra paleta.',
    facts: ['Es el objeto con nombre más cercano a la entrada del sector.'],
    images: [{ src: LUNA, caption: 'Mapa de color de la Luna (LRO)' }],
    credit: 'Imagen: NASA Scientific Visualization Studio, dominio público.',
  },
}
