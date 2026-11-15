import {
  archiveNote, comparisonLink, comparisonMode, coordinateParams, dateMark, epoch, escapeHtml,
  fieldLabel, fieldName, formatBand, fullDate, imageLink, nasaVela, prepared, reportStatuses,
} from './datos.js';
import { frameMarks, lastMarkedArea } from './anotaciones.js';
import {
  canReview, clearSharedMarks, fileDataUrl, reportById, setSharedPage, sharedPage, sharedRequest,
} from './colaboracion.js';
import { back, badge, dataRows, missingView, pageHeading, toast } from './ui.js';
import { comparisonFor } from './visor.js';
import { cacheImages, isEditableReport, readWorkspace, reportFile, writeWorkspace } from './workspace.js';

let reportBuffer;

function sharedMode(params) {
  return sharedPage.enabled && params.get('local') !== '1';
}

function reloadView() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

async function submitShared(form, error, action) {
  if (form.getAttribute('aria-busy') === 'true') return;
  form.setAttribute('aria-busy', 'true');
  error.hidden = true;
  const buttons = [...form.querySelectorAll('button:enabled')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await action();
  } catch (failure) {
    error.textContent = failure.message || 'No se pudo completar la acción. Inténtalo de nuevo.';
    error.hidden = false;
  } finally {
    form.removeAttribute('aria-busy');
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function statusBadge(report) {
  const state = Object.hasOwn(reportStatuses, report.status) ? reportStatuses[report.status] : reportStatuses.draft;
  return badge(state.title, state.color);
}

function initials(alias) {
  return alias.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'PX';
}

function avatar(profile, size = 'large') {
  return /^data:image\/(?:png|jpeg|webp);base64,/.test(profile.avatar)
    ? `<img class="avatar avatar-${size}" src="${escapeHtml(profile.avatar)}" alt="">`
    : `<span class="avatar avatar-${size}" aria-hidden="true">${escapeHtml(initials(profile.alias))}</span>`;
}

function reportEvidence(data, annotations, { reportId, from } = {}) {
  const editable = from === 'manual' || from === 'pdf';
  const frames = data.frames.map((frame, index) => ({
    frame, index, marks: frameMarks(annotations, frame.id),
  }));
  const releases = [...new Set(data.frames.map((frame) => frame.release.toUpperCase()))].join(' / ');
  const markTypes = new Set(frames.flatMap(({ marks }) => marks.map(({ type }) => type)));
  return `<aside class="panel attachment-panel" aria-labelledby="attachment-title">
    <h2 id="attachment-title">Observaciones asociadas</h2>
    <p class="muted">${fieldName(data.query)} · SPHEREx ${releases}</p>
    ${editable && !markTypes.size ? '<p class="input-hint">Abre una época para dibujar o señalar un área.</p>' : ''}
    <div class="report-frames">
      ${frames.map(({ frame, index, marks }) => {
        const label = `Época ${epoch(index)}`;
        const action = `${editable ? 'Anotar' : 'Ampliar'} época ${epoch(index)}`;
        const [date, time] = fullDate(frame.observed_at).split(' · ');
        return `<figure class="report-frame"${marks.length ? ` data-report-marks="${escapeHtml(JSON.stringify(marks))}"` : ''}>
          <figcaption class="report-frame-info">
            <strong>${label}</strong>
            <time datetime="${escapeHtml(frame.observed_at)}"><span>${date}</span><span>${time ?? ''}</span></time>
          </figcaption>
          <a class="report-frame-link" href="${escapeHtml(imageLink(index, data, reportId, from))}" aria-label="${action}">
            <div class="report-image">
              <img class="science-image" src="${escapeHtml(frame.src)}" data-frame-id="${escapeHtml(frame.id)}" alt="Recorte SPHEREx · ${label}" width="64" height="64">
              ${marks.length ? '<canvas class="report-overlay" width="512" height="512" aria-hidden="true" hidden></canvas>' : ''}
              <span class="image-error" role="alert" hidden>Imagen no disponible.</span>
            </div>
            <span class="report-annotate">${action} <span aria-hidden="true">→</span></span>
          </a>
          <div class="report-frame-meta">
            ${marks.length ? `<span>${marks.length} ${marks.length === 1 ? 'marca' : 'marcas'}</span>` : ''}
            ${frame.source_url ? `<a class="report-fits" href="${escapeHtml(frame.source_url)}" target="_blank" rel="noopener">FITS · ${escapeHtml(frame.observation_id)}</a>` : ''}
          </div>
          ${lastMarkedArea(marks) ? `<div class="report-crop" hidden>
            <p>Detalle del último recorte</p>
            <canvas class="science-image" width="512" height="512" aria-hidden="true"></canvas>
          </div>` : ''}
        </figure>`;
      }).join('')}
    </div>
    ${markTypes.size ? `<p class="report-legend">
      ${markTypes.has('draw') ? '<span class="legend-draw">Trazo de observación</span>' : ''}
      ${markTypes.has('crop') ? '<span class="legend-crop">Área seleccionada</span>' : ''}
    </p>` : ''}
    ${dataRows([
      ['Banda aproximada', formatBand(data.band)],
      ['Campo', fieldLabel(data.query)],
      ['Centro ICRS', `RA ${data.query.ra_deg}° · Dec ${data.query.dec_deg}°`],
    ])}
  </aside>`;
}

function draftKey(params, data) {
  return params.get('borrador') || String(coordinateParams(data.query));
}

function reportView(id, params) {
  const state = readWorkspace();
  const reportId = params.get('borrador') ?? '';
  const existing = reportById(reportId);
  if (reportId && !existing && sharedMode(params) && !sharedPage.account) {
    return `${pageHeading('Abre tu ficha', 'Inicia sesión para abrir un borrador de tu cuenta.')}
      <a class="button primary" href="#acceso?volver=${encodeURIComponent(location.hash)}">Iniciar sesión</a>`;
  }
  if (reportId && (!isEditableReport(existing) || (existing.shared && !existing.mine))) return missingView();
  const account = sharedMode(params) ? sharedPage.account : null;
  const shared = existing?.shared || (!existing && Boolean(account));
  const data = existing ? existing.comparison ?? prepared : comparisonFor(params);
  if (!data) return `${pageHeading('Vuelve a abrir la comparación', 'Abre las observaciones antes de preparar una ficha de este campo.')}
    <a class="button primary" href="#visor?${escapeHtml(params)}">Abrir el comparador</a>`;
  const format = id === 'pdf' ? 'pdf' : 'manual';
  const buffered = reportBuffer?.key === draftKey(params, data) ? reportBuffer : null;
  const draft = buffered ?? existing;
  const created = draft?.created ?? new Date().toISOString();
  const links = coordinateParams(data.query);
  if (existing) links.set('borrador', existing.id);
  if (params.get('local') === '1') links.set('local', '1');
  const search = `?${escapeHtml(links)}`;
  return `${back(comparisonLink(data), 'Volver al comparador')}
    ${pageHeading(existing ? 'Editar ficha de observación' : 'Ficha de observación',
      'Describe lo que observaste y conserva la evidencia del campo comparado.', '', true)}
    <div class="split report-layout">
      <section class="panel report-body">
        <nav class="segmented" aria-label="Formato del reporte">
          <a href="#ficha${search}" ${format === 'manual' ? 'aria-current="page"' : ''}>Escribir ficha</a>
          <a href="#ficha/pdf${search}" ${format === 'pdf' ? 'aria-current="page"' : ''}>Adjuntar PDF</a>
        </nav>
        <form class="form-grid" id="report-form" data-format="${format}" data-shared="${Boolean(shared)}" data-existing="${escapeHtml(existing?.id ?? '')}" data-created="${escapeHtml(created)}">
          <div><label for="report-author">Autor o alias</label>
            <input id="report-author" name="author" maxlength="60" placeholder="¿Cómo quieres firmar?" required value="${escapeHtml(draft?.author ?? account?.alias ?? (state.profile.active ? state.profile.alias : ''))}"></div>
          <div><label for="report-name">Título</label>
            <input id="report-name" name="title" maxlength="120" placeholder="Título de la observación" required value="${escapeHtml(draft?.title)}"></div>
          ${format === 'manual' ? `<div><label for="report-notes">Descripción de la observación</label>
            <textarea id="report-notes" name="notes" maxlength="5000" placeholder="¿Qué observaste y en qué parte de la imagen?" required>${escapeHtml(draft?.notes)}</textarea></div>`
          : `<div><label for="report-pdf">Documento PDF</label>
            <input id="report-pdf" name="pdf" type="file" accept="application/pdf,.pdf" aria-describedby="pdf-hint">
            <p class="input-hint" id="pdf-hint">Incluye autor, título, texto e imágenes o sus referencias. Puedes adjuntar un PDF de hasta 10 MB.</p>
            ${draft?.fileName ? `<p class="input-hint">Archivo anterior: ${escapeHtml(draft.fileName)}</p>` : ''}</div>`}
          <p class="input-hint">Fecha de creación · ${dateMark(created, true)}</p>
          <p class="input-error" id="report-error" role="alert" hidden></p>
          <div class="row form-actions">
            <button class="button primary" type="submit" data-intent="draft">Guardar borrador</button>
            <button class="button secondary" type="submit" data-intent="review">${shared ? 'Enviar a revisión' : 'Enviar a revisión local'}</button>
            ${existing && !existing.shared && account ? '<button class="button secondary" type="submit" data-intent="copy">Copiar a mi cuenta</button>' : ''}
          </div>
          <div class="row">
            <button class="button ghost" type="submit" data-intent="json">Descargar JSON</button>
            <button class="button ghost" type="submit" data-intent="md">Descargar Markdown</button>
          </div>
          <p class="input-hint">${shared ? 'El borrador es privado. Al enviarlo, el equipo revisor podrá ver tus notas, imágenes y adjuntos.'
            : 'Las fichas y sus revisiones se guardan en este navegador.'}</p>
          ${shared && !existing ? '<button class="button ghost" type="submit" data-intent="local">Guardar en este navegador</button>' : ''}
          ${sharedMode(params) && !account ? `<a class="text-link" href="#acceso?volver=${encodeURIComponent(location.hash)}">Inicia sesión para compartir esta ficha →</a>` : ''}
        </form>
      </section>
      ${reportEvidence(data, existing ? existing.annotations : state.annotations, { reportId: existing?.id, from: format })}
    </div>`;
}

function exportReport(report, format) {
  const data = report.comparison;
  const exportData = {
    ...report,
    comparison: {
      query: data.query,
      band: data.band,
      mode: data.mode,
      checked_at: data.checked_at,
      science_version: data.science_version,
      frames: data.frames.map(({ src: _renderedUrl, ...frame }) => frame),
    },
  };
  const md = (text) => String(text).replace(/[\u0060*_[\]<>#|\\]/g, '\\$&');
  const markdown = [
    `# ${md(report.title)}`,
    `Autor: ${md(report.author)}  \nCreado: ${report.created}`,
    report.notes ? md(report.notes) : `Archivo local: ${md(report.fileName)}`,
    '## Evidencia de la comparación',
    `- Campo ICRS: RA ${data.query.ra_deg}°, Dec ${data.query.dec_deg}°\n- Campo: ${fieldLabel(data.query)}\n- Banda aproximada: ${formatBand(data.band)}\n- Comprobado: ${data.checked_at}\n- Procesamiento: ${md(data.science_version)}`,
    data.frames.map((frame, index) =>
      `- Época ${epoch(index)} · ${frame.observed_at} · ${md(frame.observation_id)} · ${md(frame.id)}${frame.source_url
        ? ` · [SPHEREx ${frame.release.toUpperCase()} (FITS)](<${frame.source_url}>)` : ''}`).join('\n'),
    `Marcas de recorte y dibujo (coordenadas normalizadas por fotograma): \n\n    ${JSON.stringify(report.annotations)}`,
    archiveNote,
  ].join('\n\n');
  const content = format === 'json' ? JSON.stringify(exportData, null, 2) : markdown;
  downloadLocalFile(new Blob([content + '\n'], { type: format === 'json' ? 'application/json' : 'text/markdown' }),
    `planet-x-observacion.${format}`);
}

function downloadLocalFile(file, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = name;
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 2000);
}

function pdfButton(report) {
  if (report.shared && report.hasPdf) {
    return `<a class="button secondary" href="/api/v1/workspace/reports/${report.id}/attachment">Descargar PDF</a>`;
  }
  return report.hasPdf
    ? `<button class="button secondary" type="button" data-pdf-download="${escapeHtml(report.id)}">Descargar PDF</button>`
    : '';
}

function exportButtons(report) {
  return ['json', 'md'].map((type) =>
    `<button class="button ghost" type="button" data-report-export="${type}" data-report-id="${escapeHtml(report.id)}">Descargar ${type === 'json' ? 'JSON' : 'Markdown'}</button>`).join('');
}

document.addEventListener('click', async (event) => {
  const printControl = event.target.closest('#print-report');
  if (printControl) {
    printControl.disabled = true;
    try {
      const images = [...document.querySelectorAll('.attachment-panel .report-image img')];
      await Promise.allSettled(images.map((image) => image.decode()));
      if (printControl.isConnected) window.print();
    } finally {
      printControl.disabled = false;
    }
    return;
  }
  const exportControl = event.target.closest('[data-report-export]');
  if (exportControl) {
    const report = reportById(exportControl.dataset.reportId);
    if (report) exportReport({ ...report, comparison: report.comparison ?? prepared }, exportControl.dataset.reportExport);
    return;
  }
  const button = event.target.closest('[data-pdf-download]');
  if (!button) return;
  const report = readWorkspace().reports.find((item) => item.id === button.dataset.pdfDownload);
  if (!report?.hasPdf) return;
  button.disabled = true;
  try {
    const file = await reportFile('readonly', (store) => store.get(report.id));
    if (!(file instanceof Blob)) throw new Error('Archivo no disponible.');
    downloadLocalFile(file, report.fileName);
  } catch {
    toast('El PDF no está disponible en el almacenamiento de este navegador.');
  } finally {
    button.disabled = false;
  }
});

function bindReport(_id, params) {
  const form = document.querySelector('#report-form');
  if (!form) return;
  const error = document.querySelector('#report-error');
  const { format, existing, created, shared } = form.dataset;
  const earlier = reportById(existing);
  const data = earlier ? earlier.comparison ?? prepared : comparisonFor(params);
  const key = draftKey(params, data);
  let newId;

  form.addEventListener('input', () => {
    const buffer = reportBuffer?.key === key ? reportBuffer : undefined;
    reportBuffer = {
      key, created,
      author: form.elements.author.value, title: form.elements.title.value,
      notes: form.elements.notes?.value ?? buffer?.notes ?? earlier?.notes,
      file: form.elements.pdf?.files[0] ?? buffer?.file,
      fileName: form.elements.pdf?.files[0]?.name ?? buffer?.fileName ?? earlier?.fileName,
    };
    error.hidden = true;
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    const action = event.submitter?.dataset.intent ?? 'draft';
    const author = form.elements.author.value.trim();
    const title = form.elements.title.value.trim();
    const notes = form.elements.notes?.value.trim() ?? '';
    error.hidden = true;
    if (!author || !title || (format === 'manual' && !notes)) {
      error.textContent = 'Completa el autor, el título y la descripción de la observación.';
      error.hidden = false;
      (!author ? form.elements.author : !title ? form.elements.title : form.elements.notes)?.focus();
      return;
    }
    let fileName = '';
    let file;
    if (format === 'pdf') {
      const buffer = reportBuffer?.key === key ? reportBuffer : undefined;
      file = form.elements.pdf.files[0] ?? buffer?.file;
      try {
        if (file) {
          const header = file.size <= 10000000 && /\.pdf$/i.test(file.name) ? await file.slice(0, 5).text() : '';
          if (header !== '%PDF-') throw new Error('invalid-pdf');
          fileName = file.name;
        } else if (earlier?.fileName && earlier.hasPdf) {
          fileName = earlier.fileName;
        } else {
          throw new Error('missing-pdf');
        }
      } catch {
        error.textContent = 'Formato inválido. Selecciona un PDF de hasta 10 MB.';
        error.hidden = false;
        form.elements.pdf.focus();
        return;
      }
    }
    if (!form.isConnected) return;
    const exporting = action === 'json' || action === 'md';
    const share = !exporting && (action === 'copy' || (shared === 'true' && action !== 'local'));
    const report = {
      id: action === 'copy' || !existing ? (newId ??= crypto.randomUUID()) : existing, author, title, notes, format, fileName, created,
      status: action === 'review' ? 'review' : 'draft',
      comparison: data,
    };
    const state = readWorkspace();
    const saved = reportById(existing);
    if (existing && !isEditableReport(saved)) {
      error.textContent = 'El estado de esta ficha cambió. Vuelve a abrirla antes de guardar.';
      error.hidden = false;
      return;
    }
    const annotations = saved ? saved.annotations : state.annotations;
    report.annotations = Object.fromEntries(data.frames
      .map((frame) => [frame.id, frameMarks(annotations, frame.id)])
      .filter(([, marks]) => marks.length));
    if (share) {
      await submitShared(form, error, async () => {
        if (format === 'pdf' && !file && action === 'copy') {
          file = await reportFile('readonly', (store) => store.get(earlier.id));
          if (!(file instanceof Blob)) throw new Error('Adjunta el PDF de nuevo para guardar una copia.');
        }
        const attachment = file ? { name: fileName, content: (await fileDataUrl(file)).split(',')[1] } : undefined;
        await sharedRequest(`/reports/${report.id}`, { method: 'PUT', body: {
          author, title, notes, format, status: report.status, attachment,
          revision: saved?.shared ? saved.revision : 0,
          frame_ids: data.frames.map(({ id: frameId }) => frameId), annotations: report.annotations,
        } });
        clearSharedMarks(report.id);
        reportBuffer = undefined;
        if (form.isConnected) location.hash = `confirmacion/${report.id}`;
      });
      return;
    }
    if (format === 'pdf' && !exporting) {
      form.setAttribute('aria-busy', 'true');
      try {
        if (file) await reportFile('readwrite', (store) => store.put(file, report.id));
        report.hasPdf = Boolean(file || earlier?.hasPdf);
      } catch {
        error.textContent = 'No se pudo guardar el PDF. Comprueba el espacio disponible e inténtalo otra vez.';
        error.hidden = false;
        return;
      } finally {
        form.removeAttribute('aria-busy');
      }
    }
    if (exporting) {
      exportReport(report, action);
      if (fileName) reportBuffer = { key, author, title, notes, created, fileName, file };
      toast(`Ficha descargada en ${action === 'json' ? 'JSON' : 'Markdown'}.`);
      return;
    }
    state.reports = [report, ...state.reports.filter((item) => item.id !== report.id)];
    writeWorkspace(state);
    void cacheImages(data.frames);
    reportBuffer = undefined;
    if (form.isConnected) location.hash = `confirmacion/${encodeURIComponent(report.id)}`;
  });
}

function confirmationView(id) {
  const report = reportById(id);
  if (!report) return missingView();
  const lead = report.shared ? (report.status === 'review' ? 'El equipo revisor ya puede abrir la ficha.' : 'Consulta aquí el estado de la ficha y su evidencia.')
    : report.status === 'review'
    ? 'La ficha se registró en la bandeja de revisión de este navegador.'
    : 'La ficha y sus referencias están disponibles en este navegador.';
  const profileLink = report.shared || !sharedPage.enabled ? '#perfil' : '#perfil?local=1';
  return `${back(profileLink, 'Mi espacio')}
    ${pageHeading(report.status === 'review' ? 'Ficha en revisión' : report.status === 'draft' ? 'Borrador guardado' : 'Estado de tu ficha', lead, '', true)}
    <div class="split report-layout">
    <section class="panel report-confirmation">
      <div class="row between"><h2>${escapeHtml(report.title)}</h2>${statusBadge(report)}</div>
      <p class="muted">${escapeHtml(report.author)} · ${dateMark(report.created, true)}</p>
      ${report.notes || report.fileName ? `<p class="preserve-lines">${escapeHtml(report.notes || report.fileName)}</p>` : ''}
      ${report.reviewNote ? `<p class="callout ${report.status === 'rejected' ? 'danger' : 'info'}">${escapeHtml(report.reviewNote)}</p>` : ''}
      <div class="row">
        <a class="button primary" href="${profileLink}">Ver mis fichas</a>
        ${pdfButton(report)}
        ${isEditableReport(report) && (!report.shared || report.mine) ? `<a class="button secondary" href="${editURL(report)}">Editar ficha</a>` : ''}
        ${report.status === 'review' && (!report.shared || canReview(sharedPage.account)) ? `<a class="button secondary" href="#administracion/${report.id}${!report.shared && sharedPage.enabled ? '?local=1' : ''}">Ver bandeja de revisión</a>` : ''}
        ${report.status === 'published' ? `<a class="button secondary" href="#articulo/${report.id}">Ver publicación</a>` : ''}
      </div>
      <div class="row">
        <button class="button secondary" id="print-report" type="button">Imprimir ficha</button>
        ${exportButtons(report)}
      </div>
    </section>
    ${reportEvidence(report.comparison ?? prepared, report.annotations, { reportId: report.id })}
    </div>`;
}

function editURL(report) {
  return `#ficha${report.format === 'pdf' ? '/pdf' : ''}?borrador=${encodeURIComponent(report.id)}`;
}

function sharedAccountView(id, params) {
  const registration = id === 'registro';
  const suffix = params.has('volver') ? `?${escapeHtml(new URLSearchParams({ volver: params.get('volver') }))}` : '';
  return `<div class="account-layout">
    <section class="panel">
      ${pageHeading(registration ? 'Crea tu cuenta' : 'Accede a tu espacio', 'Guarda tus fichas y consulta su revisión desde cualquier dispositivo.', '', true)}
      ${id === 'recuperar' ? `<p class="callout info">Pide al equipo de Planet X que restablezca el acceso a tu cuenta.</p>
        <a class="button secondary" href="#acceso${suffix}">Volver a iniciar sesión</a>` : `
      <nav class="segmented" aria-label="Acceso y registro">
        <a href="#acceso${suffix}" ${registration ? '' : 'aria-current="page"'}>Iniciar sesión</a>
        <a href="#acceso/registro${suffix}" ${registration ? 'aria-current="page"' : ''}>Crear cuenta</a>
      </nav>
      <form class="form-grid" id="shared-account">
        ${registration ? '<div><label for="account-alias">Alias</label><input id="account-alias" name="alias" maxlength="50" autocomplete="nickname" required></div>' : ''}
        <div><label for="account-email">Correo electrónico</label>
          <input id="account-email" name="email" type="email" autocomplete="username" maxlength="254" required></div>
        <div><label for="account-password">Contraseña</label>
          <input id="account-password" name="password" type="password" autocomplete="${registration ? 'new-password' : 'current-password'}"
            ${registration ? 'minlength="15" aria-describedby="password-hint"' : ''} maxlength="128" required>
          ${registration ? '<p class="input-hint" id="password-hint">Usa al menos 15 caracteres. Tu perfil comienza como privado.</p>' : ''}</div>
        <p class="input-error" id="access-error" role="alert" hidden></p>
        <button type="submit" class="button primary">${registration ? 'Crear cuenta' : 'Iniciar sesión'}</button>
        ${registration ? '' : `<a class="text-link" href="#acceso/recuperar${suffix}">Recuperar acceso</a>`}
      </form>`}
      <p class="input-hint"><a class="text-link" href="#perfil?local=1">Ver fichas de este navegador →</a></p>
    </section>
    <aside class="account-art"><div><p>Tu registro de observación.</p>
      <a class="text-link" href="${nasaVela}" target="_blank" rel="noopener">Región de Vela · NASA/JPL-Caltech ↗</a></div></aside>
  </div>`;
}

function accountView(id, params) {
  if (sharedMode(params)) return sharedAccountView(id, params);
  const registration = id === 'registro';
  const recovery = id === 'recuperar';
  const { profile } = readWorkspace();
  const suffix = params.get('local') === '1' ? '?local=1' : '';
  const title = recovery ? 'Recuperar acceso' : registration ? 'Crear perfil local' : 'Accede a tu espacio';
  return `<div class="account-layout">
    <section class="panel">
      ${pageHeading(title, 'Guarda tu alias, tus comparaciones y tus fichas en este navegador.', '', true)}
      ${recovery ? `<form class="form-grid" id="local-account">
        <div class="avatar-block">${avatar(profile)}<strong>${escapeHtml(profile.alias)}</strong></div>
        <p class="muted">Recupera el perfil y las fichas guardados en este navegador.</p>
        <p class="input-error" id="access-error" role="alert" hidden></p>
        <button type="submit" class="button primary">Recuperar perfil local</button>
      </form>` : `
      <nav class="segmented" aria-label="Acceso y registro">
        <a href="#acceso${suffix}" ${registration ? '' : 'aria-current="page"'}>Abrir espacio</a>
        <a href="#acceso/registro${suffix}" ${registration ? 'aria-current="page"' : ''}>Crear perfil</a>
      </nav>
      <form class="form-grid" id="local-account">
        ${registration ? '<div><label for="account-alias">Alias</label><input id="account-alias" name="alias" placeholder="Explorador" maxlength="50" required></div>'
          : `<div class="avatar-block">${avatar(profile)}<strong>${escapeHtml(profile.alias)}</strong></div>`}
        <p class="input-error" id="access-error" role="alert" hidden></p>
        <button type="submit" class="button primary">${registration ? 'Guardar perfil' : 'Abrir Mi espacio'} <span aria-hidden="true">→</span></button>
      </form>
      ${registration ? '' : `<a class="text-link" href="#acceso/recuperar${suffix}">Recuperar acceso</a>`}`}
    </section>
    <aside class="account-art">
      <div><p>Tu registro de observación.</p><a class="text-link" href="${nasaVela}" target="_blank" rel="noopener">Región de Vela · NASA/JPL-Caltech ↗</a></div>
    </aside>
  </div>`;
}

function bindAccount(id, params) {
  const shared = document.querySelector('#shared-account');
  shared?.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitShared(shared, document.querySelector('#access-error'), async () => {
      const registration = id === 'registro';
      const { email, password, alias } = Object.fromEntries(new FormData(shared));
      const { account } = await sharedRequest(registration ? '/register' : '/login', {
        method: 'POST', body: { email, password, ...(registration ? { alias } : {}) },
      });
      setSharedPage({ enabled: true, account });
      if (!shared.isConnected) return;
      const returnTo = params.get('volver');
      location.hash = /^#ficha(?:\/pdf)?(?:\?|$)/.test(returnTo ?? '') ? returnTo : '#perfil';
    });
  });
  const form = document.querySelector('#local-account');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = readWorkspace();
    const alias = form.elements.alias?.value.trim();
    const error = document.querySelector('#access-error');
    if (state.profile.paused || (form.elements.alias && !alias)) {
      error.textContent = state.profile.paused ? 'El perfil local está pausado. Puedes reactivarlo desde Administración.' : 'Escribe un alias.';
      error.hidden = false;
      return;
    }
    if (alias) state.profile.alias = alias;
    state.profile.active = true;
    writeWorkspace(state);
    location.hash = params.get('local') === '1' ? 'perfil?local=1' : 'perfil';
  });
}

