import {
  archiveNote, comparisonLink, comparisonMode, coordinateParams, coordinatesFromParams, dateMark,
  epoch, escapeHtml, featuredObservation, fieldLabel, fieldName, formatBand, fullDate, imageLink, normalizeComparison,
  prepared, shortDate, targets,
} from './datos.js';
import { frameMarks, paintMarks } from './anotaciones.js';
import { reportById, stageSharedMarks } from './colaboracion.js';
import { back, badge, dataRows, pageHeading, toast } from './ui.js';
import { bindEvidenceImages, cacheImages, isEditableReport, readWorkspace, rememberComparison, writeWorkspace } from './workspace.js';

const viewerExamples = {
  'wise-0855': { title: 'Comparación lista', kind: 'Datos reales', color: 'success', description: 'Dos exposiciones de WISE 0855 con fechas y enlaces a IRSA.' },
  'sin-consulta': { title: 'Antes de buscar', kind: 'Inicio', color: 'neutral', description: 'El visor guía la primera consulta y ofrece un ejemplo.' },
  cargando: { title: 'Cargando…', kind: 'Simulación', color: 'info', description: 'El visor indica que se está preparando el resultado.' },
  'sin-cobertura': { title: 'Sin cobertura', kind: 'Simulación', color: 'neutral', description: 'La búsqueda terminó sin observaciones para el campo consultado.' },
  insuficiente: { title: 'Cobertura insuficiente', kind: 'Simulación', color: 'warning', description: 'Una sola época utilizable. La imagen se muestra sin reproductor.' },
  'sin-imagenes': { title: 'Sin fotogramas comparables', kind: 'Simulación', color: 'warning', description: 'Hay exposiciones en el campo, pero no hay una imagen utilizable en la banda común.' },
  fallo: { title: 'Fallo temporal', kind: 'Simulación', color: 'danger', description: 'Ejemplo de un error recuperable con acción de reintento.' },
  'imagen-no-disponible': { title: 'Imagen no disponible', kind: 'Simulación', color: 'danger', description: 'El recorte seleccionado no se pudo cargar.' },
};

let viewer;
let playTimer = null;
let activeSearch;
let activeComparison;
let inspectorFocus;
const comparisonStorageKey = 'planet-x-last-comparison-v1';

try {
  const stored = sessionStorage.getItem(comparisonStorageKey);
  if (stored) activeComparison = normalizeComparison(JSON.parse(stored));
} catch {
  // A comparison can still be opened when storage is unavailable.
}

function sameCoordinates(data, ra, dec) {
  return data?.query.ra_deg === ra && data.query.dec_deg === dec;
}

/*
 * Casos preparados del catálogo del servidor (además de WISE 0855, que va en el código). La galería
 * los precarga en memoria al abrirse, solo para los objetivos marcados con `preparedCase`: así nunca
 * dispara una consulta en vivo a IRSA y no toca la comparación activa ni el historial.
 * Valor por clave: la comparación lista, 'fallo' o la promesa en curso.
 */
const preparedCache = new Map();
const preparedKey = (ra, dec) => `${ra},${dec}`;

function cachedPrepared(ra, dec) {
  const value = preparedCache.get(preparedKey(ra, dec));
  return value && typeof value === 'object' && !(value instanceof Promise) ? value : null;
}

/** 'listo', 'cargando', 'fallo' o undefined si aún no se pidió. */
function preparedState(target) {
  const value = preparedCache.get(preparedKey(target.ra, target.dec));
  if (value === undefined) return undefined;
  if (value === 'fallo') return 'fallo';
  return value instanceof Promise ? 'cargando' : 'listo';
}

function prefetchPrepared(target, compare) {
  const key = preparedKey(target.ra, target.dec);
  if (preparedCache.has(key)) return Promise.resolve(cachedPrepared(target.ra, target.dec));
  const request = Promise.resolve()
    .then(() => compare(target.ra, target.dec, AbortSignal.timeout(15000)))
    .then((payload) => {
      const data = normalizeComparison(payload);
      const ok = data.mode === 'prepared' && data.status === 'ready' && data.frames.length >= 2;
      preparedCache.set(key, ok ? data : 'fallo');
      return ok ? data : null;
    })
    .catch(() => {
      preparedCache.set(key, 'fallo');
      return null;
    });
  preparedCache.set(key, request);
  return request;
}

function savedComparison(ra, dec) {
  if (sameCoordinates(activeComparison, ra, dec)) return activeComparison;
  return readWorkspace().recent.find(({ comparison }) => sameCoordinates(comparison, ra, dec))?.comparison;
}

function reportFrom(params) {
  const id = params.get('ficha');
  return id === featuredObservation.id ? featuredObservation : reportById(id);
}

function comparisonFor(params = new URLSearchParams()) {
  const reportId = params.get('ficha');
  if (reportId) {
    const report = reportFrom(params);
    return report ? report.comparison ?? prepared : null;
  }
  const coordinates = coordinatesFromParams(params);
  if (!coordinates) return activeComparison ?? readWorkspace().recent.find((entry) => entry.comparison)?.comparison ?? prepared;
  const saved = savedComparison(coordinates.ra, coordinates.dec);
  if (saved) return saved;
  if (sameCoordinates(prepared, coordinates.ra, coordinates.dec)) return prepared;
  return cachedPrepared(coordinates.ra, coordinates.dec);
}

function storeComparison(data) {
  activeComparison = data;
  try {
    sessionStorage.setItem(comparisonStorageKey, JSON.stringify(data));
  } catch {
    // Route changes can reuse the in-memory result during this visit.
  }
  rememberComparison(data);
  void cacheImages(data.frames);
}

