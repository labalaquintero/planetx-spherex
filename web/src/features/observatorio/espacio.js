import {
  archiveNote, comparisonLink, comparisonMode, coordinateParams, dateMark, epoch, escapeHtml,
  fieldLabel, fieldName, formatBand, imageLink, nasaVela, prepared, reportStatuses,
} from './datos.js';
import { back, badge, dataRows, miniPair, missingView, pageHeading, toast } from './ui.js';
import { comparisonFor } from './visor.js';
import { cacheImages, readWorkspace, reportFile, writeWorkspace } from './workspace.js';

let reportBuffer;

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

function reportEvidence(data, annotations, editable = true, reportId) {
  const annotationCount = data.frames.reduce((count, frame) => count + (annotations[frame.id]?.length ?? 0), 0);
  const releases = [...new Set(data.frames.map((frame) => frame.release.toUpperCase()))].join(' / ');
  return `<aside class="panel attachment-panel" aria-labelledby="attachment-title">
    <h2 id="attachment-title">Observaciones asociadas</h2>
    <p class="muted">${fieldName(data.query)} · SPHEREx ${releases}</p>
    ${miniPair(true, data, reportId)}
    ${dataRows([
      ['Banda aproximada', formatBand(data.band)],
      ['Campo', fieldLabel(data.query)],
      ['Procedencia', 'Cada fotograma conserva su fecha, ID y enlace FITS.'],
    ])}
    ${editable ? `<a class="text-link" href="${escapeHtml(imageLink(0, data, reportId))}">Ampliar y anotar <span aria-hidden="true">→</span></a>` : ''}
    ${annotationCount ? `<p class="input-hint">${editable ? 'Marcas locales disponibles' : 'Marcas en la ficha'}: ${annotationCount}</p>` : ''}
  </aside>`;
}

function draftKey(params, data) {
  return params.get('borrador') || String(coordinateParams(data.query));
}