function profileView(_id, params) {
  const shared = sharedMode(params);
  const local = readWorkspace();
  const profile = shared ? sharedPage.account : local.profile;
  if (!profile) return `${pageHeading('Mi espacio', 'Inicia sesión para acceder a tus fichas compartidas.')}
    <div class="row"><a class="button primary" href="#acceso">Iniciar sesión</a>
    <a class="button secondary" href="#perfil?local=1">Ver fichas locales</a></div>`;
  const recent = local.recent;
  const myReports = shared ? sharedPage.reports ?? [] : local.reports;
  const contributions = myReports.filter((report) => ['accepted', 'published'].includes(report.status));
  const suffix = !shared && sharedPage.enabled ? '?local=1' : '';
  return `${pageHeading('Mi espacio', shared
    ? 'Retoma tus fichas y consulta las decisiones del equipo revisor.'
    : 'Retoma tus comparaciones y consulta el estado de tus fichas guardadas en este navegador.', '', true)}
    <div class="workplace">
      <div class="stack">
        <section class="panel">
          <div class="row between"><h2>Mis fichas</h2><a class="button primary" href="#ficha${suffix}">Nueva ficha</a></div>
          ${myReports.length ? `<ul class="item-list">${myReports.map((report) => `<li>
            <div class="row between"><a class="list-title" href="#confirmacion/${report.id}">${escapeHtml(report.title)}</a>${statusBadge(report)}</div>
            <div class="list-meta">${dateMark(report.created)} · ${escapeHtml(report.author)}</div>
            ${report.reviewNote ? `<p class="muted preserve-lines">${escapeHtml(report.reviewNote)}</p>` : ''}
            ${['draft', 'rejected'].includes(report.status) ? `<a class="text-link" href="${editURL(report)}">Editar ficha →</a>` : ''}
          </li>`).join('')}</ul>` : '<p class="muted">Aquí aparecerán las fichas que guardes desde el comparador.</p>'}
        </section>
        <section class="panel">
          <h2>Comparaciones recientes</h2>
          ${recent.length ? `<ul class="item-list">${recent.map((entry) => `<li class="row between">
            <div><a class="list-title" href="${escapeHtml(comparisonLink(entry))}">${fieldName(entry.query)}</a>
              <p class="list-meta">${dateMark(entry.viewedAt, true)} · RA ${entry.query.ra_deg}° · Dec ${entry.query.dec_deg}°</p></div>
            ${badge(comparisonMode(entry), entry.mode === 'prepared' ? 'success' : 'info')}
          </li>`).join('')}</ul>` : '<p class="muted">Las comparaciones que abras aparecerán aquí.</p>'}
        </section>
      </div>
      <aside class="panel workspace-details">
        <div class="avatar-block">${avatar(profile)}
          <div class="wrap"><h2>${escapeHtml(profile.alias)}</h2><small class="dim">${shared ? escapeHtml(profile.email) : 'Perfil local'}</small></div>
        </div>
        <p><strong>Insignias</strong><br>${contributions.length ? badge('Primera contribución', 'success', false) : 'Aún no hay insignias.'}</p>
        <a class="button secondary" href="#ajustes${suffix}">Editar perfil</a>
        ${profile.public ? `<a class="text-link" href="${shared ? `#publico/${profile.id}` : `#publico${suffix}`}">Ver perfil público →</a>` : ''}
        ${shared && canReview(profile) ? '<a class="text-link" href="#administracion">Bandeja de revisión →</a>' : ''}
        ${shared ? '<a class="text-link" href="#perfil?local=1">Ver fichas de este navegador →</a>' : ''}
        ${!shared && sharedPage.enabled ? '<a class="text-link" href="#perfil">Abrir mi cuenta →</a>' : ''}
      </aside>
    </div>`;
}

