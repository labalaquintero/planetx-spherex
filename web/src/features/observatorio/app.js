import {
  articles, comparisonLink, comparisonMode, coordinateParams, dateMark, daysBetween, escapeHtml, fieldLabel,
  fold, formatBand, fullDate, nasaSky, nasaVela, prepared, targets,
} from './datos.js';
import {
  accountView, avatar, bindAccount, bindModeration, bindReport, bindSettings, confirmationView,
  moderationView, pdfButton, profileView, publicProfileView, reportEvidence, reportView, settingsView,
} from './espacio.js';
import { back, badge, dataRows, miniPair, missingView, pageHeading } from './ui.js';
import {
  bindComparisonSlider, bindInspector, bindViewer, cancelSearch, comparisonFor, comparisonSlider,
  inspectorView, stopPlayback, viewerExamples, viewerView,
} from './visor.js';
import { bindEvidenceImages, readWorkspace } from './workspace.js';

const main = document.querySelector('main');
const menu = document.querySelector('#menu-toggle');
const nav = document.querySelector('#site-nav');
const search = document.querySelector('#search-dialog');
const searchInput = document.querySelector('#site-search');
const searchResults = document.querySelector('#search-results');
function homeView() {
  const workspace = readWorkspace();
  const published = workspace.reports.find((report) => report.status === 'published');
  return `<section class="hero" id="home-hero" aria-labelledby="home-title">
    <img class="hero-photo" src="/observatorio/cielo-spherex.webp" alt="" fetchpriority="high">
    <div class="shell hero-content">
      <div class="hero-copy">
        <p class="eyebrow"><span aria-hidden="true">✦</span> Observaciones infrarrojas de SPHEREx</p>
        <h1 id="home-title">El cielo a través<br><em>del tiempo</em></h1>
        <p>Vuelve a mirar la misma región del cielo en otra fecha. Compara las imágenes y sigue cada observación hasta su fuente original.</p>
        <div class="row hero-actions">
          <a class="button primary" href="#visor/wise-0855">Comparar WISE 0855 <span aria-hidden="true">→</span></a>
          <a class="button secondary" href="#galeria">Explorar galería</a>
        </div>
      </div>
      <section class="hero-preview" aria-labelledby="preview-title">
        <header class="hero-preview-head">
          <div><p class="eyebrow">Comparación interactiva</p><h2 id="preview-title">WISE 0855</h2></div>
          <span class="badge success">SPHEREx DR1</span>
        </header>
        ${comparisonSlider('vista-previa', 'Comparar las dos épocas de WISE 0855')}
        <footer class="hero-preview-foot"><span>${Math.floor(daysBetween)} días entre épocas</span><span>Arrastra el divisor</span></footer>
      </section>
    </div>
    <div class="shell hero-credit">
      <a class="photo-credit" href="${nasaSky}" target="_blank" rel="noopener">Mosaico infrarrojo de SPHEREx · NASA/JPL-Caltech <span aria-hidden="true">↗</span></a>
    </div>
  </section>
  <section class="shell home-section home-entry" aria-labelledby="featured-title">
    <div class="section-heading">
      <h2 id="featured-title">Explora el cielo</h2>
      <div class="row home-links">
        ${workspace.recent.length ? '<a class="text-link" href="#perfil">Comparaciones recientes <span aria-hidden="true">→</span></a>' : ''}
        <a class="text-link" href="#articulo/leer-epocas">Guía para comparar épocas <span aria-hidden="true">→</span></a>
      </div>
    </div>
    <div class="home-grid">
      <a class="panel shortcut" href="#visor"><span class="shortcut-icon" aria-hidden="true">◎</span>
        <span><strong>Buscar por coordenadas</strong><small>Introduce RA y Dec en el visor.</small></span><span class="shortcut-arrow" aria-hidden="true">↗</span></a>
      <a class="panel shortcut" href="#galeria?vista=mapa"><span class="shortcut-icon" aria-hidden="true">✦</span>
        <span><strong>Explorar los cinco campos</strong><small>Localiza los objetivos del reto.</small></span><span class="shortcut-arrow" aria-hidden="true">↗</span></a>
      <a class="panel shortcut" href="#ficha"><span class="shortcut-icon" aria-hidden="true">≡</span>
        <span><strong>Preparar una ficha</strong><small>Guarda tus notas con la evidencia.</small></span><span class="shortcut-arrow" aria-hidden="true">↗</span></a>
    </div>
  </section>
  ${published ? `<section class="shell home-section panel row between" aria-label="Reporte reciente">
    <div><p class="eyebrow">Reporte publicado en este navegador</p>
      <h2>${escapeHtml(published.title)}</h2></div>
    <a class="text-link" href="#articulo/${published.id}">Leer en el Blog <span aria-hidden="true">→</span></a>
  </section>` : ''}`;
}