function comparisonState(data) {
  if (data.status === 'ready') return 'ready';
  if (data.status === 'no_coverage') return 'sin-cobertura';
  return data.frames.length ? 'insuficiente' : 'sin-imagenes';
}

function stopPlayback() {
  window.clearInterval(playTimer);
  playTimer = null;
}

function cancelSearch() {
  activeSearch?.abort();
  activeSearch = undefined;
}

function comparisonSlider(id, label, frames = prepared.frames, first = 0) {
  const labels = frames.map((_, offset) => epoch(first + offset));
  return `<div class="wipe">
    <div class="wipe-surface" data-first="${labels[0]}" data-second="${labels[1]}">
      ${frames.map((frame, index) => `<img class="wipe-image wipe-${epoch(index).toLowerCase()}"
        src="${escapeHtml(frame.src)}" data-frame-id="${escapeHtml(frame.id)}" width="64" height="64" alt="Época ${labels[index]}, ${shortDate(frame.observed_at)}">`).join('')}
      <span class="image-error" role="alert" hidden>Una imagen no está disponible.</span>
      <span class="wipe-divider" aria-hidden="true"></span>
      <span class="wipe-handle" aria-hidden="true">↔</span>
      <input class="wipe-input" id="${id}-wipe" type="range" min="0" max="100" step="1" value="50" aria-label="${label}">
    </div>
    <div class="wipe-dates">
      ${frames.map((frame, index) => `<span><b class="epoch-token">${labels[index]}</b> ${dateMark(frame.observed_at)}</span>`).join('')}
    </div>
  </div>`;
}

function bindComparisonSlider(wipe) {
  if (!wipe) return;
  const surface = wipe.querySelector('.wipe-surface');
  const input = wipe.querySelector('.wipe-input');
  function update() {
    const split = Number(input.value);
    surface.style.setProperty('--split', `${split}%`);
    input.setAttribute('aria-valuetext', `Época ${surface.dataset.first} ${split} %, época ${surface.dataset.second} ${100 - split} %`);
  }
  input.addEventListener('input', update);
  update();
}

function viewerView(id, params) {
  const target = targets.find((item) => item.id === id);
  const isExample = Object.hasOwn(viewerExamples, id) && viewerExamples[id].kind === 'Simulación';
  const query = coordinatesFromParams(params);
  const requested = query ?? target;
  const ra = requested?.ra ?? (id === 'fallo' ? prepared.query.ra_deg : isExample ? 10.25 : '');
  const dec = requested?.dec ?? (id === 'fallo' ? prepared.query.dec_deg : isExample ? -12.5 : '');
  // Los casos preparados (WISE 0855 y los marcados en datos.js) se consultan solos al abrirse.
  const autoSearch = !isExample && (id === 'wise-0855' || Boolean(target?.preparedCase) || !!query);
  const data = autoSearch ? savedComparison(ra, dec) : null;
  const status = isExample ? id : data ? comparisonState(data) : 'idle';
  if (data) activeComparison = data;
  viewer = { status, example: isExample, data, autoSearch: autoSearch && !data, index: 0,
    layout: data?.frames.length >= 2 ? 'side' : 'alternate' };

  return `<div class="row between viewer-title">
    ${pageHeading('Visor temporal', 'Elige una región del cielo y compara sus observaciones a través del tiempo.', '', true)}
    <a class="text-link" href="#articulo/leer-epocas">Cómo leer la comparación <span aria-hidden="true">↗</span></a>
  </div>
    <details class="panel coordinate-panel" ${status === 'ready' ? '' : 'open'}>
      <summary class="coordinate-summary">
        <span><strong>Buscar una región</strong> <span class="coordinate-reference">ICRS</span></span>
        <span class="coordinate-edit">
          <span class="coordinate-edit-collapsed">Editar coordenadas</span>
          <span class="coordinate-edit-expanded">Ocultar búsqueda</span>
          <span class="coordinate-chevron" aria-hidden="true">⌄</span>
        </span>
      </summary>
      <form class="coordinate-form" id="coordinates" novalidate aria-describedby="coordinate-errors">
        <div class="coord-field"><label for="ra">RA (grados)</label>
          <input id="ra" name="ra" inputmode="decimal" value="${ra}" placeholder="0 a menos de 360" maxlength="32" autocomplete="off" data-testid="ra-input">
          <span aria-hidden="true">°</span></div>
        <div class="coord-field"><label for="dec">Dec (grados)</label>
          <input id="dec" name="dec" inputmode="text" value="${dec}" placeholder="−90 a +90" maxlength="32" autocomplete="off" data-testid="dec-input">
          <span aria-hidden="true">°</span></div>
        <button class="button primary" type="submit" data-testid="submit-btn">Comparar <span aria-hidden="true">→</span></button>
        <button class="button secondary" type="button" id="wise-preset">WISE 0855</button>
      </form>
      <p id="coordinate-errors" class="coordinate-error input-error" role="alert" hidden></p>
      <a class="text-link coordinate-help" href="#articulo/coordenadas">Ayuda con RA y Dec <span aria-hidden="true">↗</span></a>
    </details>
    <div id="observation-workspace"></div>
    <p id="viewer-announcement" class="sr-only" role="status" aria-live="polite"></p>`;
}

