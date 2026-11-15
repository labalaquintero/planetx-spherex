import {
  articles, comparisonLink, comparisonMode, coordinateParams, dateMark, daysBetween, escapeHtml, fieldLabel,
  fold, formatBand, nasaSky, prepared, targets,
} from './datos.js';
import {
  accountView, avatar, bindAccount, bindModeration, bindReport, bindSettings, confirmationView,
  moderationView, profileView, publicProfileView, reportView, settingsView,
} from './espacio.js';
import { articleView, bindArticle, blogCommunity, blogView } from './blog.js';
import { back, badge, dataRows, miniPair, missingView, pageHeading } from './ui.js';
import {
  bindComparisonSlider, bindInspector, bindViewer, cancelSearch, comparisonFor, comparisonSlider,
  inspectorView, prefetchPrepared, preparedState, stopPlayback, viewerExamples, viewerView,
} from './visor.js';
import { bindReportAnnotations } from './anotaciones.js';
import { loadForView, readSharedPage, setSharedPage, sharedPage } from './colaboracion.js';
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

/** Caso preparado del servidor aún sin cargar (o cargando): se trata como «con secuencia» salvo si falló. */
function pendingPrepared(target) {
  return Boolean(target.preparedCase) && preparedState(target) !== 'fallo' && !targetComparison(target);
}

const compareHref = (target, pair) => pair ? comparisonLink(pair) : `#visor?${new URLSearchParams({ ra: String(target.ra), dec: String(target.dec) })}`;

function targetCard(target) {
  const pair = targetComparison(target);
  const pending = !pair && pendingPrepared(target);
  const chart = `<div class="sky-marker" role="img" aria-label="Posición aproximada en coordenadas ICRS"
     style="${skyPosition(target)}"><span aria-hidden="true">ICRS</span></div>`;
  const label = pair ? badge(comparisonMode(pair), pair.mode === 'prepared' ? 'success' : 'info')
    : pending ? badge('Caso preparado', 'success') : badge('Coordenadas de referencia', 'neutral', false);
  return `<article class="panel target-card${pair ? ' wide' : ''}">
    ${pair ? '' : chart}
    <div>
      ${label}
      <h2>${target.name}</h2>
      <p>${target.type}</p>
      <p class="mono">${target.ra.toFixed(6)}° / ${target.dec.toFixed(6)}°</p>
      ${pending ? '<p class="muted" role="status">Cargando sus épocas…</p>' : ''}
      <div class="row">
        ${pair || pending ? `<a class="text-link" href="${escapeHtml(compareHref(target, pair))}" aria-label="Comparar épocas de ${target.name}">Comparar épocas <span aria-hidden="true">→</span></a>` : ''}
        <a class="text-link" href="#objetivo/${target.id}" aria-label="Ver detalle de ${target.name}">Ver ficha <span aria-hidden="true">→</span></a>
      </div>
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

function bindGallery() {
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
      const hasPair = Boolean(targetComparison(target)) || pendingPrepared(target);
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
  // Casos preparados del servidor: se cargan una vez por visita y la galería se actualiza al llegar.
  if (runtime?.compare) {
    for (const target of targets.filter((item) => item.preparedCase && !preparedState(item))) {
      void prefetchPrepared(target, runtime.compare).then(() => {
        if (results.isConnected) update();
      });
    }
  }
  buttons.forEach((button) => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    update();
  }));
  layouts.forEach((button) => button.addEventListener('click', () => {
    layout = button.dataset.galleryLayout;
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
  const pending = !pair && pendingPrepared(target);

  return `${back('#galeria', 'Galería')}
    ${pageHeading(target.name, target.description, target.type)}
    <div class="split">
      <section class="panel">
        <div class="section-heading"><h2 class="section-title">${pair ? 'Épocas disponibles' : 'Campo de referencia'}</h2>
          ${pair ? badge(comparisonMode(pair), pair.mode === 'prepared' ? 'success' : 'info') : ''}</div>
        ${pair ? `<div class="target-frames">${miniPair(true, pair)}</div>`
          : pending ? '<p class="muted">Caso preparado: el visor carga sus dos épocas y la imagen de diferencia.</p>'
            : '<p class="muted">Usa estas coordenadas en el visor para consultar las observaciones disponibles en IRSA.</p>'}
        <div class="row">
          <a class="button primary" href="${escapeHtml(pair || pending ? compareHref(target, pair) : `#visor/${id}`)}">${pair || pending ? 'Comparar épocas' : 'Usar coordenadas'} <span aria-hidden="true">→</span></a>
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
    html: () => '<section id="explorer-root" aria-label="Mapa"></section>',
    bind: () => { unmountExplorer = runtime.mountExplorer(document.querySelector('#explorer-root')); },
    nav: 'explorar', title: 'Mapa',
  },
  galeria: { html: (_id, params) => galleryView(params), bind: bindGallery, nav: 'galeria', title: 'Galería' },
  objetivo: { html: targetView, nav: 'galeria', title: 'Objetivo' },
  imagen: { html: inspectorView, bind: bindInspector, nav: 'visor', title: 'Imagen ampliada' },
  estados: { html: stateGalleryView, nav: 'visor', title: 'Estados del visor' },
  blog: { html: blogView, nav: 'blog', title: 'Blog' },
  articulo: { html: articleView, bind: bindArticle, nav: 'blog', title: 'Artículo' },
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
let routeRequest;