function bindHome() {
  const hero = main.querySelector('#home-hero');
  bindComparisonSlider(hero.querySelector('.wipe'));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tick = 0;
  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || motion.matches || event.target.closest('.hero-preview')) return;
    const bounds = hero.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 18;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 12;
    window.cancelAnimationFrame(tick);
    tick = window.requestAnimationFrame(() => {
      hero.style.setProperty('--photo-x', `${x}px`);
      hero.style.setProperty('--photo-y', `${y}px`);
    });
  });
  hero.addEventListener('pointerleave', () => {
    window.cancelAnimationFrame(tick);
    hero.style.setProperty('--photo-x', '0px');
    hero.style.setProperty('--photo-y', '0px');
  });
}

function skyPosition(target) {
  return `--ra:${target.ra / 360 * 100}%; --dec:${(90 - target.dec) / 180 * 100}%`;
}

function targetComparison({ ra, dec }) {
  const data = comparisonFor(new URLSearchParams({ ra, dec }));
  return data?.frames.length >= 2 ? data : null;
}

function targetCard(target) {
  const pair = targetComparison(target);
  const chart = `<div class="sky-marker" role="img" aria-label="Posición aproximada en coordenadas ICRS"
     style="${skyPosition(target)}"><span aria-hidden="true">ICRS</span></div>`;
  return `<article class="panel target-card${pair ? ' wide' : ''}">
    ${pair ? '' : chart}
    <div>
      ${pair ? badge(comparisonMode(pair), pair.mode === 'prepared' ? 'success' : 'info') : badge('Coordenadas de referencia', 'neutral', false)}
      <h2>${target.name}</h2>
      <p>${target.type}</p>
      <p class="mono">${target.ra.toFixed(6)}° / ${target.dec.toFixed(6)}°</p>
      <a class="text-link" href="#objetivo/${target.id}" aria-label="Ver detalle de ${target.name}">Ver ficha <span aria-hidden="true">→</span></a>
    </div>
    ${pair ? miniPair(true, pair) : ''}
  </article>`;
}

function galleryView(params) {
  const map = params.get('vista') === 'mapa';
  return `${pageHeading('Galería del cielo', 'Encuentra los cinco campos del reto por nombre o ubícalos en el mapa de coordenadas.')}
    <div class="panel gallery-toolbar">
      <div class="search-field"><label for="gallery-search">Buscar objetivo</label>
        <input type="search" id="gallery-search" value="${escapeHtml(params.get('buscar') ?? '')}" placeholder="Nombre del objeto" maxlength="100"></div>
      <div class="segmented" role="group" aria-label="Filtrar objetivos">
        <button type="button" data-filter="todos" aria-pressed="true">Todos</button>
        <button type="button" data-filter="preparado" aria-pressed="false">Con secuencia</button>
        <button type="button" data-filter="coordenadas" aria-pressed="false">Solo coordenadas</button>
      </div>
      <div class="segmented gallery-layout" role="group" aria-label="Vista de la galería">
        <button type="button" data-gallery-layout="cards" aria-pressed="${!map}">Tarjetas</button>
        <button type="button" data-gallery-layout="map" aria-pressed="${map}">Mapa</button>
      </div>
    </div>
    <p class="result-count" id="gallery-count" role="status"></p>
    <div id="gallery-results"></div>`;
}