function scienceCaveat() {
  return `<div class="callout info science-notice">
    <span aria-hidden="true">ⓘ</span>
    <div><strong>${archiveNote}</strong>
      <p>El ruido, la resolución y las condiciones de observación pueden cambiar la apariencia de las imágenes.</p></div>
  </div>`;
}

function frameData(frame, data) {
  return `${dataRows([
    ['Fecha de exposición', dateMark(frame.observed_at, true)],
    ['Observación', `<span class="mono wrap">${escapeHtml(frame.observation_id)}</span>`],
    ['Colección', `SPHEREx ${frame.release.toUpperCase()}`],
    ['Calidad', frame.quality_flags.length
      ? frame.quality_flags.map((flag) => flag === 'masked_pixels'
        ? 'Píxeles enmascarados visibles en la cuadrícula.' : escapeHtml(flag)).join(' · ')
      : 'Sin avisos de calidad.'],
  ])}
  <details>
    <summary>ID de fotograma y versión</summary>
    <p class="mono wrap"><small>${escapeHtml(frame.id)}</small></p>
    <p class="muted"><small>Versión científica ${escapeHtml(data.science_version)}</small></p>
  </details>
  ${frame.source_url ? `<a class="text-link" href="${escapeHtml(frame.source_url)}" target="_blank" rel="noopener">Ver FITS en IRSA <span aria-hidden="true">↗</span></a>` : ''}`;
}

function evidencePanel(data, single = false) {
  return `<aside class="panel evidence comparison-evidence" id="comparison-evidence" aria-labelledby="evidence-title" data-testid="provenance-panel">
    <div class="row between"><h2 id="evidence-title" tabindex="-1">Procedencia</h2>${badge(comparisonMode(data), data.mode === 'prepared' ? 'success' : 'info')}</div>
    <div class="evidence-epoch"><span class="epoch-token" id="active-evidence-token" aria-hidden="true">A</span>
      <h3 id="active-evidence-title">Fotograma A</h3></div>
    <div id="active-evidence">${single ? frameData(data.frames[0], data) : ''}</div>
    <div class="evidence-field">
      ${dataRows([
        ['Campo de visión', `<span class="mono">${fieldLabel(data.query)}</span>`],
        ['Banda aproximada', `<span class="mono">${formatBand(data.band)}</span>`],
      ])}
      <details class="evidence-coordinates">
        <summary>Coordenadas y fecha de comprobación</summary>
        ${dataRows([
          ['Campo ICRS', `<span class="mono">RA ${data.query.ra_deg}°<br>Dec ${data.query.dec_deg}°</span>`],
          [data.mode === 'prepared' ? 'Preparación' : 'Consulta', dateMark(data.checked_at, true)],
        ])}
      </details>
    </div>
    ${data.warnings?.length ? `<p class="input-hint">${data.warnings.map((warning) => warning === 'search_limit_reached'
      ? 'La búsqueda alcanzó su límite de tiempo o recortes.' : escapeHtml(warning)).join(' ')}</p>` : ''}
  </aside>`;
}

function frameTile(frame, index, preview = false, data = prepared) {
  const contents = `<img class="science-image" src="${escapeHtml(frame.src)}" data-frame-id="${escapeHtml(frame.id)}" alt="Recorte ${preview ? 'de referencia' : 'SPHEREx de la época ' + epoch(index)}" width="64" height="64">
    <span class="image-error" role="alert" hidden>Imagen no disponible.</span>`;
  return `<figure class="frame-tile" data-frame="${index}">
    <figcaption class="frame-label"><span class="epoch-token">${epoch(index)}</span>
      ${preview ? 'Imagen de referencia' : dateMark(frame.observed_at)}</figcaption>
    ${preview ? `<div class="frame-image-link">${contents}</div>` : `<a class="frame-image-link" href="${escapeHtml(imageLink(index, data))}" aria-label="Ampliar época ${epoch(index)}">
      <span class="image-expand" aria-hidden="true">⤢</span>${contents}</a>`}
    <div class="frame-foot"><span>64 × 64 px</span><span class="axes"><span>↑ N</span><span>← E</span></span></div>
  </figure>`;
}

function temporalPlayer(data) {
  const frames = data.frames;
  const span = (Date.parse(frames.at(-1).observed_at) - Date.parse(frames[0].observed_at)) / 86400000;
  return `<div class="timeline player" role="group" aria-label="Controles del reproductor">
    <div class="row between playback-row">
      <div><h3>Línea de tiempo</h3><p>${span.toFixed(2)} días entre la primera y la última época</p></div>
      <div class="row playback-buttons">
        <button type="button" class="icon-button" data-step="-1" aria-label="Fotograma anterior" data-testid="btn-prev">←</button>
        <button type="button" class="button secondary" id="play-toggle" data-testid="btn-play"><span aria-hidden="true">▸</span> Reproducir</button>
        <button type="button" class="icon-button" data-step="1" aria-label="Fotograma siguiente" data-testid="btn-next">→</button>
      </div>
    </div>
    <label for="epoch-slider" class="sr-only">Elegir época</label>
    <input type="range" id="epoch-slider" min="0" max="${frames.length - 1}" step="1" value="0">
    <div class="epoch-choices" role="group" aria-label="Época activa">
      ${frames.map((frame, index) => `<button type="button" class="epoch-choice" data-select="${index}" aria-label="Mostrar época ${epoch(index)}" data-testid="btn-epoch-${epoch(index).toLowerCase()}">
        <b class="epoch-token">${epoch(index)}</b><span>${dateMark(frame.observed_at)}</span>
      </button>`).join('')}
    </div>
  </div>`;
}

