import { reportById, sharedPage } from './colaboracion.js';
import {
  archiveNote, articles, comparisonLink, dateMark, daysBetween, epoch, escapeHtml, featuredObservation, nasaSky, nasaVela, prepared,
} from './datos.js';
import { sampleObservationById, samplePublications } from './ejemplos-blog.js';
import { pdfButton, reportEvidence } from './espacio.js';
import { back, missingView } from './ui.js';
import { bindComparisonSlider, comparisonSlider } from './visor.js';
import { readWorkspace } from './workspace.js';
import './blog.css';

const [, ...guides] = articles;
const caseURL = `#articulo/${featuredObservation.id}`;
const viewerURL = '#visor/wise-0855';
const velaImage = '/observatorio/vela-spherex.jpg';
const coverByGuide = {
  'leer-epocas': { src: prepared.frames[1].src, credit: 'Campo de WISE 0855 · SPHEREx DR1', pixels: true },
  coordenadas: {
    src: '/observatorio/cielo-spherex.webp', credit: 'Mapa infrarrojo de SPHEREx · NASA/JPL-Caltech', url: nasaSky,
  },
  procedencia: {
    src: velaImage, credit: 'Región de Vela · NASA/JPL-Caltech', url: nasaVela,
  },
};

function guideCard(guide) {
  const cover = coverByGuide[guide.id];
  return `<article class="blog-guide-card">
    <div class="blog-guide-media${cover.pixels ? ' blog-guide-pixels' : ''}">
      <img src="${cover.src}" alt="" loading="lazy">
      <p>${cover.credit}</p>
    </div>
    <div class="blog-guide-copy">
      <p class="blog-kicker">${guide.category}</p>
      <h3><a href="#articulo/${guide.id}">${guide.title} <span aria-hidden="true">↗</span></a></h3>
      <p>${guide.summary}</p>
    </div>
  </article>`;
}

function observationCover() {
  return `<article class="blog-cover" aria-labelledby="blog-feature-title">
    <img class="blog-cover-sky" src="${velaImage}" alt="" fetchpriority="high">
    <div class="blog-cover-copy">
      <p class="blog-kicker">${featuredObservation.category} <span aria-hidden="true">/</span> ${featuredObservation.topic}</p>
      <h2 id="blog-feature-title">El mismo campo, <em>${Math.floor(daysBetween)} días después</em></h2>
      <p class="blog-cover-summary">${featuredObservation.summary}</p>
      <a class="button primary" href="${caseURL}">Leer la observación <span aria-hidden="true">↗</span></a>
    </div>
    <div class="blog-cover-evidence" aria-label="Vista previa de las dos exposiciones de WISE 0855">
      <p class="blog-cover-evidence-label">Campo de WISE 0855 <span>SPHEREx DR1</span></p>
      <div class="blog-cover-epochs">
        ${prepared.frames.map((frame, index) => `<figure>
          <div class="blog-cover-frame"><img src="${frame.src}" width="64" height="64" alt="Campo de WISE 0855 en la época ${epoch(index)}"></div>
          <figcaption><b>${epoch(index)}</b> ${dateMark(frame.observed_at)}</figcaption>
        </figure>`).join('')}
      </div>
    </div>
    <a class="blog-cover-credit" href="${nasaVela}" target="_blank" rel="noopener">Fondo: Región de Vela · NASA/JPL-Caltech <span aria-hidden="true">↗</span></a>
  </article>`;
}

function publicationCard(report) {
  const label = report.example ? `Ejemplo · ${escapeHtml(report.topic)}` : dateMark(report.publishedAt ?? report.created);
  return `<article class="blog-report-card">
    <p class="blog-kicker">${label}</p>
    <h3><a href="#articulo/${encodeURIComponent(report.id)}">${escapeHtml(report.title)} <span aria-hidden="true">↗</span></a></h3>
    <p>Por ${escapeHtml(report.author)}</p>
    ${report.example ? `<p class="blog-report-summary">${escapeHtml(report.summary)}</p>` : ''}
  </article>`;
}

export function blogCommunity(params, { loading = false, unavailable = false } = {}) {
  const localPublished = readWorkspace().reports.filter((report) => report.status === 'published');
  const published = loading || unavailable ? [] : sharedPage.publications ?? [];
  const page = Math.min(1000000, Math.max(0, Number.parseInt(params.get('pagina'), 10) || 0));
  const reports = page === 0 ? [...samplePublications, ...published] : published;
  return `${reports.length || loading || unavailable || sharedPage.enabled ? `<section class="blog-section" aria-labelledby="community-heading">
    <h2 class="blog-section-title" id="community-heading">Observaciones de la comunidad</h2>
    ${reports.length ? `<div class="blog-report-grid">${reports.map(publicationCard).join('')}</div>` : ''}
    ${loading ? '<p class="blog-section-note" role="status">Cargando publicaciones…</p>'
      : unavailable ? '<p class="blog-section-note" role="status">Por ahora no se pudieron cargar las publicaciones de la comunidad.</p>'
      : reports.length ? '' : '<p class="blog-section-note">No hay publicaciones en esta página.</p>'}
    ${!loading && !unavailable && (page || published.length === 30) ? `<nav class="row blog-pagination" aria-label="Páginas de fichas">
      ${page ? `<a class="button secondary" href="#blog?pagina=${page - 1}">← Anteriores</a>` : ''}
      ${published.length === 30 ? `<a class="button secondary" href="#blog?pagina=${page + 1}">Siguientes →</a>` : ''}
    </nav>` : ''}
  </section>` : ''}
  ${localPublished.length ? `<section class="blog-section" aria-labelledby="local-reports-heading">
    <h2 class="blog-section-title" id="local-reports-heading">Publicaciones de este navegador</h2>
    <div class="blog-report-grid">${localPublished.map(publicationCard).join('')}</div>
  </section>` : ''}`;
}