function publicProfileView(id, params) {
  const publicProfile = id ? sharedPage.publicProfile : readWorkspace();
  if (!publicProfile) return missingView();
  const { profile, reports } = publicProfile;
  const suffix = params.get('local') === '1' ? '?local=1' : '';
  if (!id && !profile.public) return `${pageHeading('Perfil privado', 'Activa la vista pública en Ajustes para previsualizar tu perfil.')}
    <a class="button secondary" href="#ajustes${suffix}">Abrir ajustes</a>`;
  const published = reports.filter((report) => report.status === 'published');
  return `${back(id ? '#blog' : `#perfil${suffix}`, id ? 'Blog' : 'Mi espacio')}
    ${pageHeading(profile.alias, id ? '' : 'Vista previa del perfil público en este navegador.', '', true)}
    <section class="panel reading">
      <div class="avatar-block">${avatar(profile)}<div><h2>Contribuciones</h2>
        ${published.length ? badge('Primera contribución', 'success', false) : '<p class="muted">Aún no hay reportes publicados.</p>'}</div></div>
      <ul class="item-list">${published.map((report) => `<li><a class="text-link" href="#articulo/${report.id}">${escapeHtml(report.title)}</a></li>`).join('')}</ul>
    </section>`;
}

function settingsView(_id, params) {
  const shared = sharedMode(params);
  const profile = shared ? sharedPage.account : readWorkspace().profile;
  if (!profile) return `${pageHeading('Ajustes de perfil', 'Inicia sesión para editar tu cuenta.')}
    <a class="button primary" href="#acceso">Iniciar sesión</a>`;
  const suffix = params.get('local') === '1' ? '?local=1' : '';
  return `${back(`#perfil${suffix}`, 'Mi espacio')}
    ${pageHeading('Ajustes de perfil', 'Configura el alias y la foto que se muestran en tu espacio.', '', true)}
    <form class="panel form-grid reading" id="settings">
      ${avatar(profile)}
      <div><label for="profile-name">Alias visible</label>
        <input id="profile-name" name="alias" required maxlength="50" value="${escapeHtml(profile.alias)}"></div>
      <div><label for="profile-photo">Foto de perfil</label>
        <input id="profile-photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="photo-hint">
        <p class="input-hint" id="photo-hint">PNG, JPEG o WebP de hasta 1 MB.</p></div>
      <label class="check-label"><input type="checkbox" name="public" ${profile.public ? 'checked' : ''}> ${shared ? 'Mostrar mi alias, foto y fichas publicadas en un perfil público' : 'Habilitar la vista previa del perfil público'}</label>
      <p class="input-error" id="settings-error" role="alert" hidden></p>
      <div class="row"><button class="button primary" type="submit">Guardar cambios</button>
        ${shared || profile.active ? `<button class="button ghost" id="sign-out" type="button">${shared ? 'Cerrar sesión' : 'Cerrar espacio local'}</button>` : ''}
      </div>
    </form>`;
}

function bindSettings(_id, params) {
  const form = document.querySelector('#settings');
  if (!form) return;
  const error = document.querySelector('#settings-error');
  const shared = sharedMode(params);
  const suffix = params.get('local') === '1' ? '?local=1' : '';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const alias = form.elements.alias.value.trim();
    const file = form.elements.photo.files[0];
    if (!alias || (file && (!/^image\/(?:png|jpeg|webp)$/.test(file.type) || file.size > 1000000))) {
      error.textContent = alias ? 'Selecciona una imagen PNG, JPEG o WebP de hasta 1 MB.' : 'Escribe un alias para el perfil.';
      error.hidden = false;
      return;
    }
    if (shared) {
      await submitShared(form, error, async () => {
        const { account } = await sharedRequest('/profile', { method: 'PATCH', body: {
          alias, public: form.elements.public.checked, ...(file ? { avatar: await fileDataUrl(file) } : {}),
        } });
        setSharedPage({ enabled: true, account });
        if (form.isConnected) location.hash = 'perfil';
      });
      return;
    }
    const state = readWorkspace();
    if (file) {
      try {
        state.profile.avatar = await fileDataUrl(file);
      } catch {
        error.textContent = 'No se pudo abrir la foto elegida.';
        error.hidden = false;
        return;
      }
    }
    if (!form.isConnected) return;
    state.profile.alias = alias;
    state.profile.public = form.elements.public.checked;
    writeWorkspace(state);
    location.hash = `perfil${suffix}`;
  });
  document.querySelector('#sign-out')?.addEventListener('click', () => {
    if (shared) {
      void submitShared(form, error, async () => {
        await sharedRequest('/logout', { method: 'POST' });
        setSharedPage({ enabled: true, account: null });
        reportBuffer = undefined;
        if (form.isConnected) location.hash = 'acceso';
      });
      return;
    }
    const state = readWorkspace();
    state.profile.active = false;
    writeWorkspace(state);
    location.hash = `acceso${suffix}`;
  });
}

function moderationView(id, params) {
  const state = readWorkspace();
  const shared = sharedMode(params);
  if (shared && !canReview(sharedPage.account)) return `${pageHeading('Revisión de fichas', sharedPage.account
    ? 'Usa Mi espacio para consultar el estado de tus fichas.' : 'Inicia sesión con una cuenta revisora.')}
    <div class="row"><a class="button primary" href="${sharedPage.account ? '#perfil' : '#acceso'}">${sharedPage.account ? 'Ir a Mi espacio' : 'Iniciar sesión'}</a>
    <a class="button secondary" href="#administracion?local=1">Abrir revisión local</a></div>`;
  const users = !shared && id === 'usuarios';
  const suffix = !shared && sharedPage.enabled ? '?local=1' : '';
  const queue = shared ? sharedPage.reports ?? [] : state.reports.filter((report) => report.status !== 'draft');
  const selected = shared ? sharedPage.report : queue.find((report) => report.id === id) ?? queue[0];
  return `${pageHeading(shared ? 'Revisión de fichas' : 'Administración', shared
    ? 'Consulta la evidencia y deja una decisión para el autor.'
    : 'Revisa fichas, publica reportes en el blog local y gestiona el perfil de este navegador.', '', true)}
    <div class="gallery-tools">
      ${shared ? '<a class="text-link" href="#perfil">← Mi espacio</a>' : `<nav class="segmented" aria-label="Áreas de administración">
        <a href="#administracion${suffix}" ${users ? '' : 'aria-current="page"'}>Reportes</a>
        <a href="#administracion/usuarios${suffix}" ${users ? 'aria-current="page"' : ''}>Usuarios</a>
      </nav>`}
    </div>
    ${users ? usersPanel(state.profile) : `<div class="moderation-list">
      <section class="panel">
        <h2>Bandeja de revisión</h2>
        <ul class="item-list">${queue.map((report) => `<li>
          <div class="row between"><a class="list-title ${selected?.id === report.id ? 'selected' : ''}" href="#administracion/${report.id}${suffix}">${escapeHtml(report.title)}</a>${statusBadge(report)}</div>
          <p class="list-meta">${escapeHtml(report.author)} · ${dateMark(report.created)}</p>
        </li>`).join('')}</ul>
        ${queue.length ? '' : `<p class="muted">${shared ? 'Todavía no hay fichas en la bandeja.' : 'Envía una ficha a revisión local para verla en esta bandeja.'}</p>`}
      </section>
      ${selected ? reviewPanel(selected) : ''}
    </div>`}`;
}

function usersPanel(profile) {
  return `<section class="panel reading"><h2>Perfil de este navegador</h2>
    <table class="admin-table">
      <thead><tr><th scope="col">Perfil</th><th scope="col">Rol</th><th scope="col">Estado</th></tr></thead>
      <tbody><tr><td>${escapeHtml(profile.alias)}</td><td>Colaborador</td><td>
        <select id="demo-user-status" aria-label="Estado del perfil local">
          <option value="enabled" ${profile.paused ? '' : 'selected'}>Activo</option>
          <option value="paused" ${profile.paused ? 'selected' : ''}>Pausado</option>
        </select>
      </td></tr></tbody>
    </table>
  </section>`;
}

function reviewPanel(report) {
  const own = report.shared && report.mine;
  const canPublish = !report.shared || sharedPage.account?.role === 'admin';
  return `<section class="panel report-body">
    <div class="row between"><h2>${escapeHtml(report.title)}</h2>${statusBadge(report)}</div>
    <p class="list-meta">${escapeHtml(report.author)} · ${dateMark(report.created, true)}${report.example ? ' · Ficha de ejemplo' : ''}</p>
    <p class="muted preserve-lines">${escapeHtml(report.notes || `Documento de referencia: ${report.fileName}`)}</p>
    ${pdfButton(report)}
    ${reportEvidence(report.comparison ?? prepared, report.annotations, { reportId: report.id, from: 'administracion' })}
    ${report.status === 'review' && !own ? `<form id="moderation-form" class="form-grid" data-report="${report.id}">
      <div><label for="review-note">Mensaje de revisión</label>
        <textarea name="note" id="review-note" placeholder="Explica la decisión si rechazas el reporte." maxlength="1200"></textarea>
      </div>
      <p class="input-error" id="moderation-error" role="alert" hidden></p>
      <div class="row">
        <button class="button primary" data-decision="accepted" type="submit">Aceptar</button>
        <button class="button danger" data-decision="rejected" type="submit">Rechazar</button>
      </div>
    </form>` : own && report.status === 'review' ? '<p class="callout info">Otra persona del equipo revisará tu ficha.</p>' : ''}
    ${report.reviewNote ? `<p class="callout info preserve-lines">${escapeHtml(report.reviewNote)}</p>` : ''}
    ${report.status === 'accepted' && canPublish ? (report.shared
      ? `<form class="form-grid" id="publish-shared">
        <p class="input-hint">El Blog mostrará ${report.hasPdf ? 'el PDF y las imágenes anotadas' : 'el texto y las imágenes anotadas'} de esta ficha.</p>
        <p class="input-error" id="publish-error" role="alert" hidden></p>
        <button class="button primary" type="submit">Publicar en el Blog</button>
      </form>`
      : `<button class="button primary" id="publish-local" type="button" data-report="${report.id}">Publicar en la vista local</button>`) : ''}
    ${report.status === 'published' ? `<a class="button secondary" href="#articulo/${report.id}">Ver en el Blog</a>` : ''}
  </section>`;
}

function bindModeration(_id, params) {
  const form = document.querySelector('#moderation-form');
  const shared = sharedMode(params);
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const decision = event.submitter?.dataset.decision ?? 'accepted';
    const note = form.elements.note.value.trim();
    const error = document.querySelector('#moderation-error');
    if (decision === 'rejected' && !note) {
      error.textContent = 'Escribe un motivo para que el autor pueda corregir la ficha.';
      error.hidden = false;
      form.elements.note.focus();
      return;
    }
    if (shared) {
      const report = sharedPage.report;
      void submitShared(form, error, async () => {
        await sharedRequest(`/reports/${report.id}/decision`, {
          method: 'POST', body: { action: decision, note, revision: report.revision },
        });
        if (form.isConnected) reloadView();
      });
      return;
    }
    const state = readWorkspace();
    const report = state.reports.find((item) => item.id === form.dataset.report);
    if (report?.status !== 'review') return;
    report.status = decision;
    report.reviewNote = note;
    writeWorkspace(state);
    reloadView();
  });
  const publish = document.querySelector('#publish-shared');
  publish?.addEventListener('submit', (event) => {
    event.preventDefault();
    const report = sharedPage.report;
    void submitShared(publish, document.querySelector('#publish-error'), async () => {
      await sharedRequest(`/reports/${report.id}/decision`, {
        method: 'POST', body: { action: 'published', revision: report.revision },
      });
      if (publish.isConnected) {
        location.hash = `articulo/${report.id}`;
        toast('La ficha ya está publicada en el Blog.');
      }
    });
  });
  document.querySelector('#publish-local')?.addEventListener('click', (event) => {
    const state = readWorkspace();
    const report = state.reports.find((item) => item.id === event.currentTarget.dataset.report);
    if (report?.status !== 'accepted') return;
    report.status = 'published';
    writeWorkspace(state);
    reloadView();
    toast('Reporte disponible en el blog de este navegador.');
  });
  document.querySelector('#demo-user-status')?.addEventListener('change', (event) => {
    const state = readWorkspace();
    state.profile.paused = event.target.value === 'paused';
    if (state.profile.paused) state.profile.active = false;
    writeWorkspace(state);
    document.querySelector('#space-link').href = state.profile.active ? '#perfil' : '#acceso';
    toast(state.profile.paused ? 'Perfil de prueba pausado.' : 'Perfil de prueba activo.');
  });
}

export {
  accountView, avatar, bindAccount, bindModeration, bindReport, bindSettings, confirmationView,
  moderationView, pdfButton, profileView, publicProfileView, reportEvidence, reportView, settingsView,
};
