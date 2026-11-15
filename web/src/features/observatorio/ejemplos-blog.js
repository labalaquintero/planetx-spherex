import { featuredObservation, normalizeComparison, prepared } from './datos.js';

// Par del catálogo preparado documentado en caso-preparado-r-draconis.md.
const draconisFrames = [
  {
    id: '45db9f88c84d0a20892a19c7ac6db35551221531ee987ba41e54e95b9add2397',
    observed_at: '2025-05-16T22:56:23.637Z',
    observation_id: '2025W20_2D_0243_1',
    source_url: 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W20_2D/l2b-v27-2026-198/3/level2_2025W20_2D_0243_1D3_spx_l2b-v27-2026-198.fits',
  },
  {
    id: 'a319f36913099bbf50aab7d4374853304bf43dec4496aa8aff26a4301b4b9564',
    observed_at: '2026-05-06T06:04:36.596Z',
    observation_id: '2026W19_1A_0842_1',
    source_url: 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2026W19_1A/l2b-v27-2026-245/3/level2_2026W19_1A_0842_1D3_spx_l2b-v27-2026-245.fits',
  },
].map((frame) => ({
  ...frame, release: 'dr1', quality_flags: ['masked_pixels'], image_url: `/api/v1/images/${frame.id}`,
}));
const differenceId = '8703bc72380d9005de629a7e6ab96ead8734d3867aac71fdf02171b9edcbfc86';
const draconis = normalizeComparison({
  query: { ra_deg: 248.167611, dec_deg: 66.754979, fov_deg: .1 },
  band: { center_um: 1.655301716403466, tolerance_um: .01955767357280913 },
  checked_at: '2026-11-15T15:01:38Z',
  science_version: 'v1',
  mode: 'prepared',
  status: 'ready',
  frames: draconisFrames,
  difference: {
    id: differenceId, image_url: `/api/v1/images/${differenceId}`,
    frame_ids: draconisFrames.map(({ id }) => id),
    scale_mjy_sr: 4.121557618553713,
    common_valid_fraction: .927490234375,
  },
});

export const samplePublications = [
  {
    id: 'wise-0855-borde-cuadriculado',
    title: '¿Qué hay en el borde cuadriculado de WISE 0855?',
    author: 'Ana Horizonte',
    topic: 'WISE 0855',
    summary: 'Una anotación de campo sobre los píxeles enmascarados y cómo orientarse entre dos épocas.',
    example: true,
    status: 'published',
    comparison: prepared,
    annotations: Object.fromEntries(prepared.frames.map(({ id }) => [id, [{ type: 'crop', points: [[.03, .57], [.44, .98]] }]])),
    notes: [
      'Al mover el divisor entre las imágenes de mayo y octubre de 2025, me llamó la atención la trama cerca del borde inferior izquierdo. Marqué el mismo recuadro en ambas épocas y usé los dos puntos brillantes cercanos al borde como referencia para orientarme.',
      'La trama señala píxeles excluidos de la comparación. Dejé esa zona marcada para recordar dónde conviene detener la lectura y mirar solo las fuentes que sí tienen datos en las dos fechas.',
      'Guardé las fechas UTC y los FITS de ambas observaciones. Así puedo volver al mismo sitio del campo y otra persona puede revisar exactamente el recorte que miré.',
    ].join('\n\n'),
  },
  {
    id: 'r-draconis-contorno-en-la-resta',
    title: 'Un contorno en la diferencia de R Draconis',
    author: 'Leo Meridiano',
    topic: 'R Draconis',
    summary: 'Dos épocas, un núcleo enmascarado y una zona que vale la pena examinar en la imagen B − A.',
    example: true,
    status: 'published',
    comparison: draconis,
    annotations: Object.fromEntries(draconis.frames.map(({ id }) => [id, [{ type: 'crop', points: [[.27, .27], [.73, .73]] }]])),
    notes: [
      'Quería ver qué quedaba al restar las observaciones de 2025 y 2026 del campo de R Draconis. Marqué un recuadro alrededor de la fuente central. En los dos recortes, el centro aparece enmascarado y el halo todavía se distingue alrededor.',
      'En Ver diferencias me fijé en una franja azul alrededor de ese centro. La imagen B − A muestra diferencias de brillo superficial en los píxeles válidos. Usé el recuadro para volver a la misma zona en las dos imágenes originales.',
      'Dejé anotada la franja como una zona para revisar. Para medir cuánto cambió el brillo tendría que trabajar con los FITS y estimar el efecto de la máscara, el fondo y el ruido.',
    ].join('\n\n'),
  },
];

export function sampleObservationById(id) {
  return id === featuredObservation.id ? featuredObservation : samplePublications.find((report) => report.id === id);
}
