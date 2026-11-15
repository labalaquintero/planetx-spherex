const nasaVela = 'https://www.jpl.nasa.gov/images/pia26354-spherex-vela-molecular-ridge/';
const nasaSky = 'https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/';
const prepared = {
  query: { ra_deg: 133.795129166667, dec_deg: -7.245147222222, fov_deg: 0.1, frame: 'ICRS' },
  band: { center_um: 0.9928165220816996, tolerance_um: 0.012909112710767471 },
  checked_at: '2026-11-15T00:02:13Z',
  science_version: 'v1',
  mode: 'prepared',
  mask: 80.20,
  frames: [
    {
      id: 'c80d7aae12e197e3f2678239871ca47d198813c567550ff12549b7cc6feddb9c',
      observation_id: '2025W19_1B_0241_1',
      observed_at: '2025-05-06T12:20:24.888Z',
      release: 'dr1',
      source_url: 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W19_1B/l2b-v27-2026-197/1/level2_2025W19_1B_0241_1D1_spx_l2b-v27-2026-197.fits',
      quality_flags: ['masked_pixels'],
      src: '/observatorio/wise-0855-a.webp',
    },
    {
      id: 'ec0f084def6975d7ddaac0af157ec0f0df5dbf01f46e183461939d8af33c4033',
      observation_id: '2025W44_2B_0322_1',
      observed_at: '2025-10-31T18:55:38.358Z',
      release: 'dr1',
      source_url: 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W44_2B/l2b-v27-2026-246/1/level2_2025W44_2B_0322_1D1_spx_l2b-v27-2026-246.fits',
      quality_flags: ['masked_pixels'],
      src: '/observatorio/wise-0855-b.webp',
    },
  ],
};

const daysBetween = (new Date(prepared.frames[1].observed_at) - new Date(prepared.frames[0].observed_at)) / 86400000;
const sampleArea = { type: 'crop', points: [[.43, .50], [.87, .94]] };
const featuredObservation = {
  id: 'wise-0855-dos-epocas',
  title: `El mismo campo, ${Math.floor(daysBetween)} días después`,
  topic: 'WISE 0855',
  category: 'Caso de muestra',
  summary: 'Compara dos épocas del campo de WISE 0855, amplía la zona marcada y consulta las fuentes de cada imagen.',
  status: 'published',
  comparison: prepared,
  annotations: Object.fromEntries(prepared.frames.map(({ id }) => [id, [sampleArea]])),
  sections: [
    ['Ubica la misma zona', 'El recuadro delimita la misma región en las dos épocas. Fíjate en el punto brillante cerca de la esquina superior izquierda de ambos acercamientos. Puedes usarlo como referencia al mover el divisor.'],
    ['Comprueba qué se puede comparar', 'El par se proyectó en la misma cuadrícula de 64 × 64 píxeles y con una escala común de contraste. La trama identifica los píxeles excluidos de la comparación. Cerca del 80 % del campo tiene datos válidos en ambas épocas.'],
    ['Documenta lo que observas', 'En el visor puedes alternar las épocas, abrir la imagen de diferencia y preparar tu propia ficha. Describe qué zona miraste y conserva las fechas UTC, la banda y los enlaces a los FITS. El ruido y las diferencias de fondo también pueden producir cambios aparentes.'],
  ],
};

const targets = [
  {
    id: 'wise-0855', name: 'WISE 0855', type: 'Enana marrón',
    ra: prepared.query.ra_deg, dec: prepared.query.dec_deg,
    description: 'El caso preparado compara dos observaciones del campo de WISE 0855 tomadas en la misma banda de SPHEREx.',
  },
  {
    id: 'barnard', name: 'Estrella de Barnard', type: 'Estrella de movimiento propio',
    ra: 269.452077, dec: 4.693365,
    description: 'Objetivo del reto para explorar movimiento propio. La posición de referencia es J2000. Para una comparación científica hay que ajustarla a la época de observación.',
  },
  {
    id: 'epsilon-indi-b', name: 'Epsilon Indi B', type: 'Sistema de enanas marrones',
    ra: 331.044147, dec: -56.782844,
    description: 'La búsqueda se centra en el componente B. Distinguir las dos fuentes requiere comprobar la resolución de las observaciones.',
  },
  {
    id: 'rw-aurigae', name: 'RW Aurigae', type: 'Estrella variable',
    ra: 76.956526, dec: 30.401438,
    description: 'Campo de una estrella joven variable. Las diferencias de brillo requieren una comprobación con exposiciones comparables y medidas independientes.',
  },
  {
    id: 'r-draconis', name: 'R Draconis', type: 'Estrella variable Mira',
    ra: 248.167611, dec: 66.754979,
    description: 'Estrella variable del reto. El archivo contiene varias épocas candidatas. Hace falta procesar los recortes para saber cuáles se pueden comparar.',
  },
];