const differenceScaleFormat = new Intl.NumberFormat('es-MX', { maximumSignificantDigits: 3 });
const coverageFormat = new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 });

function differenceStage(data) {
  const { id, image_url, scale_mjy_sr, common_valid_fraction } = data.difference;
  const scale = differenceScaleFormat.format(scale_mjy_sr);
  return `<section class="difference-stage" id="live-difference" aria-labelledby="difference-title" hidden>
    <figure class="frame-tile difference-figure">
      <div class="difference-image">
        <img class="science-image" src="${escapeHtml(image_url)}" data-frame-id="${escapeHtml(id)}"
          width="64" height="64" loading="lazy" alt="Mapa de brillo superficial de la época B menos la época A">
        <span class="image-error" role="alert" hidden>No se pudo cargar el mapa de diferencias.</span>
      </div>
      <figcaption class="frame-foot"><span>64 × 64 px</span><span class="axes"><span>↑ N</span><span>← E</span></span></figcaption>
    </figure>
    <div class="difference-description">
      <div>
        <h3 id="difference-title">Diferencia entre épocas</h3>
        <p>Brillo superficial en B menos A</p>
      </div>
      ${scale_mjy_sr > 0 ? `<div class="difference-legend">
        <div class="difference-gradient" aria-hidden="true"></div>
        <div class="difference-legend-labels">
          <span>−${scale}<small>Menor en B</small></span>
          <span>0<small>MJy/sr</small></span>
          <span>+${scale}<small>Mayor en B</small></span>
        </div>
      </div>` : '<p>Diferencia cero en los píxeles válidos.</p>'}
      <dl class="difference-details">
        ${data.frames.map((frame, index) => `<div>
          <dt><span class="epoch-token">${epoch(index)}</span></dt>
          <dd><a class="text-link" href="${escapeHtml(imageLink(index, data))}">${dateMark(frame.observed_at, true)}</a></dd>
        </div>`).join('')}
        <div><dt>Banda común</dt><dd>${formatBand(data.band)}</dd></div>
      </dl>
      <p class="difference-quality"><strong>${coverageFormat.format(common_valid_fraction)} del campo en común.</strong>
        La cuadrícula marca píxeles excluidos. El ruido, el fondo, la resolución y la respuesta espectral pueden producir residuos.</p>
    </div>
  </section>`;
}

function readyComparison(data) {
  const releases = [...new Set(data.frames.map((frame) => frame.release.toUpperCase()))].join(' / ');
  return `<div class="observatory comparison-workspace" data-testid="comparison-viewer">
    <section class="panel comparison-panel" aria-label="Comparador de épocas" tabindex="0">
      <div class="comparison-head row between">
        <div><h2>${fieldName(data.query)}</h2><p>${data.frames.length} observaciones de SPHEREx ${releases}</p></div>
        <div class="row comparison-tools">
          <div class="segmented" role="group" aria-label="Modo de comparación">
            <button type="button" data-layout="side" aria-pressed="true">Lado a lado</button>
            <button type="button" data-layout="alternate" aria-pressed="false">Alternar</button>
            <button type="button" data-layout="wipe" aria-pressed="false">Deslizar</button>
            ${data.difference ? '<button type="button" data-layout="difference" aria-pressed="false">Ver diferencias</button>' : ''}
          </div>
          ${document.fullscreenEnabled ? '<button class="icon-button" type="button" id="comparison-fullscreen" aria-pressed="false" aria-label="Pantalla completa" title="Pantalla completa">⤢</button>' : ''}
        </div>
      </div>
      <div class="frame-grid" id="live-frames">${data.frames.map((frame, index) => frameTile(frame, index, false, data)).join('')}</div>
      <div class="wipe-stage" id="live-wipe" hidden>
        <div id="wipe-pair"></div>
        <p class="input-hint">Arrastra el divisor o elige una época en la línea de tiempo.</p>
      </div>
      ${data.difference ? differenceStage(data) : ''}
      ${temporalPlayer(data)}
    </section>
    ${evidencePanel(data)}
    <div class="comparison-after">
      ${scienceCaveat()}
      <a class="button secondary" href="#ficha?${escapeHtml(coordinateParams(data.query))}">Preparar ficha de observación <span aria-hidden="true">→</span></a>
    </div>
  </div>`;
}

