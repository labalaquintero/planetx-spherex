import { dateMark, epoch, escapeHtml, fieldName, imageLink, prepared } from './datos.js';

let toastTimer;

export function pageHeading(title, lead = '', eyebrow = '', compact = false) {
  return `<header class="page-heading${compact ? ' compact' : ''}">
    ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
    <h1>${escapeHtml(title)}</h1>
    ${lead ? `<p>${escapeHtml(lead)}</p>` : ''}
  </header>`;
}

export function badge(text, color = 'neutral', dot = true) {
  return `<span class="badge ${color}${dot ? ' dot' : ''}">${escapeHtml(text)}</span>`;
}

export function dataRows(rows) {
  return `<dl class="data-list">${rows.map(([label, content]) =>
    `<div><dt>${label}</dt><dd>${content}</dd></div>`).join('')}</dl>`;
}

export function back(href, text) {
  return `<a href="${escapeHtml(href)}" class="text-link back-link"><span aria-hidden="true">←</span> ${escapeHtml(text)}</a>`;
}

export function miniPair(link = false, data = prepared, reportId) {
  return `<div class="mini-pair" aria-label="Fotogramas de ${escapeHtml(fieldName(data.query))}">
    ${data.frames.map((frame, index) => {
      const figure = `<figure><img class="science-image" src="${escapeHtml(frame.src)}" data-frame-id="${escapeHtml(frame.id)}" alt="Recorte SPHEREx de la época ${epoch(index)}" width="64" height="64">
        <span class="image-error" role="alert" hidden>Imagen no disponible.</span>
        <figcaption><b>${epoch(index)}</b> ${dateMark(frame.observed_at)}</figcaption></figure>`;
      return link ? `<a href="${escapeHtml(imageLink(index, data, reportId))}" aria-label="Ampliar época ${epoch(index)}">${figure}</a>` : figure;
    }).join('')}
  </div>`;
}

export function toast(message) {
  const notice = document.querySelector('#toast');
  window.clearTimeout(toastTimer);
  notice.hidden = false;
  notice.textContent = message;
  toastTimer = window.setTimeout(() => { notice.hidden = true; }, 5600);
}

export function missingView() {
  return `${pageHeading('Vista no encontrada', 'Puedes volver al inicio o abrir el caso preparado del visor.')}
    <a class="button primary" href="#inicio">Volver al inicio</a>`;
}
