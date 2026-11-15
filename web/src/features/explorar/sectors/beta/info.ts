import type { ObjectInfo } from '../../engine/types'
// «?no-inline»: los PNG son pequeños y Vite los incrustaría en base64 en el chunk principal.
import WISE_MAYO from './referencias/wise0855-2025-05-06.png?no-inline'
import WISE_OCTUBRE from './referencias/wise0855-2025-10-31.png?no-inline'
import CIELO_ORIGINAL from './referencias/cielo-spherex-original.webp?no-inline'
import VELA_ORIGINAL from './referencias/vela-spherex-original.webp?no-inline'
import NEPTUNO from './referencias/neptuno-voyager-original.webp?no-inline'
import ENCELADO from './referencias/encelado-voyager-original.webp?no-inline'
import JAPETO from './referencias/japeto-voyager-original.webp?no-inline'
import CALISTO from './referencias/calisto-voyager-original.webp?no-inline'
import TETIS from './referencias/tetis-voyager-original.webp?no-inline'
import MIMAS from './referencias/mimas-voyager-original.webp?no-inline'
import TIERRA from './referencias/tierra-relieve-original.webp?no-inline'

/**
 * Contexto de los objetos de β para el HUD. Cada ficha da el contexto del objeto y dice de qué
 * referencia real parte y muestra esa imagen (empaquetada, sin red).
 */
// Mismos archivos que usa la escena (no se duplican en el build); se referencian directamente para no
// arrastrar el registro de texturas al chunk principal.
const LUNA = new URL('../../scene/assets/luna-color.webp', import.meta.url).href
const SATURNO = new URL('../../scene/assets/bandas-saturno.webp', import.meta.url).href
const IO = new URL('../../scene/assets/io-galileo.webp', import.meta.url).href
const GANIMEDES = new URL('../../scene/assets/ganimedes-voyager.webp', import.meta.url).href
const VENUS = new URL('../../scene/assets/venus-magellan.webp', import.meta.url).href
const MARTE = new URL('../../scene/assets/marte-viking.webp', import.meta.url).href
const EUROPA = new URL('../../scene/assets/europa-voyager.webp', import.meta.url).href
const FOBOS = new URL('../../scene/assets/fobos-viking.webp', import.meta.url).href
const JPL = 'Imagen: NASA/JPL-Caltech/USGS (Solar System Simulator de JPL). Solo su luminancia, recoloreada.'
const JPL_COLOR = 'Imagen: NASA/JPL-Caltech/USGS (Solar System Simulator de JPL).'