function reportView(id, params) {
  const state = readWorkspace();
  const reportId = params.get('borrador') ?? '';
  const existing = state.reports.find((item) => item.id === reportId && ['draft', 'rejected'].includes(item.status));
  if (reportId && !existing) return missingView();
  const data = existing ? existing.comparison ?? prepared : comparisonFor(params);
  if (!data) return `${pageHeading('Vuelve a abrir la comparación', 'Abre las observaciones antes de preparar una ficha de este campo.')}
    <a class="button primary" href="#visor?${escapeHtml(params)}">Abrir el comparador</a>`;
  const format = id === 'pdf' ? 'pdf' : 'manual';
  const buffered = reportBuffer?.key === draftKey(params, data) ? reportBuffer : null;
  const draft = buffered ?? existing;
  const created = draft?.created ?? new Date().toISOString();
  const links = coordinateParams(data.query);
  if (existing) links.set('borrador', existing.id);
  const search = `?${escapeHtml(links)}`;
  return `${back(comparisonLink(data), 'Volver al comparador')}
    ${pageHeading(existing ? 'Editar ficha de observación' : 'Ficha de observación',
      'Describe lo que observaste y conserva la evidencia del campo comparado.', '', true)}
    <div class="split">
      <section class="panel report-body">
        <nav class="segmented" aria-label="Formato del reporte">
          <a href="#ficha${search}" ${format === 'manual' ? 'aria-current="page"' : ''}>Escribir ficha</a>
          <a href="#ficha/pdf${search}" ${format === 'pdf' ? 'aria-current="page"' : ''}>Adjuntar PDF</a>
        </nav>
        <form class="form-grid" id="report-form" data-format="${format}" data-existing="${escapeHtml(existing?.id ?? '')}" data-created="${escapeHtml(created)}">
          <div><label for="report-author">Autor o alias</label>
            <input id="report-author" name="author" maxlength="60" placeholder="¿Cómo quieres firmar?" required value="${escapeHtml(draft?.author ?? (state.profile.active ? state.profile.alias : ''))}"></div>
          <div><label for="report-name">Título</label>
            <input id="report-name" name="title" maxlength="120" placeholder="Título de la observación" required value="${escapeHtml(draft?.title)}"></div>
          ${format === 'manual' ? `<div><label for="report-notes">Descripción de la observación</label>
            <textarea id="report-notes" name="notes" maxlength="5000" placeholder="¿Qué observaste y en qué parte de la imagen?" required>${escapeHtml(draft?.notes)}</textarea></div>`
          : `<div><label for="report-pdf">Documento PDF</label>
            <input id="report-pdf" name="pdf" type="file" accept="application/pdf,.pdf" aria-describedby="pdf-hint">
            <p class="input-hint" id="pdf-hint">Incluye autor, título, texto e imágenes o sus referencias. Puedes adjuntar un PDF de hasta 10 MB. El archivo se guarda en este navegador.</p>
            ${draft?.fileName ? `<p class="input-hint">Archivo anterior: ${escapeHtml(draft.fileName)}</p>` : ''}</div>`}
          <p class="input-hint">Fecha de creación · ${dateMark(created, true)}</p>
          <p class="input-error" id="report-error" role="alert" hidden></p>
          <div class="row form-actions">
            <button class="button primary" type="submit" data-intent="draft">Guardar borrador</button>
            <button class="button secondary" type="submit" data-intent="review">Enviar a revisión local</button>
          </div>
          <div class="row">
            <button class="button ghost" type="submit" data-intent="json">Descargar JSON</button>
            <button class="button ghost" type="submit" data-intent="md">Descargar Markdown</button>
          </div>
          <p class="input-hint">Las fichas y sus revisiones se guardan en este navegador.</p>
        </form>
      </section>
      ${reportEvidence(data, { ...existing?.annotations, ...state.annotations }, true, existing?.id)}
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
  return report.hasPdf
    ? `<button class="button secondary" type="button" data-pdf-download="${escapeHtml(report.id)}">Descargar PDF</button>`
    : '';
}

function exportButtons(report) {
  return ['json', 'md'].map((type) =>
    `<button class="button ghost" type="button" data-report-export="${type}" data-report-id="${escapeHtml(report.id)}">Descargar ${type === 'json' ? 'JSON' : 'Markdown'}</button>`).join('');
}

document.addEventListener('click', async (event) => {
  const exportControl = event.target.closest('[data-report-export]');
  if (exportControl) {
    const report = readWorkspace().reports.find((item) => item.id === exportControl.dataset.reportId);
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
  const { format, existing, created } = form.dataset;
  const earlier = readWorkspace().reports.find((report) => report.id === existing);
  const data = earlier ? earlier.comparison ?? prepared : comparisonFor(params);
  const key = draftKey(params, data);

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
    const annotations = { ...earlier?.annotations, ...readWorkspace().annotations };
    const report = {
      id: existing || crypto.randomUUID(), author, title, notes, format, fileName, created,
      status: action === 'review' ? 'review' : 'draft',
      comparison: data,
      annotations: Object.fromEntries(data.frames
        .filter((frame) => Array.isArray(annotations[frame.id]))
        .map((frame) => [frame.id, annotations[frame.id]])),
    };
    if (action === 'json' || action === 'md') {
      exportReport(report, action);
      if (fileName) reportBuffer = { key, author, title, notes, created, fileName, file };
      toast(`Ficha descargada en ${action === 'json' ? 'JSON' : 'Markdown'}.`);
      return;
    }
    if (format === 'pdf') {
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
    const state = readWorkspace();
    if (existing && !state.reports.some((item) => item.id === existing && ['draft', 'rejected'].includes(item.status))) {
      error.textContent = 'El estado de esta ficha cambió. Vuelve a abrirla antes de guardar.';
      error.hidden = false;
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
  const report = readWorkspace().reports.find((item) => item.id === id);
  if (!report) return missingView();
  const lead = report.status === 'review'
    ? 'La ficha se registró en la bandeja de revisión de este navegador.'
    : 'La ficha y sus referencias están disponibles en este navegador.';
  return `${back('#perfil', 'Mi espacio')}
    ${pageHeading(report.status === 'review' ? 'Ficha en revisión' : report.status === 'draft' ? 'Borrador guardado' : 'Estado de tu ficha', lead, '', true)}
    <div class="split">
    <section class="panel report-confirmation">
      <div class="row between"><h2>${escapeHtml(report.title)}</h2>${statusBadge(report)}</div>
      <p class="muted">${escapeHtml(report.author)} · ${dateMark(report.created, true)}</p>
      ${report.notes || report.fileName ? `<p class="preserve-lines">${escapeHtml(report.notes || report.fileName)}</p>` : ''}
      ${report.reviewNote ? `<p class="callout ${report.status === 'rejected' ? 'danger' : 'info'}">${escapeHtml(report.reviewNote)}</p>` : ''}
      <div class="row">
        <a class="button primary" href="#perfil">Ver mis fichas</a>
        ${pdfButton(report)}
        ${['draft', 'rejected'].includes(report.status) ? `<a class="button secondary" href="${editURL(report)}">Editar ficha</a>` : ''}
        ${report.status === 'review' ? `<a class="button secondary" href="#administracion/${report.id}">Ver bandeja de revisión</a>` : ''}
        ${report.status === 'published' ? `<a class="button secondary" href="#articulo/${report.id}">Ver publicación</a>` : ''}
      </div>
      <div class="row">${exportButtons(report)}</div>
    </section>
    ${reportEvidence(report.comparison ?? prepared, report.annotations ?? {}, false, report.id)}
    </div>`;
}

function editURL(report) {
  return `#ficha${report.format === 'pdf' ? '/pdf' : ''}?borrador=${encodeURIComponent(report.id)}`;
}