function galleryMap(targetsToShow, selected) {
  const pair = targetComparison(selected);
  return `<div class="panel atlas">
    <div class="atlas-chart">
      <h2>Mapa de campos</h2>
      <div class="atlas-axis-title">Declinación (Dec)</div>
      <div class="atlas-grid">
        <div class="atlas-y" aria-hidden="true"><span>+90°</span><span>0°</span><span>−90°</span></div>
        <div class="atlas-plot" role="group" aria-label="Campos en coordenadas ICRS">
          ${targetsToShow.map((target) => `<button type="button" class="atlas-point" style="${skyPosition(target)}"
            data-target="${target.id}" data-label-side="${target.ra > 220 ? 'left' : 'right'}"
            aria-pressed="${target === selected}" aria-label="Seleccionar ${target.name}">
            <span class="atlas-dot" aria-hidden="true"></span>
            <span class="atlas-point-label" aria-hidden="true">${target.name}</span>
          </button>`).join('')}
        </div>
        <div class="atlas-x" aria-hidden="true"><span>0°</span><span>90°</span><span>180°</span><span>270°</span><span>360°</span></div>
      </div>
      <div class="atlas-axis-title atlas-ra">Ascensión recta (RA)</div>
    </div>
    <section class="atlas-detail" aria-label="Campo seleccionado">
      <p class="eyebrow">${selected.type}</p>
      <h2>${selected.name}</h2>
      <p class="mono">RA ${selected.ra.toFixed(6)}°<br>Dec ${selected.dec.toFixed(6)}°</p>
      <label for="atlas-select">Seleccionar campo</label>
      <select id="atlas-select">${targetsToShow.map((target) => `<option value="${target.id}"
        ${target === selected ? 'selected' : ''}>${target.name}</option>`).join('')}</select>
      <div class="atlas-actions">
        <a class="button primary" href="${escapeHtml(pair ? comparisonLink(pair) : `#visor/${selected.id}`)}">${pair ? 'Comparar épocas' : 'Usar coordenadas'} <span aria-hidden="true">→</span></a>
        <a class="text-link" href="#objetivo/${selected.id}">Ver ficha <span aria-hidden="true">→</span></a>
      </div>
    </section>
  </div>`;
}

function bindGallery(_id, params) {
  const input = main.querySelector('#gallery-search');
  const buttons = [...main.querySelectorAll('[data-filter]')];
  const layouts = [...main.querySelectorAll('[data-gallery-layout]')];
  const results = main.querySelector('#gallery-results');
  const total = main.querySelector('#gallery-count');
  let filter = 'todos';
  let layout = layouts.find((button) => button.getAttribute('aria-pressed') === 'true').dataset.galleryLayout;
  let selectedId = 'wise-0855';

  function update() {
    const query = fold(input.value);
    const matching = targets.filter((target) => {
      const hasPair = Boolean(targetComparison(target));
      const matchesMode = filter === 'todos' || (filter === 'preparado' ? hasPair : !hasPair);
      return matchesMode && fold(`${target.name} ${target.type}`).includes(query);
    });
    total.textContent = `${matching.length} de ${targets.length} objetivos`;
    results.classList.toggle('gallery-grid', layout === 'cards' && matching.length > 0);
    if (!matching.length) {
      results.innerHTML = '<p class="panel muted">No se encontraron objetivos. Prueba otro nombre o cambia el filtro.</p>';
    } else if (layout === 'map') {
      const selected = matching.find((target) => target.id === selectedId) ?? matching[0];
      selectedId = selected.id;
      results.innerHTML = galleryMap(matching, selected);
    } else {
      results.innerHTML = matching.map(targetCard).join('');
    }
    bindEvidenceImages(results);
  }
  input.addEventListener('input', update);
  buttons.forEach((button) => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    update();
  }));
  layouts.forEach((button) => button.addEventListener('click', () => {
    layout = button.dataset.galleryLayout;
    const isMap = layout === 'map';
    if (isMap) params.set('vista', 'mapa');
    else params.delete('vista');
    const query = params.toString();
    history.replaceState(history.state, '', query ? `#galeria?${query}` : '#galeria');
    setCurrentNav(isMap ? 'mapa' : 'galeria');
    layouts.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    update();
  }));
  results.addEventListener('click', (event) => {
    const point = event.target.closest('.atlas-point');
    if (!point) return;
    selectedId = point.dataset.target;
    update();
    results.querySelector('.atlas-point[aria-pressed="true"]').focus({ preventScroll: true });
  });
  results.addEventListener('change', (event) => {
    if (event.target.id !== 'atlas-select') return;
    selectedId = event.target.value;
    update();
    results.querySelector('#atlas-select').focus({ preventScroll: true });
  });
  update();
}