function emptyComparison(status) {
  const reasons = {
    single_epoch: 'Solo se encontró una época de observación para este campo.',
    no_common_band: 'La búsqueda no encontró épocas en una banda común.',
    no_usable_frames: 'La búsqueda no encontró fotogramas utilizables.',
    search_limit_reached: 'La búsqueda alcanzó el límite de tiempo o recortes.',
  };
  const base = {
    idle: ['Introduce una región del cielo', 'Usa las coordenadas en grados decimales ICRS o abre el caso preparado de WISE 0855.', '⊕', 'neutral'],
    cargando: ['Cargando…', 'Esperando el resultado de la comparación.', '', 'info'],
    'sin-cobertura': ['Sin cobertura', 'La consulta terminó sin observaciones de esta región en las colecciones consultadas.', '○', 'neutral'],
    'sin-imagenes': ['Cobertura insuficiente', 'Las exposiciones del campo no ofrecen fotogramas utilizables en una banda común.', '◐', 'warning'],
    fallo: ['Fallo temporal', 'El archivo de observaciones no respondió. Intenta de nuevo.', '!', 'danger'],
    'imagen-no-disponible': ['Imagen no disponible', 'No se pudo obtener el PNG de esta observación.', '!', 'danger'],
  };
  const [title, description, mark, color] = base[status];
  const reason = Object.hasOwn(reasons, viewer.data?.reason) ? reasons[viewer.data.reason] : description;
  const action = status === 'idle' ? '<a class="button primary" href="#visor/wise-0855">Abrir ejemplo WISE 0855 <span aria-hidden="true">→</span></a>' :
    status === 'fallo' ? '<button class="button primary" id="retry" type="button">Reintentar</button>' :
    status === 'imagen-no-disponible'
      ? '<a class="button secondary" href="#galeria">Explorar campos <span aria-hidden="true">→</span></a>' : '';
  const testId = { cargando: 'status-loading', 'sin-cobertura': 'status-no-coverage',
    'sin-imagenes': 'status-insufficient', fallo: 'status-error' }[status] ?? 'empty-state';
  return `<section class="panel comparison-empty ${color}" data-state="${status}" data-testid="${testId}" ${color === 'danger' ? 'role="alert"' : 'role="status"'}>
    <div>
      <span class="state-mark" aria-hidden="true">${status === 'cargando' ? '<span class="spinner"></span>' : mark}</span>
      <h2>${title}</h2><p>${escapeHtml(viewer.message ?? reason)}</p>${action}
    </div>
  </section>`;
}

function renderObservation() {
  const workspace = document.querySelector('#observation-workspace');
  const { status, example, data } = viewer;
  const exampleTag = example ? `<div class="row between state-preview">
    ${badge('Estado simulado', 'info')} <a class="text-link" href="#estados">Ver otros estados <span aria-hidden="true">→</span></a>
  </div>` : '';
  if (status === 'ready') {
    workspace.innerHTML = readyComparison(data);
    updateFrame();
  } else if (status === 'insuficiente') {
    workspace.innerHTML = `${exampleTag}<div class="observatory" data-testid="status-insufficient">
      <section class="panel comparison-panel" aria-label="Fotograma individual">
        <div class="comparison-head"><h2>Cobertura insuficiente</h2>
          <p>${example ? 'Una sola época utilizable. Se muestra un recorte de referencia.' : 'Hay una época utilizable. La reproducción requiere dos observaciones comparables.'}</p></div>
        <div class="frame-grid single">${frameTile((data ?? prepared).frames[0], 0, example, data ?? prepared)}</div>
      </section>
      ${data ? evidencePanel(data, true) : '<aside class="panel"><h2>Una imagen disponible</h2><p class="muted">La reproducción requiere al menos dos épocas comparables.</p></aside>'}
    </div>`;
  } else {
    workspace.innerHTML = exampleTag + emptyComparison(status);
  }
  bindEvidenceImages(workspace);
}

function updateFrame(announce = false) {
  const panel = document.querySelector('#observation-workspace');
  const { index, layout, data } = viewer;
  const frame = data.frames[index];
  const slider = panel.querySelector('#epoch-slider');
  const frames = panel.querySelector('#live-frames');
  const first = Math.min(index, data.frames.length - 2);
  const showingDifference = layout === 'difference';
  frames.classList.toggle('single', layout === 'alternate');
  frames.hidden = layout === 'wipe' || showingDifference;
  const wipe = panel.querySelector('#live-wipe');
  wipe.hidden = layout !== 'wipe';
  const difference = panel.querySelector('#live-difference');
  if (difference) difference.hidden = !showingDifference;
  slider.closest('.timeline').hidden = showingDifference;
  if (layout === 'wipe' && wipe.dataset.first !== String(first)) {
    wipe.dataset.first = String(first);
    const container = wipe.querySelector('#wipe-pair');
    container.innerHTML = comparisonSlider('visor', 'Deslizar entre las dos épocas', data.frames.slice(first, first + 2), first);
    bindComparisonSlider(container.querySelector('.wipe'));
    bindEvidenceImages(container);
  }
  panel.querySelectorAll('[data-frame]').forEach((figure) => {
    const position = Number(figure.dataset.frame);
    const active = position === index;
    figure.classList.toggle('is-active', active);
    figure.hidden = layout === 'alternate' ? !active : position < first || position > first + 1;
  });
  panel.querySelectorAll('[data-select]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.select) === index));
  });
  panel.querySelectorAll('[data-layout]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.layout === layout));
  });
  slider.value = index;
  slider.style.setProperty('--epoch-position', `${index / (data.frames.length - 1) * 100}%`);
  slider.setAttribute('aria-valuetext', `Época ${epoch(index)}, ${shortDate(frame.observed_at)}`);
  const play = panel.querySelector('#play-toggle');
  play.innerHTML = playTimer ? '<span aria-hidden="true">Ⅱ</span> Pausar' : '<span aria-hidden="true">▸</span> Reproducir';
  const evidence = panel.querySelector('#active-evidence');
  if (evidence.dataset.frameId !== frame.id) {
    panel.querySelector('#active-evidence-title').textContent = `Fotograma ${epoch(index)}`;
    panel.querySelector('#active-evidence-token').textContent = epoch(index);
    evidence.innerHTML = frameData(frame, data);
    evidence.dataset.frameId = frame.id;
  }
  if (announce) document.querySelector('#viewer-announcement').textContent = `Época ${epoch(index)}, ${fullDate(frame.observed_at)}`;
}