function accountView(id) {
  const registration = id === 'registro';
  const recovery = id === 'recuperar';
  const { profile } = readWorkspace();
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
        <a href="#acceso" ${registration ? '' : 'aria-current="page"'}>Abrir espacio</a>
        <a href="#acceso/registro" ${registration ? 'aria-current="page"' : ''}>Crear perfil</a>
      </nav>
      <form class="form-grid" id="local-account">
        ${registration ? '<div><label for="account-alias">Alias</label><input id="account-alias" name="alias" placeholder="Explorador" maxlength="50" required></div>'
          : `<div class="avatar-block">${avatar(profile)}<strong>${escapeHtml(profile.alias)}</strong></div>`}
        <p class="input-error" id="access-error" role="alert" hidden></p>
        <button type="submit" class="button primary">${registration ? 'Guardar perfil' : 'Abrir Mi espacio'} <span aria-hidden="true">→</span></button>
      </form>
      ${registration ? '' : '<a class="text-link" href="#acceso/recuperar">Recuperar acceso</a>'}`}
    </section>
    <aside class="account-art">
      <div><p>Tu registro de observación.</p><a class="text-link" href="${nasaVela}" target="_blank" rel="noopener">Región de Vela · NASA/JPL-Caltech ↗</a></div>
    </aside>
  </div>`;
}

function bindAccount() {
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
    location.hash = 'perfil';
  });
}

function profileView() {
  const { profile, reports, recent } = readWorkspace();
  const myReports = reports.filter((report) => !report.example);
  const contributions = myReports.filter((report) => ['accepted', 'published'].includes(report.status));
  return `${pageHeading('Mi espacio', 'Retoma tus comparaciones y consulta el estado de tus fichas guardadas en este navegador.', '', true)}
    <div class="workplace">
      <div class="stack">
        <section class="panel">
          <div class="row between"><h2>Mis fichas</h2><a class="button primary" href="#ficha">Nueva ficha</a></div>
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
          <div class="wrap"><h2>${escapeHtml(profile.alias)}</h2><small class="dim">Perfil local</small></div>
        </div>
        <p><strong>Insignias</strong><br>${contributions.length ? badge('Primera contribución', 'success', false) : 'Aún no hay insignias.'}</p>
        <a class="button secondary" href="#ajustes">Editar perfil</a>
        ${profile.public ? '<a class="text-link" href="#publico">Vista de perfil público →</a>' : ''}
      </aside>
    </div>`;
}

function publicProfileView() {
  const { profile, reports } = readWorkspace();
  if (!profile.public) return `${pageHeading('Perfil privado', 'Activa la vista pública en Ajustes para previsualizar tu perfil.')}
    <a class="button secondary" href="#ajustes">Abrir ajustes</a>`;
  const shared = reports.filter((report) => report.status === 'published' && !report.example);
  return `${back('#perfil', 'Mi espacio')}
    ${pageHeading(profile.alias, 'Vista previa del perfil público en este navegador.', '', true)}
    <section class="panel reading">
      <div class="avatar-block">${avatar(profile)}<div><h2>Contribuciones</h2>
        ${shared.length ? badge('Primera contribución', 'success', false) : '<p class="muted">Aún no hay reportes publicados.</p>'}</div></div>
      <ul class="item-list">${shared.map((report) => `<li><a class="text-link" href="#articulo/${report.id}">${escapeHtml(report.title)}</a></li>`).join('')}</ul>
    </section>`;
}

function settingsView() {
  const { profile } = readWorkspace();
  return `${back('#perfil', 'Mi espacio')}
    ${pageHeading('Ajustes de perfil', 'Configura el alias y la foto que se muestran en tu espacio.', '', true)}
    <form class="panel form-grid reading" id="settings">
      ${avatar(profile)}
      <div><label for="profile-name">Alias visible</label>
        <input id="profile-name" name="alias" required maxlength="50" value="${escapeHtml(profile.alias)}"></div>
      <div><label for="profile-photo">Foto de perfil</label>
        <input id="profile-photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="photo-hint">
        <p class="input-hint" id="photo-hint">PNG, JPEG o WebP de hasta 1 MB.</p></div>
      <label class="check-label"><input type="checkbox" name="public" ${profile.public ? 'checked' : ''}> Habilitar la vista previa del perfil público</label>
      <p class="input-error" id="settings-error" role="alert" hidden></p>
      <div class="row"><button class="button primary" type="submit">Guardar cambios</button>
        ${profile.active ? '<button class="button ghost" id="sign-out" type="button">Cerrar espacio local</button>' : ''}
      </div>
    </form>`;
}

