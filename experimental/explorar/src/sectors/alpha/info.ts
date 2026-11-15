import type { ObjectInfo } from '../../engine/types'
// «?no-inline»: Vite los incrustaría en base64 en el chunk principal.
import WISE_MAYO from '../beta/referencias/wise0855-2025-05-06.png?no-inline'
import MARTE from './referencias/marte-viking-original.webp?no-inline'
import IO from './referencias/io-galileo-original.webp?no-inline'
import EUROPA from './referencias/europa-voyager-original.webp?no-inline'
import GANIMEDES from './referencias/ganimedes-voyager-original.webp?no-inline'
import VENUS from './referencias/venus-magellan-original.webp?no-inline'
import FOBOS from './referencias/fobos-viking-original.webp?no-inline'

/**
 * Fichas de α para el HUD. Los planetas son ilustrativos: su posición sale de una fuente real de
 * los recortes de SPHEREx de WISE 0855 (o, los de fuera del recorte, es libre) y su superficie es
 * un mapa global real de NASA/JPL de otro cuerpo del sistema solar, usado como textura.
 */
const JPL = 'Mapa: NASA/JPL-Caltech/USGS (Solar System Simulator de JPL).'

export const ALPHA_INFO: Readonly<Record<string, ObjectInfo>> = {
  f01: {
    title: 'Desierto oxidado sobre la fuente f01',
    summary:
      'Óxido es un planeta ilustrativo. Su posición es la de la fuente más brillante de los recortes reales de ' +
      'SPHEREx alrededor de WISE 0855; su superficie es el mapa global en color de Marte hecho con las sondas Viking.',
    facts: [
      'El color rojizo de Marte viene del óxido de hierro del polvo que cubre su superficie.',
      'Las manchas oscuras del mapa son llanuras de roca volcánica; arriba y abajo se ven los casquetes polares.',
      'Abajo, a la derecha, el recorte real de SPHEREx donde está la fuente f01.',
    ],
    images: [
      { src: MARTE, caption: 'Marte · Viking (NASA/JPL/USGS)' },
      { src: WISE_MAYO, caption: 'SPHEREx · WISE 0855, 6 may 2025', pixelated: true },
    ],
    credit: `${JPL} Recorte: NASA/JPL-Caltech, SPHEREx (NASA/IPAC IRSA).`,
  },
  f02: {
    title: 'Mundo de hielo rayado con anillo',
    summary:
      'Hielo rayado es un planeta ilustrativo sobre la fuente f02. Su superficie es el mapa de Europa, luna de ' +
      'Júpiter, hecho con imágenes de las Voyager y recoloreado en azules; el anillo es ilustración.',
    facts: [
      'Las líneas oscuras de Europa son grietas en una corteza de hielo que flota sobre un océano de agua salada.',
      'Europa es uno de los lugares del sistema solar donde se busca un ambiente que pudiera albergar vida.',
    ],
    images: [{ src: EUROPA, caption: 'Europa · Voyager (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  f03: {
    title: 'Luna de azufre',
    summary:
      'Azufre es una luna ilustrativa sobre la fuente f03. Su superficie es el mapa de Ío, la luna de Júpiter con ' +
      'más volcanes activos, con imágenes de las Voyager y el color de la sonda Galileo.',
    facts: [
      'Los amarillos, naranjas y blancos de Ío son azufre y dióxido de azufre expulsados por sus volcanes.',
      'La mancha roja con forma de anillo es el depósito alrededor del volcán Pele.',
    ],
    images: [{ src: IO, caption: 'Ío · Voyager y Galileo (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  f04: {
    title: 'Luna de surcos',
    summary:
      'Surcos es una luna ilustrativa sobre la fuente f04. Su superficie es el mapa de Ganímedes, la luna más grande ' +
      'del sistema solar, con imágenes de las Voyager, en tonos grises cálidos.',
    facts: ['Ganímedes alterna terrenos oscuros y antiguos con franjas claras llenas de surcos paralelos.'],
    images: [{ src: GANIMEDES, caption: 'Ganímedes · Voyager (NASA/JPL/USGS)' }],
    credit: JPL,
  },
  radar: {
    title: 'Mundo visto por radar',
    summary:
      'Radar es un planeta ilustrativo, fuera del recorte. Su superficie es el mapa de Venus que hizo la sonda ' +
      'Magellan con radar, porque las nubes de Venus no dejan ver el suelo con luz visible.',
    facts: [
      'Los tonos del mapa no son colores reales: representan cómo rebota el radar en el terreno.',
      'Las zonas brillantes son terreno rugoso y montañoso; las oscuras, llanuras lisas de lava.',
    ],
    images: [{ src: VENUS, caption: 'Venus · radar de Magellan (NASA/JPL)' }],
    credit: JPL,
  },
  crater: {
    title: 'Luna con un gran cráter',
    summary:
      'Cráter es una luna ilustrativa que acompaña a Radar. Su superficie es el mapa de Fobos, luna de Marte, hecho ' +
      'con imágenes de las sondas Viking.',
    facts: ['El gran cráter del mapa es Stickney, de unos 9 km: casi la mitad del tamaño de Fobos.'],
    images: [{ src: FOBOS, caption: 'Fobos · Viking (NASA/JPL/USGS)' }],
    credit: JPL,
  },
}