function bindViewer(_id, _params, compare) {
  const form = document.querySelector('#coordinates');
  const ra = form.elements.ra;
  const dec = form.elements.dec;
  const errors = document.querySelector('#coordinate-errors');
  const panel = document.querySelector('#observation-workspace');
  const isDecimal = (text) => /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text);

  async function validate(event) {
    event?.preventDefault();
    cancelSearch();
    form.removeAttribute('aria-busy');
    errors.hidden = true;
    const raValue = ra.value.trim().replace(',', '.');
    const decValue = dec.value.trim().replace(',', '.');
    const badRa = !isDecimal(raValue) || !(Number(raValue) >= 0 && Number(raValue) < 360);
    const badDec = !isDecimal(decValue) || !(Number(decValue) >= -90 && Number(decValue) <= 90);
    ra.setAttribute('aria-invalid', String(badRa));
    dec.setAttribute('aria-invalid', String(badDec));
    if (badRa || badDec) {
      errors.textContent = [
        badRa ? 'RA debe estar entre 0° y menos de 360°.' : '',
        badDec ? 'Dec debe estar entre −90° y +90°.' : '',
        'Introduce las coordenadas en grados decimales.',
      ].filter(Boolean).join(' ');
      errors.hidden = false;
      if (viewer.status === 'cargando' && !viewer.example) {
        viewer.status = 'idle';
        renderObservation();
      }
      (badRa ? ra : dec).focus();
      return;
    }
    stopPlayback();
    form.setAttribute('aria-busy', 'true');
    viewer = { status: 'cargando', example: false, data: null, index: 0, layout: 'alternate' };
    renderObservation();

    const controller = new AbortController();
    activeSearch = controller;
    try {
      const payload = await compare(Number(raValue), Number(decValue), controller.signal);
      if (!form.isConnected || controller.signal.aborted) return;
      const data = normalizeComparison(payload);
      viewer.data = data;
      viewer.status = comparisonState(data);
      viewer.layout = data.frames.length >= 2 ? 'side' : 'alternate';
      if (data.frames.length) storeComparison(data);
      if (data.status === 'ready') form.closest('details').open = false;
      renderObservation();
      if (data.status === 'ready') document.querySelector('#viewer-announcement').textContent = `Comparación lista. ${data.frames.length} épocas. Consulta sus fechas y fuentes en Procedencia.`;
    } catch (error) {
      if (!form.isConnected || controller.signal.aborted) return;
      viewer.status = 'fallo';
      viewer.message = error instanceof Error ? error.message : 'Ocurrió un fallo temporal al buscar el campo.';
      renderObservation();
    } finally {
      if (activeSearch === controller) {
        activeSearch = undefined;
        form.removeAttribute('aria-busy');
      }
    }
  }
  form.addEventListener('submit', validate);
  document.querySelector('#wise-preset').addEventListener('click', () => {
    ra.value = prepared.query.ra_deg;
    dec.value = prepared.query.dec_deg;
    validate();
  });
  panel.addEventListener('click', (event) => {
    const action = event.target.closest('button');
    if (!action) return;
    if (action.id === 'retry') {
      validate();
      if (form.closest('details').open) form.querySelector('[type="submit"]').focus();
      return;
    }
    if (viewer.status !== 'ready') return;
    if (action.id === 'comparison-fullscreen') {
      const comparison = action.closest('.comparison-panel');
      const operation = document.fullscreenElement === comparison
        ? document.exitFullscreen()
        : comparison.requestFullscreen();
      operation.catch(() => toast('El navegador no permitió abrir la pantalla completa.'));
      return;
    }
    if (action.id === 'play-toggle') {
      if (playTimer) stopPlayback();
      else {
        viewer.layout = 'alternate';
        playTimer = window.setInterval(() => {
          viewer.index = (viewer.index + 1) % viewer.data.frames.length;
          updateFrame();
        }, 1250);
      }
      updateFrame();
    } else if (action.dataset.layout) {
      stopPlayback();
      viewer.layout = action.dataset.layout;
      updateFrame();
    } else if (action.dataset.select !== undefined || action.dataset.step !== undefined) {
      stopPlayback();
      viewer.index = action.dataset.select !== undefined ? Number(action.dataset.select) :
        (viewer.index + Number(action.dataset.step) + viewer.data.frames.length) % viewer.data.frames.length;
      updateFrame(true);
    }
  });
  panel.addEventListener('input', (event) => {
    if (event.target.id !== 'epoch-slider') return;
    stopPlayback();
    viewer.index = Number(event.target.value);
    updateFrame(true);
  });
  panel.addEventListener('focusin', (event) => {
    if (playTimer && event.target.closest('.evidence')) {
      stopPlayback();
      updateFrame();
    }
  });
  panel.addEventListener('keydown', (event) => {
    if (viewer.status !== 'ready' || viewer.layout === 'difference' || !event.target.matches('.comparison-panel')) return;
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    const button = step ? panel.querySelector(`[data-step="${step}"]`) : event.key === ' ' ? panel.querySelector('#play-toggle') : null;
    if (!button) return;
    event.preventDefault();
    button.click();
  });
  renderObservation();
  if (viewer.autoSearch) void validate();
}

document.addEventListener('fullscreenchange', () => {
  const button = document.querySelector('#comparison-fullscreen');
  if (!button) return;
  const expanded = document.fullscreenElement === button.closest('.comparison-panel');
  const label = expanded ? 'Salir de pantalla completa' : 'Pantalla completa';
  button.setAttribute('aria-pressed', String(expanded));
  button.setAttribute('aria-label', label);
  button.title = label;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && playTimer) {
    stopPlayback();
    if (document.querySelector('#live-frames')) updateFrame();
  }
});