export const BETA_INFO: Readonly<Record<string, ObjectInfo>> = {
  cobalto: {
    title: 'Gigante azul',
    summary:
      'Cobalto es un gigante gaseoso azul, lejos detrás de la entrada. Su atmósfera usa el mapa de Neptuno ' +
      'armado con imágenes de la Voyager 2, la única sonda que lo ha visitado (1989).',
    facts: [
      'El azul de Neptuno se debe al metano de su atmósfera, que absorbe la luz roja.',
      'En Neptuno soplan los vientos más rápidos del sistema solar: más de 2 000 km/h.',
    ],
    images: [{ src: NEPTUNO, caption: 'Neptuno · Voyager 2 (NASA/JPL)' }],
    credit: JPL_COLOR,
  },
  nacar: {
    title: 'Luna de hielo brillante',
    summary: 'Nácar es una luna de hielo casi blanco, abajo a la derecha. Su superficie usa el mapa de Encélado, la luna de Saturno que más luz refleja.',
    facts: ['Encélado lanza chorros de agua desde grietas de su polo sur; ese hielo alimenta el anillo E de Saturno.'],
    images: [{ src: ENCELADO, caption: 'Encélado · Voyager (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  jano: {
    title: 'Mundo de dos caras',
    summary: 'Jano tiene una mitad oscura y otra clara. Su superficie usa el mapa de Japeto, la luna de Saturno con ese contraste.',
    facts: [
      'En Japeto, la cara que mira hacia delante en su órbita está cubierta de material oscuro.',
      'Su nombre recuerda a Jano, el dios romano de dos caras.',
    ],
    images: [{ src: JAPETO, caption: 'Japeto · Voyager (NASA/JPL/USGS)' }],
    credit: JPL_COLOR,
  },
  onix: {
    title: 'Mundo antiguo y oscuro',
    summary: 'Ónix es un mundo oscuro salpicado de cráteres claros. Su superficie usa el mapa de Calisto, la segunda luna más grande de Júpiter.',
    facts: ['Calisto es de los cuerpos con más cráteres del sistema solar: su superficie casi no ha cambiado en miles de millones de años.'],
    images: [{ src: CALISTO, caption: 'Calisto · Voyager (NASA/JPL/USGS)' }],
    credit: JPL_COLOR,
  },
  grieta: {
    title: 'Mundo del gran cañón',
    summary: 'Grieta es un mundo de hielo cruzado por un cañón enorme. Su superficie usa el mapa de Tetis, luna de Saturno, teñido de azul.',
    facts: ['El gran cañón de Tetis, Ithaca Chasma, recorre unos 2 000 km: casi tres cuartas partes de su contorno.'],
    images: [{ src: TETIS, caption: 'Tetis · Voyager (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  vigia: {
    title: 'Luna del gran cráter',
    summary: 'Vigía es una luna pequeña, casi en la vertical de la entrada, con un cráter gigante que parece un ojo. Su superficie usa el mapa de Mimas, luna de Saturno.',
    facts: ['El cráter Herschel de Mimas mide unos 130 km: casi un tercio del diámetro de la luna.'],
    images: [{ src: MIMAS, caption: 'Mimas · Voyager (NASA/JPL/USGS)' }],
    credit: JPL_COLOR,
  },
  pangea: {
    title: 'Mundo de continentes',
    summary: 'Pangea tiene continentes y océanos. Su superficie usa el mapa de relieve de la Tierra, teñido de cian y violeta.',
    facts: [
      'En el mapa original, el color marca la altura: verdes en las llanuras, marrones y blancos en las montañas.',
      'Pangea es el nombre del supercontinente que reunía casi toda la tierra firme hace unos 300 millones de años.',
    ],
    images: [{ src: TIERRA, caption: 'Tierra · relieve en color (NASA/JPL)' }],
    credit: JPL,
  },
  escarcha: {
    title: 'Mundo de escarcha',
    summary:
      'Escarcha flota muy por encima de la entrada del sector. Su superficie parte del mapa ' +
      'de Europa, la luna helada de Júpiter, usado solo por su luminancia y teñido de lila.',
    facts: ['Las líneas oscuras de la Europa real son grietas en su corteza de hielo, sobre un océano de agua líquida.'],
    images: [{ src: EUROPA, caption: 'Europa · Voyager (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  hollin: {
    title: 'Pequeña luna de hollín',
    summary:
      'Hollín es una esfera pequeña justo debajo de la entrada. Usa el mapa de Fobos, la luna mayor de Marte, ' +
      'en grises muy oscuros.',
    facts: ['Fobos es uno de los cuerpos más oscuros del sistema solar: refleja muy poca luz.'],
    images: [{ src: FOBOS, caption: 'Fobos · Viking (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  argento: {
    title: 'Planeta con anillo plateado',
    summary:
      'Argento está alto, detrás y a la derecha. Sus bandas y su anillo parten de las texturas ' +
      'de Saturno, solo por su luminancia, en grises plateados.',
    facts: ['Los anillos de Saturno son sobre todo hielo de agua: por eso son tan brillantes.'],
    images: [{ src: SATURNO, caption: 'Mapa de Saturno (solo su luminancia)' }],
    credit: 'Imagen: Solar System Scope, CC BY 4.0.',
  },
  abisal: {
    title: 'Planeta abisal',
    summary:
      'Abisal está muy abajo, a la izquierda. Su superficie es el mapa de todo el cielo de ' +
      'SPHEREx, usado solo por su luminancia y teñido de azules profundos.',
    facts: ['La franja más clara corresponde al plano de la Vía Láctea en el mapa original.'],
    images: [{ src: CIELO_ORIGINAL, caption: 'SPHEREx · mapa de todo el cielo (PIA26600)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx). Solo su luminancia, recoloreada.',
  },
  brasa: {
    title: 'Mundo volcánico',
    summary:
      'Brasa está abajo, hacia el borde del sector. Su superficie usa el mapa de Ío, la luna ' +
      'de Júpiter con más volcanes del sistema solar, recoloreado en rojos de brasa.',
    facts: [
      'En el Ío real, los colores amarillos y rojos son compuestos de azufre que expulsan sus volcanes.',
      'Su brillo propio imita roca caliente.',
    ],
    images: [{ src: IO, caption: 'Ío · Voyager y Galileo (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  jade: {
    title: 'Mundo de hielo surcado',
    summary:
      'Jade es un mundo de hielo. Su superficie parte del mapa de Ganímedes, la luna más grande del sistema solar, ' +
      'con sus franjas claras de hielo surcado, en verdes jade.',
    facts: ['En Ganímedes real, las zonas oscuras son más antiguas y las claras, hielo más joven con surcos.'],
    images: [{ src: GANIMEDES, caption: 'Ganímedes · Voyager (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  ceniza: {
    title: 'Planeta de ceniza',
    summary:
      'Ceniza es un mundo rocoso. Su superficie es el relieve de Venus que midió por radar la sonda Magellan ' +
      '(a través de sus nubes), en grises de ceniza.',
    facts: ['Venus está cubierto de nubes: su superficie solo se pudo cartografiar con radar.'],
    images: [{ src: VENUS, caption: 'Venus · radar de Magellan (NASA/JPL)' }],
    credit: JPL,
  },
  marea: {
    title: 'Planeta turquesa',
    summary:
      'Marea es un mundo turquesa. Su superficie usa el mapa de Marte de las sondas Viking, solo por su luminancia, ' +
      'en turquesas.',
    facts: ['Las manchas oscuras del Marte real son roca basáltica; las claras, polvo.'],
    images: [{ src: MARTE, caption: 'Marte · Viking (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  ilmara: {
    title: 'Mundo frío inspirado en WISE 0855',
    summary:
      'Ilmara se inspira en WISE 0855−0714: una enana marrón muy fría a unos 7,4 años luz del Sol, ' +
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
      'Veshta es un planeta rocoso. Su superficie usa el mapa de color y relieve de la Luna obtenido por la sonda ' +
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
      'Orun es un planeta con anillo. Su superficie y su anillo parten de mapas de Saturno, teñidos hacia su paleta. ' +
      'El anillo proyecta su sombra sobre el planeta y el planeta sobre el anillo.',
    facts: [
      'Los anillos planetarios son innumerables partículas de hielo y roca: aquí la nave puede cruzarlos.',
      'La inclinación del anillo se midió en el boceto (unos 11°).',
    ],
    images: [{ src: SATURNO, caption: 'Mapa de Saturno (base de la textura)' }],
    credit: 'Imagen: Solar System Scope, CC BY 4.0.',
  },
  cielo: {
    title: 'Planeta con el cielo de SPHEREx',
    summary:
      'En Cielo infrarrojo, la superficie es el primer mapa de todo el cielo que hizo ' +
      'SPHEREx, envuelto sobre la esfera. La franja brillante del ecuador es el plano de la Vía Láctea.',
    facts: [
      'El mapa original está en proyección de Mollweide (una elipse); aquí se reproyectó para cubrir la esfera.',
      'Los colores son longitudes de onda infrarrojas: el naranja, polvo; el azul y blanco, gas caliente y estrellas.',
      'Ocupa el lugar del boceto donde antes había una estación.',
    ],
    images: [{ src: CIELO_ORIGINAL, caption: 'SPHEREx · mapa de todo el cielo (PIA26600)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx).',
  },
  vela: {
    title: 'Planeta con la nube de Vela',
    summary:
      'La superficie de Vela sale de la imagen de SPHEREx de la región molecular de Vela, ' +
      'una zona de nubes de gas y polvo donde nacen estrellas. Se quitaron las estrellas y se suavizó en franjas.',
    facts: [
      'La mancha naranja es la nebulosa brillante de la imagen; las franjas oscuras, el polvo que tapa la luz.',
      'La región molecular de Vela está a unos 2000–3000 años luz, en el plano de la Vía Láctea.',
    ],
    images: [{ src: VELA_ORIGINAL, caption: 'SPHEREx · región molecular de Vela (PIA26354)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx).',
  },
  burbuja: {
    title: 'Planeta con las burbujas del cielo',
    summary:
      'La superficie de Burbuja es un recorte del mapa de todo el cielo de SPHEREx donde ' +
      'se ven burbujas azules de gas caliente sobre nubes de polvo naranja.',
    facts: [
      'Las burbujas de gas suelen ser restos de estrellas que explotaron o regiones vaciadas por vientos de estrellas jóvenes.',
      'El recorte se envolvió sobre la esfera fundiendo sus bordes para que no haya costura.',
    ],
    images: [{ src: CIELO_ORIGINAL, caption: 'SPHEREx · mapa de todo el cielo (PIA26600)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx).',
  },
  franjas: {
    title: 'Gigante con el plano galáctico',
    summary:
      'Las franjas de Plano galáctico siguen el perfil de brillo de la Vía Láctea en el mapa ' +
      'de SPHEREx, de la franja central muy brillante al polvo de los lados, recoloreadas en violetas.',
    facts: [
      'En el mapa, el plano de la galaxia es la franja brillante del centro: ahí se concentran estrellas, gas y polvo.',
      'Los colores originales del mapa son infrarrojos; aquí solo se usa su brillo.',
    ],
    images: [{ src: CIELO_ORIGINAL, caption: 'SPHEREx · mapa de todo el cielo (PIA26600)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx).',
  },
  polvo: {
    title: 'Mundo rocoso del polvo de Vela',
    summary:
      'Las manchas de Polvo de Vela claras y oscuras salen del brillo de la imagen de SPHEREx ' +
      'de la región molecular de Vela, en grises azulados, con el relieve de la Luna encima.',
    facts: ['Las zonas oscuras de la imagen original son nubes de polvo que tapan la luz de las estrellas de detrás.'],
    images: [{ src: VELA_ORIGINAL, caption: 'SPHEREx · región molecular de Vela (PIA26354)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx).',
  },
  lazos: {
    title: 'Planeta con los lazos del centro galáctico',
    summary:
      'La superficie de Lazos galácticos es la zona del mapa de SPHEREx que queda sobre el ' +
      'centro de la Vía Láctea, con dos lazos blancos sobre nubes de polvo naranja.',
    facts: [
      'En el mapa infrarrojo, el naranja es polvo templado y el blanco, zonas donde brillan a la vez gas y polvo.',
      'El recorte se envolvió sobre la esfera fundiendo sus bordes.',
    ],
    images: [{ src: CIELO_ORIGINAL, caption: 'SPHEREx · mapa de todo el cielo (PIA26600)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx).',
  },
  nebulosa: {
    title: 'Mundo con la nebulosa de Vela',
    summary:
      'La superficie de Nebulosa de Vela es la nebulosa naranja de la imagen de SPHEREx de ' +
      'la región molecular de Vela, sin las estrellas. Las tormentas y el brillo propio son una ilustración.',
    facts: [
      'En nebulosas como esta, el gas y el polvo brillan iluminados por estrellas jóvenes que nacen dentro.',
      'SPHEREx observa en infrarrojo, que atraviesa mejor el polvo que la luz visible.',
    ],
    images: [{ src: VELA_ORIGINAL, caption: 'SPHEREx · región molecular de Vela (PIA26354)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx).',
  },
  filamentos: {
    title: 'Planeta de filamentos de polvo',
    summary:
      'La superficie de Filamentos es una zona del cielo del sur en el mapa de SPHEREx, ' +
      'llena de filamentos de polvo rojizo y estrellas.',
    facts: [
      'Lejos del plano de la galaxia también hay polvo: forma nubes tenues y alargadas que el infrarrojo deja ver.',
      'Los puntos claros de su superficie son estrellas reales del mapa.',
    ],
    images: [{ src: CIELO_ORIGINAL, caption: 'SPHEREx · mapa de todo el cielo (PIA26600)' }],
    credit: 'Imagen: NASA/JPL-Caltech (SPHEREx).',
  },
  tessa: {
    title: 'Planeta rocoso rojizo',
    summary:
      'Tessa queda detrás de la entrada del sector. Su superficie usa ' +
      'el mapa de color y relieve de la Luna (LRO, NASA) recoloreado en tonos terracota.',
    facts: [
      'En la Luna real, las zonas claras son tierras altas antiguas y las oscuras, mares de basalto.',
      'Gira lentamente; la luz llega de la estrella clave del sector.',
    ],
    images: [{ src: LUNA, caption: 'Mapa de color de la Luna (LRO)' }],
    credit: 'Imagen: NASA Scientific Visualization Studio, dominio público.',
  },
  calder: {
    title: 'Gigante de hielo',
    summary:
      'Calder es un gigante de hielo, a la manera de Urano y Neptuno: gigantes de hielo cuyo metano absorbe la luz ' +
      'roja y los tiñe de azul verdoso. Su textura parte del mapa de Saturno, usado solo por su luminancia.',
    facts: [
      'Los gigantes de hielo tienen más agua, amoniaco y metano que los gigantes gaseosos como Júpiter o Saturno.',
      'Su luna helada, Sora, orbita cerca.',
    ],
    images: [{ src: SATURNO, caption: 'Mapa de Saturno (solo su luminancia)' }],
    credit: 'Imagen: Solar System Scope, CC BY 4.0.',
  },
  sora: {
    title: 'Luna helada',
    summary: 'Sora es la luna helada que acompaña a Calder. Usa el mapa lunar de la NASA en tonos fríos y claros.',
    facts: ['Las lunas heladas reflejan mucha luz: por eso se ve más brillante que las rocas del sector.'],
    images: [{ src: LUNA, caption: 'Mapa de color de la Luna (LRO)' }],
    credit: 'Imagen: NASA Scientific Visualization Studio, dominio público.',
  },
  esfera: {
    title: 'Esfera menor',
    summary: 'Pequeña esfera rocosa cerca de la entrada del sector. Usa el mismo mapa lunar de la NASA que Veshta, con otra paleta.',
    facts: ['Es el objeto con nombre más cercano a la entrada del sector.'],
    images: [{ src: LUNA, caption: 'Mapa de color de la Luna (LRO)' }],
    credit: 'Imagen: NASA Scientific Visualization Studio, dominio público.',
  },
}