const articles = [
  featuredObservation,
  {
    id: 'leer-epocas',
    category: 'Interpretación',
    title: 'Cómo leer un cambio entre épocas',
    summary: 'Qué observar cuando alternas dos imágenes de la misma región.',
    sections: [
      ['Empieza por las fuentes del campo', 'Abre WISE 0855 y mira varias estrellas que se distingan en los dos fotogramas. Alterna entre A y B. Las dos imágenes usan la misma cuadrícula, orientación y escala de contraste.'],
      ['Comprueba las condiciones de comparación', 'Lee las fechas de exposición, la banda y los avisos de calidad en Procedencia. Las regiones cuadriculadas representan píxeles enmascarados.'],
      ['Registra lo que ves', 'Describe la parte de la imagen que llamó tu atención e incluye las dos fechas y sus fuentes. Un cambio visible no prueba un hallazgo. El ruido, la resolución y las condiciones de observación pueden afectar lo que ves.'],
    ],
  },
  {
    id: 'coordenadas',
    category: 'Primeros pasos',
    title: 'Encuentra una región con RA y Dec',
    summary: 'Cómo introducir las coordenadas celestes y repetir una consulta.',
    sections: [
      ['Dos números identifican un centro', 'La ascensión recta (RA) va de 0° inclusive a 360° exclusive. La declinación (Dec) va de −90° a +90°. El visor recibe grados decimales ICRS y usa punto decimal.'],
      ['De horas a grados', 'Si la ascensión recta se expresa en horas, minutos y segundos, usa 15 × (horas + minutos/60 + segundos/3600). Para Dec, convierte las unidades angulares a grados y conserva el signo del conjunto.'],
      ['Repite la consulta', 'El botón WISE 0855 usa las coordenadas exactas del respaldo. Puedes copiarlas de Procedencia para volver a abrir el mismo campo.'],
    ],
  },
  {
    id: 'procedencia',
    category: 'Datos de archivo',
    title: 'Del recorte FITS a la imagen del visor',
    summary: 'Dónde encontrar el archivo original, el instante de exposición y la banda.',
    sections: [
      ['La fecha pertenece a la exposición', 'En el par preparado, observed_at procede de DATE-OBS en los FITS originales. La fecha de preparación registra cuándo se comprobó y guardó el par. Todas las fechas del visor se muestran en UTC.'],
      ['Dos recortes en una cuadrícula común', 'Los recortes FITS se alinearon con WCS y se proyectaron a 64 × 64 píxeles. Se usó una banda comparable y el mismo contraste. El PNG es un producto de visualización.'],
      ['Sigue la fuente', 'El enlace FITS de IRSA lleva al producto original de cada exposición. El ID de fotograma identifica el PNG derivado y el ID de observación identifica la exposición en el archivo.'],
    ],
  },
];

const reportStatuses = {
  draft: { title: 'Borrador', color: 'neutral' },
  review: { title: 'En revisión', color: 'info' },
  accepted: { title: 'Aceptado', color: 'success' },
  rejected: { title: 'Rechazado', color: 'danger' },
  published: { title: 'Publicado', color: 'success' },
};

const archiveNote = 'Un cambio visible no prueba un hallazgo.';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (match) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[match]);
const fold = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const epoch = (index) => String.fromCharCode(65 + index);
const dateFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
});
const hourFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const validDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const imageId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const shortDate = (date) => validDate(date)
  ? dateFormat.format(new Date(date)).replace(/\./g, '') : 'Fecha no disponible';
const fullDate = (date) => validDate(date)
  ? `${shortDate(date)} · ${hourFormat.format(new Date(date))} UTC` : 'Fecha no disponible';
const dateMark = (date, full = false) => `<time datetime="${escapeHtml(date)}" title="${escapeHtml(date)}">${full ? fullDate(date) : shortDate(date)}</time>`;
const bandFormat = new Intl.NumberFormat('es-MX', { maximumSignificantDigits: 4 });
const formatBand = (band) => band
  ? `${bandFormat.format(band.center_um)} ± ${bandFormat.format(band.tolerance_um)} µm` : 'No disponible';

const validCoordinates = (ra, dec) => Number.isFinite(ra) && ra >= 0 && ra < 360
  && Number.isFinite(dec) && dec >= -90 && dec <= 90;