function inspectorView(id, params) {
  const data = comparisonFor(params);
  const index = Number(id);
  const frame = /^\d+$/.test(id) ? data?.frames[index] : null;
  if (!frame) return `${pageHeading('Imagen no disponible', 'Abre la comparación correspondiente antes de ampliar una época.')}
    <a class="button primary" href="#visor?${escapeHtml(params)}">Abrir el comparador</a>`;
  const reportId = params.get('ficha');
  const report = reportFrom(params);
  const readOnly = report && (!isEditableReport(report) || (report.shared && !report.mine));
  const from = params.get('desde');
  const fromForm = !readOnly && (from === 'manual' || from === 'pdf');
  const reportFormat = fromForm ? from : report?.format;
  const reportParams = coordinateParams(data.query);
  if (reportId) reportParams.set('borrador', reportId);
  const reportLink = `#ficha${reportFormat === 'pdf' ? '/pdf' : ''}?${reportParams}`;
  const returnView = (from === 'administracion' || from === 'articulo') ? from : 'confirmacion';
  const local = from === 'administracion' && !report?.shared ? '?local=1' : '';
  const returnLink = fromForm ? reportLink
    : reportId ? `#${returnView}/${encodeURIComponent(reportId)}${local}` : comparisonLink(data);
  return `${back(returnLink, fromForm || reportId ? 'Volver a la ficha' : 'Visor temporal')}
    ${pageHeading(`${fieldName(data.query)} · Época ${epoch(index)}`, fullDate(frame.observed_at), '', true)}
    <div class="observatory">
      <section class="panel image-inspector" aria-label="Imagen ampliada">
        <div class="row between zoom-toolbar">
          <div class="row">
            <label for="inspector-date">Época</label>
            <select id="inspector-date" ${data.frames.length === 1 ? 'disabled' : ''}>
              ${data.frames.map((item, pos) => `<option value="${pos}" ${pos === index ? 'selected' : ''}>${epoch(pos)} · ${shortDate(item.observed_at)}</option>`).join('')}
            </select>
          </div>
          <div class="row" role="group" aria-label="Ampliación">
            <button class="icon-button" id="zoom-out" type="button" aria-label="Alejar" disabled>−</button>
            <output id="zoom-level" class="zoom-scale" aria-label="Nivel de ampliación">1×</output>
            <button class="icon-button" id="zoom-in" type="button" aria-label="Acercar">+</button>
          </div>
        </div>
        <div class="zoom-stage">
          <div class="zoom-window">
            <div class="zoom-layer" id="zoom-layer">
              <img class="science-image" src="${escapeHtml(frame.src)}" data-frame-id="${escapeHtml(frame.id)}" alt="Recorte SPHEREx de la época ${epoch(index)}" width="64" height="64">
              <span class="image-error" role="alert" hidden>Imagen no disponible. Vuelve a consultar este campo.</span>
              <canvas id="annotation-layer" width="512" height="512" aria-label="Capa de anotaciones del fotograma"></canvas>
            </div>
          </div>
        </div>
        <div class="zoom-timeline">
          <label for="inspector-slider" class="sr-only">Elegir época de la imagen</label>
          <input type="range" id="inspector-slider" min="0" max="${data.frames.length - 1}" step="1" value="${index}" ${data.frames.length === 1 ? 'disabled' : ''}
            aria-valuetext="Época ${epoch(index)}, ${shortDate(frame.observed_at)}">
          <div class="timeline-labels">${data.frames.map((item, pos) => `<span>${epoch(pos)} · ${dateMark(item.observed_at)}</span>`).join('')}</div>
        </div>
        ${readOnly ? '' : `<div class="row zoom-toolbar" role="group" aria-label="Anotaciones">
          <button class="button secondary" id="draw" type="button" aria-pressed="false">Dibujar</button>
          <button class="button secondary" id="crop" type="button" aria-pressed="false">Delimitar recorte</button>
          <button class="button ghost" id="undo-annotation" type="button" disabled>Deshacer</button>
          <button class="button ghost" id="clear-annotation" type="button">Limpiar marcas</button>
          <output id="annotation-count" class="input-hint" aria-live="polite"></output>
        </div>`}
        <p class="annotation-note" id="annotation-note">${readOnly
          ? 'Esta imagen muestra las marcas guardadas cuando se envió la ficha.'
          : 'Selecciona una herramienta y arrastra sobre la imagen. El recorte más reciente aparece ampliado en la ficha.'}</p>
      </section>
      <aside class="panel evidence"><div class="row between"><h2>Procedencia</h2>${badge(comparisonMode(data), 'success')}</div>
        ${frameData(frame, data)}
        <div class="row"><a href="${escapeHtml(readOnly ? returnLink : reportLink)}" class="button primary">${readOnly || fromForm ? 'Volver a la ficha' : report ? 'Editar ficha' : 'Preparar ficha'}</a></div>
      </aside>
    </div>`;
}

