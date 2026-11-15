import { frameMarks, lastMarkedArea } from './anotaciones.js';
import {
  comparisonLink, comparisonMode, dateMark, epoch, escapeHtml, fieldLabel, fieldName,
  formatBand, fullDate, imageLink, nasaSky, prepared, reportStatuses,
} from './datos.js';
import { weeklyMark } from './insignias.js';
import { badge, dataRows } from './ui.js';
import './informe.css';

export function statusBadge(report) {
  const state = Object.hasOwn(reportStatuses, report.status) ? reportStatuses[report.status] : reportStatuses.draft;
  return badge(state.title, state.color);
}

export function pdfButton(report) {
  if (!report.hasPdf) return '';
  return report.shared
    ? `<a class="button secondary" href="/api/v1/workspace/reports/${encodeURIComponent(report.id)}/attachment">Descargar PDF</a>`
    : `<button class="button secondary" type="button" data-pdf-download="${escapeHtml(report.id)}">Descargar PDF</button>`;
}

export function reportEvidence(data, annotations, { reportId, from } = {}) {
  const editable = from === 'manual' || from === 'pdf';
  const frames = data.frames.map((frame, index) => ({ frame, index, marks: frameMarks(annotations, frame.id) }));
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

function evidenceSummary(comparison, annotations) {
  const { frames } = comparison;
  const marks = frames.reduce((total, frame) => total + frameMarks(annotations, frame.id).length, 0);
  const first = frames[0]?.observed_at;
  const last = frames.at(-1)?.observed_at;
  return `<dl class="report-summary" aria-label="Resumen de la comparación">
    <div><dt>Épocas registradas</dt><dd class="report-summary-number">${frames.length}</dd></div>
    <div><dt>Fechas UTC</dt><dd class="report-summary-dates">
      ${first ? dateMark(first) : 'No disponible'}${last && last !== first ? `<span aria-hidden="true">→</span>${dateMark(last)}` : ''}
    </dd></div>
    <div><dt>Modo</dt><dd>${comparisonMode(comparison)}</dd></div>
    <div><dt>Anotaciones</dt><dd class="report-summary-number">${marks}</dd></div>
  </dl>`;
}

function sampleDifference(difference) {
  return `<figure class="report-difference">
    <img class="science-image" src="${escapeHtml(difference.image_url)}" data-frame-id="${escapeHtml(difference.id)}"
      width="64" height="64" alt="Mapa de diferencia de brillo superficial entre las épocas B y A">
    <p class="image-error" role="alert" hidden>Imagen de diferencia no disponible.</p>
    <figcaption>Brillo superficial en B menos A · SPHEREx DR1</figcaption>
  </figure>`;
}

export function reportDocument(report, { previous, controls = '', publication = false }) {
  const comparison = report.comparison ?? prepared;
  const category = report.example ? 'Ejemplo de la comunidad' : publication
    ? (report.shared ? 'Observación de la comunidad' : 'Publicación de este navegador') : 'Ficha de observación';
  const date = publication ? report.publishedAt ?? report.created : report.created;
  const reviewNotice = !publication && report.status === 'review'
    ? (report.shared ? 'La ficha está en la bandeja del equipo revisor.' : 'La ficha está en la bandeja de revisión de este navegador.') : '';
  return `<article class="report-document${publication ? '' : ' report-confirmation'}" aria-labelledby="report-title">
    <nav class="report-document-nav" aria-label="Acciones de la ficha">${previous}${controls}</nav>
    <header class="report-cover">
      <img class="report-cover-sky" src="/observatorio/cielo-spherex.webp" alt="">
      <div class="report-cover-content">
        <div class="row">
          <p class="eyebrow">${category}</p>
          ${publication ? '' : statusBadge(report)}
          ${weeklyMark(report.weeklyPick)}
        </div>
        <h1 id="report-title">${escapeHtml(report.title)}</h1>
        <p class="report-author">Por <strong>${escapeHtml(report.author)}</strong>${date ? ` <span aria-hidden="true">·</span> ${dateMark(date, true)}` : ''}</p>
      </div>
      <a class="report-cover-credit" href="${nasaSky}" target="_blank" rel="noopener">Mosaico SPHEREx · NASA/JPL-Caltech <span aria-hidden="true">↗</span></a>
    </header>
    ${evidenceSummary(comparison, report.annotations)}
    ${reviewNotice ? `<p class="callout info report-review-notice">${reviewNotice}</p>` : ''}
    <div class="report-document-grid">
      <section class="panel report-observation" aria-labelledby="report-observation-title">
        <h2 class="section-title" id="report-observation-title">Observación</h2>
        ${report.notes ? `<p class="observation-text preserve-lines">${escapeHtml(report.notes)}</p>` : ''}
        ${report.fileName || report.hasPdf ? `<div class="report-attachment">
          <div><h3>Documento adjunto</h3>${report.fileName ? `<p>${escapeHtml(report.fileName)}</p>` : ''}</div>
          ${pdfButton(report)}
        </div>` : ''}
        ${!publication && report.reviewNote ? `<div class="callout report-review-note ${report.status === 'rejected' ? 'danger' : 'info'}">
          <h3>Comentario de revisión</h3><p class="preserve-lines">${escapeHtml(report.reviewNote)}</p>
        </div>` : ''}
        ${report.example && comparison.difference ? sampleDifference(comparison.difference) : ''}
        ${report.example ? `<a class="button primary" href="${escapeHtml(comparisonLink(comparison))}">Abrir ${escapeHtml(report.topic)} en el visor <span aria-hidden="true">↗</span></a>` : ''}
      </section>
      ${reportEvidence(comparison, report.annotations, { reportId: report.id, from: publication ? 'articulo' : undefined })}
    </div>
  </article>`;
}