const fieldLabel = (query) => `${query.fov_deg.toFixed(2)}° × ${query.fov_deg.toFixed(2)}°`;
const matchingTarget = (query) => targets.find(({ ra, dec }) => ra === query.ra_deg && dec === query.dec_deg);
const fieldName = (query) => matchingTarget(query) ? `Campo de ${matchingTarget(query).name}` : 'Campo consultado';
const comparisonMode = (data) => data.mode === 'prepared' ? 'Caso preparado' : 'Consulta en vivo';

function coordinateParams(query) {
  return new URLSearchParams({ ra: String(query.ra_deg), dec: String(query.dec_deg) });
}

function coordinatesFromParams(params) {
  if (!params.has('ra') || !params.has('dec') || !params.get('ra').trim() || !params.get('dec').trim()) return null;
  const ra = Number(params.get('ra'));
  const dec = Number(params.get('dec'));
  return validCoordinates(ra, dec) ? { ra, dec } : null;
}

function comparisonLink(data) {
  const target = matchingTarget(data.query);
  return target?.id === 'wise-0855' ? '#visor/wise-0855' : `#visor?${coordinateParams(data.query)}`;
}

function imageLink(index, data, reportId, from) {
  const params = coordinateParams(data.query);
  if (reportId) params.set('ficha', reportId);
  if (from) params.set('desde', from);
  return `#imagen/${index}?${params}`;
}

function archiveURL(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeDifference({ difference, frames, band, mode, status }) {
  if (!difference || mode !== 'prepared' || status !== 'ready' || !band || frames.length !== 2) return;
  const { id, image_url, frame_ids, scale_mjy_sr, common_valid_fraction } = difference;
  if (typeof id !== 'string' || !imageId.test(id) || image_url !== `/api/v1/images/${id}`
      || !Array.isArray(frame_ids) || frame_ids.length !== 2
      || !frames.every((frame, index) => frame && frame.id === frame_ids[index] && frame.id !== id)
      || !Number.isFinite(scale_mjy_sr) || scale_mjy_sr < 0
      || !Number.isFinite(common_valid_fraction) || common_valid_fraction < 0.5 || common_valid_fraction > 1) return;
  return { id, image_url, frame_ids, scale_mjy_sr, common_valid_fraction };
}

function normalizeComparison(data) {
  const { query, band, frames, mode, status, checked_at, science_version } = data ?? {};
  if (!query || !validCoordinates(query.ra_deg, query.dec_deg) || !Number.isFinite(query.fov_deg) || query.fov_deg <= 0
      || !['prepared', 'live'].includes(mode) || !validDate(checked_at) || typeof science_version !== 'string'
      || !Array.isArray(frames) || !['ready', 'insufficient', 'no_coverage'].includes(status)
      || (status === 'ready' ? frames.length < 2 || frames.length > 6 : frames.length > (status === 'insufficient' ? 1 : 0))
      || (band && (![band.center_um, band.tolerance_um].every(Number.isFinite) || band.center_um <= 0 || band.tolerance_um <= 0))) {
    throw new Error('La API devolvió una comparación que el visor no puede leer.');
  }
  return {
    query: { ra_deg: query.ra_deg, dec_deg: query.dec_deg, fov_deg: query.fov_deg, frame: 'ICRS' },
    band: band ? { center_um: band.center_um, tolerance_um: band.tolerance_um } : null,
    checked_at, science_version, mode, status,
    reason: typeof data.reason === 'string' ? data.reason : null,
    warnings: Array.isArray(data.warnings) ? data.warnings.filter((item) => typeof item === 'string') : [],
    difference: normalizeDifference(data),
    frames: frames.map((frame) => {
      if (!frame || typeof frame.id !== 'string' || !imageId.test(frame.id)
          || frame.image_url !== `/api/v1/images/${frame.id}` || !validDate(frame.observed_at)
          || !['dr1', 'qr3'].includes(frame.release)) {
        throw new Error('La API devolvió datos incompletos de una exposición.');
      }
      return {
        id: frame.id, observed_at: frame.observed_at, release: frame.release,
        observation_id: String(frame.observation_id ?? ''),
        source_url: archiveURL(frame.source_url), image_url: frame.image_url, src: frame.image_url,
        quality_flags: Array.isArray(frame.quality_flags) ? frame.quality_flags.filter((item) => typeof item === 'string') : [],
      };
    }),
  };
}

export {
  nasaVela, nasaSky, prepared, targets, articles, featuredObservation, reportStatuses, archiveNote,
  escapeHtml, fold, epoch, daysBetween, validDate, shortDate, fullDate, dateMark,
  formatBand, fieldLabel, fieldName, comparisonMode, coordinateParams,
  coordinatesFromParams, comparisonLink, imageLink, normalizeComparison, validCoordinates,
};