function targetView(id) {
  const target = targets.find((item) => item.id === id);
  if (!target) return missingView();
  const pair = targetComparison(target);

  return `${back('#galeria', 'Galería')}
    ${pageHeading(target.name, target.description, target.type)}
    <div class="split">
      <section class="panel">
        <div class="section-heading"><h2 class="section-title">${pair ? 'Épocas disponibles' : 'Campo de referencia'}</h2>
          ${pair ? badge(comparisonMode(pair), pair.mode === 'prepared' ? 'success' : 'info') : ''}</div>
        ${pair ? `<div class="target-frames">${miniPair(true, pair)}</div>`
          : '<p class="muted">Usa estas coordenadas en el visor para consultar las observaciones disponibles en IRSA.</p>'}
        <div class="row">
          <a class="button primary" href="${escapeHtml(pair ? comparisonLink(pair) : `#visor/${id}`)}">${pair ? 'Comparar épocas' : 'Usar coordenadas'} <span aria-hidden="true">→</span></a>
          ${pair ? `<a class="button secondary" href="#ficha?${escapeHtml(coordinateParams(pair.query))}">Preparar ficha</a>` : ''}
        </div>
      </section>
      <aside class="panel evidence" aria-label="Datos del campo">
        <div class="row"><h2>Ubicación y datos</h2></div>
        ${dataRows([
          ['Ascensión recta · RA', `<span class="mono">${target.ra}°</span>`],
          ['Declinación · Dec', `<span class="mono">${target.dec}°</span>`],
          ['Marco de referencia', id === 'barnard' ? 'ICRS · J2000' : 'ICRS'],
          ...(pair ? [['Campo', fieldLabel(pair.query)], ['Banda aproximada', formatBand(pair.band)],
            ['Colección', [...new Set(pair.frames.map((frame) => `SPHEREx ${frame.release.toUpperCase()}`))].join(' / ')]] : []),
        ])}
      </aside>
    </div>`;
}

function blogView() {
  const [featured, ...guides] = articles;
  const localPublished = readWorkspace().reports.filter((report) => report.status === 'published');
  return `${pageHeading('Blog de observación', 'Guías para usar el visor, interpretar las imágenes y documentar una observación.')}
    <article class="panel featured-article">
      <img src="/observatorio/vela-spherex.jpg" alt="" loading="lazy">
      <div>
        <p class="eyebrow">${featured.category}</p>
        <h2>${featured.title}</h2>
        <p>${featured.summary}</p>
        <a class="button primary" href="#articulo/${featured.id}">Leer guía <span aria-hidden="true">→</span></a>
      </div>
      <a class="photo-credit" href="${nasaVela}" target="_blank" rel="noopener">Región de Vela · NASA/JPL-Caltech <span aria-hidden="true">↗</span></a>
    </article>
    <div class="article-grid guide-grid">
      ${guides.map((article) => `<article class="panel article-tile">
        <p class="eyebrow">${article.category}</p>
        <h2>${article.title}</h2>
        <p>${article.summary}</p>
        <a class="text-link" href="#articulo/${article.id}">Leer guía <span aria-hidden="true">→</span></a>
      </article>`).join('')}
    </div>
    ${localPublished.length ? `<section class="home-section" aria-label="Reportes publicados en este navegador">
      <div class="section-heading"><h2>Reportes publicados en esta sesión</h2></div>
      <div class="article-grid">${localPublished.map((report) => `<article class="panel article-tile">
        ${badge('Publicación local de prueba', 'success', false)}
        <h2>${escapeHtml(report.title)}</h2>
        <p>Por ${escapeHtml(report.author)} · ${dateMark(report.created)}</p>
        <a class="text-link" href="#articulo/${report.id}">Leer reporte <span aria-hidden="true">→</span></a>
      </article>`).join('')}</div>
    </section>` : ''}`;
}

function articleView(id) {
  const article = articles.find((item) => item.id === id);
  if (article) {
    return `<article class="reading">
      ${back('#blog', 'Blog')}
      ${pageHeading(article.title, article.summary, article.category, true)}
      ${article.sections.map(([title, content]) => `<section class="panel">
        <h2>${title}</h2><p>${content}</p>
      </section>`).join('')}
      <a class="button primary" href="#visor/wise-0855">Probar con WISE 0855 <span aria-hidden="true">→</span></a>
    </article>`;
  }
  const report = readWorkspace().reports.find((item) => item.id === id && item.status === 'published');
  if (!report) return missingView();
  return `<article class="reading">
    ${back('#blog', 'Blog')}
    ${pageHeading(report.title, `Por ${report.author} · ${fullDate(report.created)}`, 'Publicación local de prueba', true)}
    <section class="panel"><h2>Observación</h2>
      <p class="preserve-lines">${escapeHtml(report.notes || `Documento PDF: ${report.fileName}`)}</p>
    </section>
    ${pdfButton(report)}
    ${reportEvidence(report.comparison ?? prepared, report.annotations ?? {}, false, report.id)}
  </article>`;
}

function stateGalleryView() {
  return `${pageHeading('Estados del visor', 'Abre cada ejemplo para revisar su comportamiento y su vista en móvil. Los casos simulados están identificados.')}
    <div class="state-cards">
      ${Object.entries(viewerExamples).map(([slug, state]) => `<article class="panel">
        ${badge(state.kind, state.color, false)}
        <h2>${state.title}</h2>
        <p>${state.description}</p>
        <a class="text-link" href="#visor/${slug}" aria-label="Ver estado ${state.title}">Ver estado <span aria-hidden="true">→</span></a>
      </article>`).join('')}
    </div>`;
}

function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  nav.classList.toggle('is-open', open);
}

function setCurrentNav(section) {
  nav.querySelectorAll('a').forEach((link) => {
    if (link.dataset.view === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function renderSearch() {
  const term = fold(searchInput.value);
  const matches = [
    ...targets.map((target) => ({ label: target.name, detail: 'Objetivo', href: `#objetivo/${target.id}` })),
    ...articles.map((article) => ({ label: article.title, detail: 'Guía', href: `#articulo/${article.id}` })),
  ].filter((result) => fold(result.label).includes(term));
  searchResults.innerHTML = matches.length
    ? matches.slice(0, 7).map((result) => `<li><a href="${result.href}">${result.label}<small>${result.detail} ↗</small></a></li>`).join('')
    : '<li class="muted">No se encontraron resultados.</li>';
}