function bindSettings() {
  const form = document.querySelector('#settings');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const alias = form.elements.alias.value.trim();
    const file = form.elements.photo.files[0];
    const error = document.querySelector('#settings-error');
    if (!alias || (file && (!/^image\/(?:png|jpeg|webp)$/.test(file.type) || file.size > 1000000))) {
      error.textContent = alias ? 'Selecciona una imagen PNG, JPEG o WebP de hasta 1 MB.' : 'Escribe un alias para el perfil.';
      error.hidden = false;
      return;
    }
    const state = readWorkspace();
    if (file) {
      try {
        state.profile.avatar = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
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
    location.hash = 'perfil';
  });
  document.querySelector('#sign-out')?.addEventListener('click', () => {
    const state = readWorkspace();
    state.profile.active = false;
    writeWorkspace(state);
    location.hash = 'acceso';
  });
}

function moderationView(id) {
  const state = readWorkspace();
  const users = id === 'usuarios';
  const queue = state.reports.filter((report) => report.status !== 'draft');
  const selected = queue.find((report) => report.id === id) ?? queue[0];
  return `${pageHeading('Administración', 'Revisa fichas, publica reportes en el blog local y gestiona el perfil de este navegador.', '', true)}
    <div class="gallery-tools">
      <nav class="segmented" aria-label="Áreas de administración">
        <a href="#administracion" ${users ? '' : 'aria-current="page"'}>Reportes</a>
        <a href="#administracion/usuarios" ${users ? 'aria-current="page"' : ''}>Usuarios</a>
      </nav>
    </div>
    ${users ? usersPanel(state.profile) : `<div class="moderation-list">
      <section class="panel">
        <h2>Bandeja de revisión</h2>
        <ul class="item-list">${queue.map((report) => `<li>
          <div class="row between"><a class="list-title ${selected?.id === report.id ? 'selected' : ''}" href="#administracion/${report.id}">${escapeHtml(report.title)}</a>${statusBadge(report)}</div>
          <p class="list-meta">${escapeHtml(report.author)} · ${dateMark(report.created)}</p>
        </li>`).join('')}</ul>
        ${queue.length ? '' : '<p class="muted">Envía una ficha a revisión local para verla en esta bandeja.</p>'}
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
  return `<section class="panel report-body">
    <div class="row between"><h2>${escapeHtml(report.title)}</h2>${statusBadge(report)}</div>
    <p class="list-meta">${escapeHtml(report.author)} · ${dateMark(report.created, true)}${report.example ? ' · Ficha de ejemplo' : ''}</p>
    <p class="muted preserve-lines">${escapeHtml(report.notes || `Documento de referencia: ${report.fileName}`)}</p>
    <div class="row">
      <a class="text-link" href="${escapeHtml(imageLink(0, report.comparison ?? prepared, report.id))}">Abrir las observaciones asociadas →</a>
      ${pdfButton(report)}
    </div>
    ${report.status === 'review' ? `<form id="moderation-form" class="form-grid" data-report="${report.id}">
      <div><label for="review-note">Mensaje de revisión</label>
        <textarea name="note" id="review-note" placeholder="Explica la decisión si rechazas el reporte." maxlength="1200"></textarea>
      </div>
      <p class="input-error" id="moderation-error" role="alert" hidden></p>
      <div class="row">
        <button class="button primary" data-decision="accepted" type="submit">Aceptar</button>
        <button class="button danger" data-decision="rejected" type="submit">Rechazar</button>
      </div>
    </form>` : ''}
    ${report.reviewNote ? `<p class="callout info preserve-lines">${escapeHtml(report.reviewNote)}</p>` : ''}
    ${report.status === 'accepted' ? `<button class="button primary" id="publish-local" type="button" data-report="${report.id}">Publicar en la vista local</button>` : ''}
    ${report.status === 'published' ? `<a class="button secondary" href="#articulo/${report.id}">Ver en el Blog</a>` : ''}
  </section>`;
}

function bindModeration() {
  const form = document.querySelector('#moderation-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const decision = event.submitter?.dataset.decision ?? 'accepted';
    const note = form.elements.note.value.trim();
    if (decision === 'rejected' && !note) {
      const error = document.querySelector('#moderation-error');
      error.textContent = 'Escribe un motivo para que el autor pueda corregir la ficha.';
      error.hidden = false;
      form.elements.note.focus();
      return;
    }
    const state = readWorkspace();
    const report = state.reports.find((item) => item.id === form.dataset.report);
    if (report?.status !== 'review') return;
    report.status = decision;
    report.reviewNote = note;
    writeWorkspace(state);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  document.querySelector('#publish-local')?.addEventListener('click', (event) => {
    const state = readWorkspace();
    const report = state.reports.find((item) => item.id === event.currentTarget.dataset.report);
    if (report?.status !== 'accepted') return;
    report.status = 'published';
    writeWorkspace(state);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
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