function renderAccountLink(view) {
  const spaceLink = document.querySelector('#space-link');
  const profile = sharedPage.account ?? (sharedPage.enabled ? null : readWorkspace().profile);
  const active = profile && (sharedPage.account || profile.active);
  spaceLink.href = active ? '#perfil' : '#acceso';
  spaceLink.querySelector('.avatar').outerHTML = active ? avatar(profile, 'small')
    : '<span class="avatar avatar-small" aria-hidden="true">PX</span>';
  const activeSection = ['perfil', 'acceso', 'ajustes', 'publico'].includes(view);
  if (activeSection) spaceLink.setAttribute('aria-current', 'page');
  else spaceLink.removeAttribute('aria-current');
  const reviewLink = document.querySelector('#review-link');
  if (reviewLink) reviewLink.textContent = sharedPage.enabled ? 'Revisión de fichas' : 'Revisión local';
}

function renderRoute() {
  const [path, query = ''] = location.hash.slice(1).split('?');
  if (path === 'contenido') {
    main.focus();
    return;
  }
  stopPlayback();
  cancelSearch();
  routeRequest?.abort();
  routeRequest = undefined;
  unmountExplorer?.();
  unmountExplorer = undefined;
  const [view = 'inicio', id] = path ? path.split('/') : [];
  main.dataset.view = view;
  const selected = Object.hasOwn(views, view) ? views[view] : { html: missingView, title: 'Vista no encontrada' };
  document.title = `${selected.title} · Planet X`;
  renderAccountLink(view);

  nav.querySelectorAll('a').forEach((link) => {
    if (link.dataset.view === selected.nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  setMenu(false);
  if (search.open) search.close();
  const params = new URLSearchParams(query);
  const show = (options) => {
    renderAccountLink(view);
    main.innerHTML = selected.html(id, params, options);
    selected.bind?.(id, params);
    bindEvidenceImages(main);
    bindReportAnnotations(main);
    main.focus({ preventScroll: true });
  };
  if (runtime.collaboration && loadForView(view, id, params)) {
    const request = new AbortController();
    routeRequest = request;
    if (view === 'blog') show({ loadingCommunity: true });
    else main.innerHTML = '<p class="callout info" role="status">Cargando…</p>';
    readSharedPage(view, id, params, AbortSignal.any([request.signal, AbortSignal.timeout(12000)])).then((page) => {
      if (request !== routeRequest) return;
      setSharedPage(page);
      if (view === 'blog') {
        renderAccountLink(view);
        main.querySelector('#blog-community').innerHTML = blogCommunity(params);
        if (params.has('pagina')) main.querySelector('#community-heading')?.scrollIntoView();
      } else show();
    }).catch(() => {
      if (request !== routeRequest) return;
      if (view === 'blog') {
        main.querySelector('#blog-community').innerHTML = blogCommunity(params, { unavailable: true });
        return;
      }
      const localParams = new URLSearchParams(params);
      localParams.set('local', '1');
      const localRoute = view === 'ficha' ? `#${path}?${localParams}` : '#perfil?local=1';
      main.innerHTML = `<section class="panel reading">
        <p role="alert">El espacio compartido no respondió. Puedes reintentar o abrir tus fichas de este navegador.</p>
        <div class="row form-actions"><button type="button" class="button primary">Reintentar</button>
          <a class="button secondary" href="${escapeHtml(localRoute)}">${view === 'ficha' ? 'Abrir ficha local' : 'Ver fichas locales'}</a></div>
      </section>`;
      main.querySelector('button').addEventListener('click', renderRoute);
      main.focus({ preventScroll: true });
    });
  } else {
    show();
  }
  window.scrollTo(0, 0);
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
  if (runtime.collaboration && !routeRequest) {
    const firstHash = location.hash;
    readSharedPage('inicio', '', new URLSearchParams(), AbortSignal.timeout(6000)).then((page) => {
      if (location.hash !== firstHash || routeRequest) return;
      setSharedPage(page);
      renderAccountLink(main.dataset.view);
    }).catch(() => {});
  }
}