function bindInspector(id, params) {
  const canvas = document.querySelector('#annotation-layer');
  if (!canvas) return;
  const data = comparisonFor(params);
  const context = canvas.getContext('2d');
  const frame = data.frames[Number(id)];
  const report = reportFrom(params);
  const readOnly = report && (!isEditableReport(report) || (report.shared && !report.mine));
  const zoomLayer = document.querySelector('#zoom-layer');
  const zoomIn = document.querySelector('#zoom-in');
  const zoomOut = document.querySelector('#zoom-out');
  const zoomLevel = document.querySelector('#zoom-level');
  const draw = document.querySelector('#draw');
  const crop = document.querySelector('#crop');
  const undo = document.querySelector('#undo-annotation');
  const clear = document.querySelector('#clear-annotation');
  const count = document.querySelector('#annotation-count');
  let zoom = 1;
  let tool = null;
  let pending = null;
  let marks = frameMarks(report ? report.annotations : readWorkspace().annotations, frame.id);

  for (const controlId of ['inspector-date', 'inspector-slider']) {
    const control = document.getElementById(controlId);
    control.addEventListener(controlId === 'inspector-date' ? 'change' : 'input', () => {
      inspectorFocus = controlId;
      location.hash = imageLink(control.value, data, params.get('ficha'), params.get('desde'));
    });
  }
  if (inspectorFocus) {
    const control = document.getElementById(inspectorFocus);
    inspectorFocus = undefined;
    window.requestAnimationFrame(() => control.focus());
  }

  function repaint() {
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    paintMarks(context, pending ? [...marks, pending] : marks);
  }

  function updateZoom(delta) {
    zoom = Math.max(1, Math.min(4, zoom + delta));
    zoomLayer.style.setProperty('--zoom', zoom);
    zoomLevel.value = `${zoom}×`;
    zoomIn.disabled = zoom === 4;
    zoomOut.disabled = zoom === 1;
  }

  function setTool(next) {
    tool = tool === next ? null : next;
    draw.setAttribute('aria-pressed', String(tool === 'draw'));
    crop.setAttribute('aria-pressed', String(tool === 'crop'));
    canvas.style.cursor = tool ? 'crosshair' : 'default';
    canvas.style.touchAction = tool ? 'none' : 'auto';
  }

  function updateMarkControls() {
    undo.disabled = clear.disabled = !marks.length;
    count.value = `${marks.length} ${marks.length === 1 ? 'marca' : 'marcas'}`;
  }

  function updateMarks(change, message) {
    if (report?.shared) {
      const updated = change(marks);
      if (updated.length > 30) return;
      stageSharedMarks(report, frame.id, updated);
      marks = updated;
      updateMarkControls();
      toast('Vuelve a la ficha para guardar las marcas en tu cuenta.');
      return;
    }
    const workspace = readWorkspace();
    const target = report ? workspace.reports.find((item) => item.id === report.id) : workspace;
    if (report && !isEditableReport(target)) {
      toast('El estado de la ficha cambió. Vuelve a abrirla para ver las marcas.');
      return;
    }
    const updated = change(frameMarks(target.annotations, frame.id));
    if (updated.length > 30) {
      toast('El límite es de 30 marcas por época.');
      return;
    }
    target.annotations = { ...target.annotations, [frame.id]: updated };
    writeWorkspace(workspace);
    marks = updated;
    updateMarkControls();
    toast(message);
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    const normalize = (value) => Math.min(1, Math.max(0, Number(value.toFixed(4))));
    return [normalize((event.clientX - rect.left) / rect.width), normalize((event.clientY - rect.top) / rect.height)];
  }

  zoomIn.addEventListener('click', () => updateZoom(1));
  zoomOut.addEventListener('click', () => updateZoom(-1));
  if (readOnly) {
    repaint();
    return;
  }
  if (!context) {
    const note = document.querySelector('#annotation-note');
    note.textContent = 'Este navegador permite ampliar. La capa de anotaciones requiere Canvas.';
    draw.disabled = crop.disabled = undo.disabled = clear.disabled = true;
    return;
  }
  draw.addEventListener('click', () => setTool('draw'));
  crop.addEventListener('click', () => setTool('crop'));
  undo.addEventListener('click', () => {
    updateMarks((current) => current.slice(0, -1), 'Se deshizo la última marca.');
    repaint();
  });
  clear.addEventListener('click', () => {
    updateMarks(() => [], 'Se limpiaron las marcas de esta época.');
    repaint();
  });
  canvas.style.touchAction = 'auto';
  canvas.addEventListener('pointerdown', (event) => {
    if (!tool || pending || event.button !== 0) return;
    if (marks.length >= 30) {
      toast('Límite de 30 marcas en esta época. Limpia la capa para dibujar de nuevo.');
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    pending = { type: tool, points: [point(event)], pointerId: event.pointerId };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pending?.pointerId !== event.pointerId) return;
    if (pending.type === 'crop') pending.points[1] = point(event);
    else if (pending.points.length < 400) pending.points.push(point(event));
    repaint();
  });
  canvas.addEventListener('pointerup', (event) => {
    if (pending?.pointerId !== event.pointerId) return;
    const { type, points: sampledPoints } = pending;
    const first = sampledPoints[0];
    const last = point(event);
    const points = type === 'crop' ? [first, last] : [...sampledPoints.slice(0, 399), last];
    const meaningful = type === 'crop'
      ? Math.abs(first[0] - last[0]) > .01 && Math.abs(first[1] - last[1]) > .01
      : points.some(([x, y]) => x !== first[0] || y !== first[1]);
    pending = null;
    if (meaningful) {
      updateMarks((current) => [...current, { type, points }], 'Marca guardada para la ficha.');
    }
    repaint();
  });
  canvas.addEventListener('pointercancel', (event) => {
    if (pending?.pointerId !== event.pointerId) return;
    pending = null;
    repaint();
  });
  updateMarkControls();
  repaint();
}


export {
  bindComparisonSlider, bindInspector, bindViewer, cancelSearch, comparisonFor, comparisonSlider, prefetchPrepared, preparedState,
  inspectorView, stopPlayback, viewerExamples, viewerView,
};
