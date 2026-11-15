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
let searchTimer = null;
let inspectorFocus;

function stopPlayback() {
  window.clearInterval(playTimer);
  playTimer = null;
}

function cancelSearch() {
  window.clearTimeout(searchTimer);
  searchTimer = null;
}

function viewerView(id) {
  const target = targets.find((item) => item.id === id);
  const isExample = Object.hasOwn(viewerExamples, id) && viewerExamples[id].kind === 'Simulación';
  const status = id === 'wise-0855' ? 'ready' : isExample ? id : 'idle';
  viewer = { status, example: isExample, index: 0, layout: 'side' };
  const ra = target?.ra ?? (id === 'fallo' ? prepared.query.ra_deg : isExample ? 10.25 : '');
  const dec = target?.dec ?? (id === 'fallo' ? prepared.query.dec_deg : isExample ? -12.5 : '');

  return `${pageHeading('Visor temporal', 'Compara observaciones de una misma región en distintas fechas.', '', true)}
    <section class="panel coordinate-panel" aria-labelledby="coordinates-title">
      <div class="row between"><h2 id="coordinates-title">Coordenadas celestes</h2>
        <a class="text-link" href="#articulo/coordenadas">Ayuda con RA y Dec <span aria-hidden="true">↗</span></a></div>
      <form class="coordinate-form" id="coordinates" novalidate aria-describedby="coordinate-errors">
        <div class="coord-field"><label for="ra">RA (grados)</label>
          <input id="ra" name="ra" inputmode="decimal" value="${ra}" placeholder="0 a menos de 360" maxlength="32" autocomplete="off">
          <span aria-hidden="true">°</span></div>
        <div class="coord-field"><label for="dec">Dec (grados)</label>
          <input id="dec" name="dec" inputmode="text" value="${dec}" placeholder="−90 a +90" maxlength="32" autocomplete="off">
          <span aria-hidden="true">°</span></div>
        <button class="button primary" type="submit">Comparar <span aria-hidden="true">→</span></button>
        <button class="button secondary" type="button" id="wise-preset">WISE 0855</button>
      </form>
      <p id="coordinate-errors" class="coordinate-error input-error" role="alert" hidden></p>
    </section>
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

function frameData(frame) {
  return `${dataRows([
    ['Fecha de exposición', dateMark(frame.observed_at, true)],
    ['Observación', `<span class="mono">${frame.observation_id}</span>`],
    ['Colección', `SPHEREx ${frame.release.toUpperCase()}`],
    ['Calidad', frame.quality_flags.includes('masked_pixels') ? 'Píxeles enmascarados visibles en la cuadrícula.' : 'Sin avisos de calidad.'],
  ])}
  <details>
    <summary>ID de fotograma y versión</summary>
    <p class="mono wrap"><small>${frame.id}</small></p>
    <p class="muted"><small>Versión científica ${prepared.science_version}</small></p>
  </details>
  <a class="text-link" href="${frame.source_url}" target="_blank" rel="noopener">Ver FITS en IRSA <span aria-hidden="true">↗</span></a>`;
}

function evidencePanel() {
  return `<aside class="panel evidence" aria-labelledby="evidence-title">
    <div class="row between"><h2 id="evidence-title">Procedencia</h2>${badge('Caso preparado', 'success')}</div>
    ${dataRows([
      ['Campo ICRS', `<span class="mono">RA ${prepared.query.ra_deg}°<br>Dec ${prepared.query.dec_deg}°</span>`],
      ['Tamaño del campo', '<span class="mono">0.10° × 0.10°</span>'],
      ['Banda aproximada', `<span class="mono">${bandLabel}</span>`],
      ['Preparación del par', dateMark(prepared.checked_at, true)],
    ])}
    <h3 id="active-evidence-title">Fotograma A</h3>
    <div id="active-evidence"></div>
  </aside>`;
}

function frameTile(frame, index, preview = false) {
  const contents = `<img class="science-image" src="${frame.src}" alt="Recorte ${preview ? 'de referencia' : 'SPHEREx de la época ' + epoch(index)}" width="64" height="64">
    <span class="image-error" role="alert" hidden>Imagen no disponible.</span>`;
  return `<figure class="frame-tile" data-frame="${index}">
    <figcaption class="frame-label"><span class="epoch-token">${epoch(index)}</span>
      ${preview ? 'Imagen de referencia' : dateMark(frame.observed_at)}</figcaption>
    ${preview ? `<div class="frame-image-link">${contents}</div>` : `<a class="frame-image-link" href="#imagen/${index}" aria-label="Ampliar época ${epoch(index)}">
      <span class="image-expand" aria-hidden="true">⤢</span>${contents}</a>`}
    <div class="frame-foot"><span>64 × 64 px</span><span class="axes"><span>↑ N</span><span>← E</span></span></div>
  </figure>`;
}

function temporalPlayer() {
  return `<div class="timeline player" aria-label="Controles del reproductor">
    <div class="row between">
      <div class="row">
        <button type="button" class="icon-button" data-step="-1" aria-label="Fotograma anterior">←</button>
        <div class="segmented" role="group" aria-label="Época activa">
          ${prepared.frames.map((_frame, index) => `<button type="button" data-select="${index}" aria-label="Ver ${epoch(index)}">${epoch(index)}</button>`).join('')}
        </div>
        <button type="button" class="icon-button" data-step="1" aria-label="Fotograma siguiente">→</button>
      </div>
      <button type="button" class="button secondary" id="play-toggle"><span aria-hidden="true">▸</span> Reproducir</button>
    </div>
    <label for="epoch-slider" class="sr-only">Elegir época</label>
    <input type="range" id="epoch-slider" min="0" max="${prepared.frames.length - 1}" step="1" value="0">
    <div class="timeline-labels">
      ${prepared.frames.map((frame, index) => `<span>${epoch(index)} · ${dateMark(frame.observed_at)}</span>`).join('')}
    </div>
  </div>`;
}

function readyComparison() {
  return `<div class="observatory">
    <div class="stack">
      <section class="panel comparison-panel" aria-label="Comparación">
        <div class="comparison-head row between">
          <div><h2>Campo de WISE 0855</h2><p>2 épocas · ${daysBetween.toFixed(2)} días de separación</p></div>
          <div class="segmented" role="group" aria-label="Modo de comparación">
            <button type="button" data-layout="side" aria-pressed="true">Lado a lado</button>
            <button type="button" data-layout="alternate" aria-pressed="false">Alternar</button>
          </div>
        </div>
        <div class="frame-grid" id="live-frames">${prepared.frames.map((frame, index) => frameTile(frame, index)).join('')}</div>
        ${temporalPlayer()}
      </section>
      ${scienceCaveat()}
      <div class="row"><a class="button secondary" href="#ficha">Preparar ficha de observación <span aria-hidden="true">→</span></a></div>
    </div>
    ${evidencePanel()}
  </div>`;
}

function emptyComparison(status) {
  const base = {
    idle: ['Introduce una región del cielo', 'Usa las coordenadas en grados decimales ICRS o abre el caso preparado de WISE 0855.', '⊕', 'neutral'],
    unavailable: ['Consulta en vivo no disponible', 'Este prototipo incluye el respaldo de WISE 0855. Para buscar otros campos se necesita la API en vivo.', '↗', 'neutral'],
    cargando: ['Cargando…', 'Esperando el resultado de la comparación.', '', 'info'],
    'sin-cobertura': ['Sin cobertura', 'La consulta terminó sin observaciones de esta región en las colecciones consultadas.', '○', 'neutral'],
    'sin-imagenes': ['Cobertura insuficiente', 'Las exposiciones del campo no ofrecen fotogramas utilizables en una banda común.', '◐', 'warning'],
    fallo: ['Fallo temporal', 'El archivo de observaciones no respondió. Intenta de nuevo.', '!', 'danger'],
    'imagen-no-disponible': ['Imagen no disponible', 'No se pudo obtener el PNG de esta observación.', '!', 'danger'],
  };
  const [title, description, mark, color] = base[status];
  const action = status === 'fallo' ? '<button class="button primary" id="retry" type="button">Reintentar</button>' :
    ['idle', 'unavailable', 'imagen-no-disponible'].includes(status)
      ? '<a class="button secondary" href="#galeria">Explorar campos <span aria-hidden="true">→</span></a>' : '';
  return `<section class="panel comparison-empty ${color}" ${color === 'danger' ? 'role="alert"' : 'role="status"'}>
    <div>
      <span class="state-mark" aria-hidden="true">${status === 'cargando' ? '<span class="spinner"></span>' : mark}</span>
      <h2>${title}</h2><p>${description}</p>${action}
    </div>
  </section>`;
}

function renderObservation() {
  const workspace = document.querySelector('#observation-workspace');
  const { status, example } = viewer;
  const exampleTag = example ? `<div class="row between state-preview">
    ${badge('Estado simulado', 'info')} <a class="text-link" href="#estados">Ver otros estados <span aria-hidden="true">→</span></a>
  </div>` : '';
  if (status === 'ready') {
    workspace.innerHTML = readyComparison();
    updateFrame();
  } else if (status === 'insuficiente') {
    workspace.innerHTML = `${exampleTag}<div class="observatory">
      <section class="panel comparison-panel" aria-label="Fotograma individual">
        <div class="comparison-head"><h2>Cobertura insuficiente</h2>
          <p>Una sola época utilizable. Se muestra un recorte de referencia para ilustrar el estado.</p></div>
        <div class="frame-grid single">${frameTile(prepared.frames[0], 0, true)}</div>
      </section>
      <aside class="panel"><h2>Una imagen disponible</h2><p class="muted">La reproducción requiere al menos dos épocas comparables.</p></aside>
    </div>`;
  } else {
    workspace.innerHTML = exampleTag + emptyComparison(status);
  }
  workspace.querySelectorAll('.frame-image-link img').forEach((img) => {
    const showError = () => {
      img.nextElementSibling.hidden = false;
      img.style.visibility = 'hidden';
    };
    img.addEventListener('error', showError, { once: true });
    if (img.complete && !img.naturalWidth) showError();
  });
}

function updateFrame(announce = false) {
  const panel = document.querySelector('#observation-workspace');
  const { index, layout } = viewer;
  const frame = prepared.frames[index];
  const slider = panel.querySelector('#epoch-slider');
  panel.querySelector('#live-frames').classList.toggle('single', layout === 'alternate');
  panel.querySelectorAll('[data-frame]').forEach((figure) => {
    const active = Number(figure.dataset.frame) === index;
    figure.classList.toggle('is-active', active);
    figure.hidden = layout === 'alternate' && !active;
  });
  panel.querySelectorAll('[data-select]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.select) === index));
  });
  panel.querySelectorAll('[data-layout]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.layout === layout));
  });
  slider.value = index;
  slider.setAttribute('aria-valuetext', `Época ${epoch(index)}, ${shortDate(frame.observed_at)}`);
  const play = panel.querySelector('#play-toggle');
  play.innerHTML = playTimer ? '<span aria-hidden="true">Ⅱ</span> Pausar' : '<span aria-hidden="true">▸</span> Reproducir';
  const evidence = panel.querySelector('#active-evidence');
  if (evidence.dataset.frameId !== frame.id) {
    panel.querySelector('#active-evidence-title').textContent = `Fotograma ${epoch(index)}`;
    evidence.innerHTML = frameData(frame);
    evidence.dataset.frameId = frame.id;
  }
  if (announce) document.querySelector('#viewer-announcement').textContent = `Época ${epoch(index)}, ${fullDate(frame.observed_at)}`;
}

function usePrepared() {
  const workspace = readWorkspace();
  workspace.recent = new Date().toISOString();
  writeWorkspace(workspace);
}

function bindViewer() {
  const form = document.querySelector('#coordinates');
  const ra = form.elements.ra;
  const dec = form.elements.dec;
  const errors = document.querySelector('#coordinate-errors');
  const panel = document.querySelector('#observation-workspace');
  const isDecimal = (text) => /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text);

  function validate(event) {
    event?.preventDefault();
    cancelSearch();
    form.removeAttribute('aria-busy');
    errors.hidden = true;
    const raValue = ra.value.trim();
    const decValue = dec.value.trim();
    const badRa = !isDecimal(raValue) || !(Number(raValue) >= 0 && Number(raValue) < 360);
    const badDec = !isDecimal(decValue) || !(Number(decValue) >= -90 && Number(decValue) <= 90);
    ra.setAttribute('aria-invalid', String(badRa));
    dec.setAttribute('aria-invalid', String(badDec));
    if (badRa || badDec) {
      errors.textContent = [
        badRa ? 'RA debe estar entre 0° y menos de 360°.' : '',
        badDec ? 'Dec debe estar entre −90° y +90°.' : '',
        'Usa punto decimal.',
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
    viewer = { status: 'cargando', example: false, index: 0, layout: 'side' };
    renderObservation();
    searchTimer = window.setTimeout(() => {
      searchTimer = null;
      form.removeAttribute('aria-busy');
      const isPrepared = Number(raValue) === prepared.query.ra_deg && Number(decValue) === prepared.query.dec_deg;
      viewer.status = isPrepared ? 'ready' : 'unavailable';
      if (isPrepared) usePrepared();
      renderObservation();
      if (isPrepared) document.querySelector('#viewer-announcement').textContent = 'Comparación lista. Dos épocas de WISE 0855.';
    }, 300);
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
      form.querySelector('[type="submit"]').focus();
      return;
    }
    if (viewer.status !== 'ready') return;
    if (action.id === 'play-toggle') {
      if (playTimer) stopPlayback();
      else {
        viewer.layout = 'alternate';
        playTimer = window.setInterval(() => {
          viewer.index = (viewer.index + 1) % prepared.frames.length;
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
        (viewer.index + Number(action.dataset.step) + prepared.frames.length) % prepared.frames.length;
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
  renderObservation();
  if (viewer.status === 'ready') usePrepared();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && playTimer) {
    stopPlayback();
    if (document.querySelector('#live-frames')) updateFrame();
  }
});

function inspectorView(id) {
  if (!['0', '1'].includes(id)) return missingView();
  const index = Number(id);
  const frame = prepared.frames[index];
  return `${back('#visor/wise-0855', 'Visor temporal')}
    ${pageHeading(`WISE 0855 · Época ${epoch(index)}`, fullDate(frame.observed_at), '', true)}
    <div class="observatory">
      <section class="panel image-inspector" aria-label="Imagen ampliada">
        <div class="row between zoom-toolbar">
          <div class="row">
            <label for="inspector-date">Época</label>
            <select id="inspector-date">
              ${prepared.frames.map((item, pos) => `<option value="${pos}" ${pos === index ? 'selected' : ''}>${epoch(pos)} · ${shortDate(item.observed_at)}</option>`).join('')}
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
              <img class="science-image" src="${frame.src}" alt="Recorte SPHEREx de WISE 0855 en la época ${epoch(index)}" width="64" height="64">
              <canvas id="annotation-layer" width="512" height="512" aria-label="Capa de anotaciones del fotograma"></canvas>
            </div>
          </div>
        </div>
        <div class="zoom-timeline">
          <label for="inspector-slider" class="sr-only">Elegir época de la imagen</label>
          <input type="range" id="inspector-slider" min="0" max="${prepared.frames.length - 1}" step="1" value="${index}"
            aria-valuetext="Época ${epoch(index)}, ${shortDate(frame.observed_at)}">
          <div class="timeline-labels">${prepared.frames.map((item, pos) => `<span>${epoch(pos)} · ${dateMark(item.observed_at)}</span>`).join('')}</div>
        </div>
        <div class="row zoom-toolbar" aria-label="Anotaciones">
          <button class="button secondary" id="draw" type="button" aria-pressed="false">Dibujar</button>
          <button class="button secondary" id="crop" type="button" aria-pressed="false">Delimitar recorte</button>
          <button class="button ghost" id="clear-annotation" type="button">Limpiar marcas</button>
        </div>
        <p class="annotation-note" id="annotation-note">Las marcas se guardan aparte del PNG y se incluyen en la ficha local.</p>
      </section>
      <aside class="panel evidence"><div class="row between"><h2>Procedencia</h2>${badge('SPHEREx DR1', 'success')}</div>
        ${frameData(frame)}
        <div class="row"><a href="#ficha" class="button primary">Preparar ficha</a></div>
      </aside>
    </div>`;
}

function bindInspector(id) {
  const canvas = document.querySelector('#annotation-layer');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  const frame = prepared.frames[Number(id)];
  const zoomLayer = document.querySelector('#zoom-layer');
  const zoomIn = document.querySelector('#zoom-in');
  const zoomOut = document.querySelector('#zoom-out');
  const zoomLevel = document.querySelector('#zoom-level');
  const draw = document.querySelector('#draw');
  const crop = document.querySelector('#crop');
  let zoom = 1;
  let tool = null;
  let pending = null;
  let marks = readWorkspace().annotations[frame.id] ?? [];

  for (const controlId of ['inspector-date', 'inspector-slider']) {
    const control = document.getElementById(controlId);
    control.addEventListener(controlId === 'inspector-date' ? 'change' : 'input', () => {
      inspectorFocus = controlId;
      location.hash = `imagen/${control.value}`;
    });
  }
  if (inspectorFocus) {
    const control = document.getElementById(inspectorFocus);
    inspectorFocus = undefined;
    window.requestAnimationFrame(() => control.focus());
  }

  function paintMark({ type, points }) {
    const [[x, y]] = points;
    context.beginPath();
    context.strokeStyle = type === 'crop' ? '#b8d4f2' : '#ffd392';
    context.lineWidth = 3;
    context.setLineDash(type === 'crop' ? [8, 5] : []);
    if (type === 'crop') {
      const [x2, y2] = points.at(-1);
      context.rect(x * canvas.width, y * canvas.height, (x2 - x) * canvas.width, (y2 - y) * canvas.height);
    } else {
      context.moveTo(x * canvas.width, y * canvas.height);
      points.slice(1).forEach(([px, py]) => context.lineTo(px * canvas.width, py * canvas.height));
    }
    context.stroke();
  }

  function repaint() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    marks.forEach(paintMark);
    if (pending) paintMark(pending);
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

  function writeMarks() {
    const workspace = readWorkspace();
    workspace.annotations[frame.id] = marks;
    writeWorkspace(workspace);
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    const normalize = (value) => Math.min(1, Math.max(0, Number(value.toFixed(4))));
    return [normalize((event.clientX - rect.left) / rect.width), normalize((event.clientY - rect.top) / rect.height)];
  }

  zoomIn.addEventListener('click', () => updateZoom(1));
  zoomOut.addEventListener('click', () => updateZoom(-1));
  draw.addEventListener('click', () => setTool('draw'));
  crop.addEventListener('click', () => setTool('crop'));
  document.querySelector('#clear-annotation').addEventListener('click', () => {
    marks = [];
    writeMarks();
    repaint();
    toast('Se limpiaron las marcas de esta época.');
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
    const { type, points } = pending;
    const first = points[0];
    const last = point(event);
    const meaningful = type === 'crop' ? Math.abs(first[0] - last[0]) > .01 && Math.abs(first[1] - last[1]) > .01 : points.length > 1;
    if (meaningful) {
      if (type === 'crop') points[1] = last;
      marks.push({ type, points });
      writeMarks();
      toast('Marca guardada para la ficha.');
    }
    pending = null;
    repaint();
  });
  canvas.addEventListener('pointercancel', (event) => {
    if (pending?.pointerId !== event.pointerId) return;
    pending = null;
    repaint();
  });
  repaint();
}