export function blogView(_id, params, { loadingCommunity = false } = {}) {
  return `<div class="observatory-blog">
    <header class="blog-masthead">
      <h1>Bitácora <em>del cielo</em></h1>
      <p>Observaciones de la comunidad y guías para explorar los datos de SPHEREx.</p>
    </header>
    ${observationCover()}
    <section class="blog-section" aria-labelledby="guides-heading">
      <h2 class="blog-section-title" id="guides-heading">Guías de observación</h2>
      <div class="blog-guide-grid">${guides.map(guideCard).join('')}</div>
    </section>
    <div id="blog-community">${blogCommunity(params, { loading: loadingCommunity })}</div>
  </div>`;
}

function articleHeading(title, category, lead) {
  return `<header class="blog-article-heading">
    <p class="blog-kicker">${escapeHtml(category)}</p>
    <h1>${escapeHtml(title)}</h1>
    ${lead ? `<p class="blog-article-lead">${escapeHtml(lead)}</p>` : ''}
  </header>`;
}

function articleSections(sections) {
  return sections.map(([title, content]) => `<section>
    <h2>${escapeHtml(title)}</h2><p>${escapeHtml(content)}</p>
  </section>`).join('');
}

function observationArticle() {
  const article = featuredObservation;
  return `<article class="blog-article">
    ${back('#blog', 'Volver al Blog')}
    ${articleHeading(article.title, `${article.category} / ${article.topic}`, article.summary)}
    <div class="blog-article-layout blog-sample-layout">
      <figure class="blog-compare" aria-labelledby="blog-compare-title">
        <div class="blog-compare-heading"><h2 id="blog-compare-title">Compara las dos épocas</h2><span>SPHEREx DR1</span></div>
        ${comparisonSlider('blog-comparison', 'Divisor entre las dos observaciones de WISE 0855')}
        <figcaption>Mueve el divisor para recorrer la misma región en ambas fechas.</figcaption>
      </figure>
      ${reportEvidence(article.comparison, article.annotations, { reportId: article.id, from: 'articulo' })}
      <div class="blog-article-text">
        ${articleSections(article.sections)}
        <p class="blog-science-note">${archiveNote}</p>
        <a class="button primary" href="${viewerURL}">Abrir WISE 0855 en el visor <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </article>`;
}

function guideArticle(guide) {
  const cover = coverByGuide[guide.id];
  return `<article class="blog-article blog-guide-article">
    ${back('#blog', 'Volver al Blog')}
    ${articleHeading(guide.title, guide.category, guide.summary)}
    <figure class="blog-guide-figure${cover.pixels ? ' blog-guide-pixels' : ''}">
      <img src="${cover.src}" alt="">
      <figcaption>${cover.url ? `<a href="${cover.url}" target="_blank" rel="noopener">${cover.credit} ↗</a>` : cover.credit}</figcaption>
    </figure>
    <div class="blog-article-text">
      ${articleSections(guide.sections)}
      <a class="button primary" href="${caseURL}">Revisar el caso de WISE 0855 <span aria-hidden="true">↗</span></a>
    </div>
  </article>`;
}

export function articleView(id) {
  if (id === featuredObservation.id) return observationArticle();
  const guide = guides.find((item) => item.id === id);
  if (guide) return guideArticle(guide);
  const report = sampleObservationById(id) ?? reportById(id);
  if (report?.status !== 'published') return missingView();
  const comparison = report.comparison ?? prepared;
  const category = report.example ? `Ejemplo de la comunidad / ${report.topic}`
    : report.shared ? 'Observación de la comunidad' : 'Publicación de este navegador';
  const byline = report.example ? escapeHtml(report.author)
    : `${escapeHtml(report.author)} · ${dateMark(report.publishedAt ?? report.created, true)}`;
  const difference = report.example ? comparison.difference : null;
  return `<article class="blog-article">
    ${back('#blog', 'Volver al Blog')}
    ${articleHeading(report.title, category)}
    <p class="blog-report-byline">Por ${byline}</p>
    <div class="blog-article-layout">
      <section class="blog-article-text">
        <h2>Observación</h2>
        <p class="preserve-lines">${escapeHtml(report.notes || `Documento PDF: ${report.fileName}`)}</p>
        ${pdfButton(report)}
        ${difference ? `<figure class="panel blog-report-difference">
          <img class="science-image" src="${escapeHtml(difference.image_url)}" data-frame-id="${escapeHtml(difference.id)}"
            width="64" height="64" alt="Mapa de diferencia con una franja azul alrededor del núcleo enmascarado">
          <p class="image-error" role="alert" hidden>Imagen de diferencia no disponible.</p>
          <figcaption>Brillo superficial en B menos A · SPHEREx DR1</figcaption>
        </figure>` : ''}
        ${report.example ? `<a class="button primary" href="${escapeHtml(comparisonLink(comparison))}">Abrir ${escapeHtml(report.topic)} en el visor <span aria-hidden="true">↗</span></a>` : ''}
      </section>
      ${reportEvidence(comparison, report.annotations, { reportId: report.id, from: 'articulo' })}
    </div>
  </article>`;
}

export function bindArticle() {
  bindComparisonSlider(document.querySelector('.blog-compare .wipe'));
}