const views = {
  inicio: { html: homeView, bind: bindHome, nav: 'inicio', title: 'Inicio' },
  visor: { html: viewerView, bind: (id, params) => bindViewer(id, params, runtime.compare), nav: 'visor', title: 'Visor temporal' },
  explorar: {
    html: () => '<section id="explorer-root" aria-label="Explorar"></section>',
    bind: () => { unmountExplorer = runtime.mountExplorer(document.querySelector('#explorer-root')); },
    nav: 'explorar', title: 'Explorar',
  },
  galeria: { html: (_id, params) => galleryView(params), bind: bindGallery, nav: 'galeria', title: 'Galería' },
  objetivo: { html: targetView, nav: 'galeria', title: 'Objetivo' },
  imagen: { html: inspectorView, bind: bindInspector, nav: 'visor', title: 'Imagen ampliada' },
  estados: { html: stateGalleryView, nav: 'visor', title: 'Estados del visor' },
  blog: { html: blogView, nav: 'blog', title: 'Blog' },
  articulo: { html: articleView, nav: 'blog', title: 'Artículo' },
  ficha: { html: reportView, bind: bindReport, title: 'Ficha de observación' },
  confirmacion: { html: confirmationView, title: 'Confirmación' },
  acceso: { html: accountView, bind: bindAccount, title: 'Acceso y registro' },
  perfil: { html: profileView, title: 'Mi espacio' },
  publico: { html: publicProfileView, title: 'Perfil público' },
  ajustes: { html: settingsView, bind: bindSettings, title: 'Ajustes' },
  administracion: { html: moderationView, bind: bindModeration, title: 'Revisión de reportes' },
};

let runtime;
let unmountExplorer;

function renderRoute() {
  const [path, query = ''] = location.hash.slice(1).split('?');
  if (path === 'contenido') {
    main.focus();
    return;
  }
  stopPlayback();
  cancelSearch();
  unmountExplorer?.();
  unmountExplorer = undefined;
  const [view = 'inicio', id] = path ? path.split('/') : [];
  main.dataset.view = view;
  const selected = Object.hasOwn(views, view) ? views[view] : { html: missingView, title: 'Vista no encontrada' };
  document.title = `${selected.title} · Planet X`;
  const spaceLink = document.querySelector('#space-link');
  const workspace = readWorkspace();
  spaceLink.href = workspace.profile.active ? '#perfil' : '#acceso';
  spaceLink.querySelector('.avatar').outerHTML = workspace.profile.active
    ? avatar(workspace.profile, 'small')
    : '<span class="avatar avatar-small" aria-hidden="true">PX</span>';
  const activeSection = ['perfil', 'acceso', 'ajustes', 'publico'].includes(view);
  if (activeSection) spaceLink.setAttribute('aria-current', 'page');
  else spaceLink.removeAttribute('aria-current');

  const params = new URLSearchParams(query);
  const isMap = view === 'galeria' && params.get('vista') === 'mapa';
  setCurrentNav(isMap ? 'mapa' : selected.nav);
  setMenu(false);
  if (search.open) search.close();
  main.innerHTML = selected.html(id, params);
  selected.bind?.(id, params);
  bindEvidenceImages(main);
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

export function startObservatory(services) {
  runtime = services;
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  });
  function openSearch() {
    if (search.open) return;
    searchInput.value = '';
    renderSearch();
    search.showModal();
    searchInput.focus();
  }
  document.querySelector('#search-open').addEventListener('click', openSearch);
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
    }
  });
  searchInput.addEventListener('input', renderSearch);
  searchResults.addEventListener('click', (event) => {
    if (event.target.closest('a')) search.close();
  });
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
