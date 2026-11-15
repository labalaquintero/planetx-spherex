const main = document.querySelector('main');
const menu = document.querySelector('#menu-toggle');
const nav = document.querySelector('#site-nav');
const search = document.querySelector('#search-dialog');
const searchInput = document.querySelector('#site-search');
const searchResults = document.querySelector('#search-results');
let toastTimer;

function pageHeading(title, lead = '', eyebrow = '', compact = false) {
  return `<header class="page-heading${compact ? ' compact' : ''}">
    ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
    <h1>${escapeHtml(title)}</h1>
    ${lead ? `<p>${escapeHtml(lead)}</p>` : ''}
  </header>`;
}

function badge(text, color = 'neutral', dot = true) {
  return `<span class="badge ${color}${dot ? ' dot' : ''}">${escapeHtml(text)}</span>`;
}

function dataRows(rows) {
  return `<dl class="data-list">${rows.map(([label, content]) =>
    `<div><dt>${label}</dt><dd>${content}</dd></div>`).join('')}</dl>`;
}

function back(href, text) {
  return `<a href="${href}" class="text-link back-link"><span aria-hidden="true">←</span> ${text}</a>`;
}

function miniPair(link = false) {
  return `<div class="mini-pair" aria-label="Fotogramas de WISE 0855">
    ${prepared.frames.map((frame, index) => {
      const figure = `<figure><img class="science-image" src="${frame.src}" alt="Recorte SPHEREx de la época ${epoch(index)}" width="64" height="64">
        <figcaption><b>${epoch(index)}</b> ${dateMark(frame.observed_at)}</figcaption></figure>`;
      return link ? `<a href="#imagen/${index}" aria-label="Ampliar época ${epoch(index)} de WISE 0855">${figure}</a>` : figure;
    }).join('')}
  </div>`;
}

function toast(message) {
  const notice = document.querySelector('#toast');
  window.clearTimeout(toastTimer);
  notice.hidden = false;
  notice.textContent = message;
  toastTimer = window.setTimeout(() => { notice.hidden = true; }, 5600);
}

function homeView() {
  const published = readWorkspace().reports.find((report) => report.status === 'published');
  return `<section class="hero" aria-labelledby="home-title">
    <img class="hero-photo" src="assets/vela-spherex.jpg" alt="" fetchpriority="high">
    <div class="hero-copy">
      <p class="eyebrow">Observaciones infrarrojas de SPHEREx</p>
      <h1 id="home-title">El cielo a través<br><em>del tiempo</em></h1>
      <p>Compara observaciones de una misma región del cielo en fechas distintas y consulta la procedencia de cada imagen.</p>
      <div class="row hero-actions">
        <a class="button primary" href="#visor/wise-0855">Comparar WISE 0855 <span aria-hidden="true">→</span></a>
        <a class="button secondary" href="#galeria">Explorar galería</a>
      </div>
    </div>
    <a class="photo-credit" href="${nasaVela}" target="_blank" rel="noopener">Región de Vela · NASA/JPL-Caltech ↗</a>
  </section>
  <section class="home-section" aria-labelledby="featured-title">
    <div class="section-heading">
      <h2 id="featured-title">Observaciones para explorar</h2>
      <a class="text-link" href="#galeria">Ver cinco objetivos <span aria-hidden="true">→</span></a>
    </div>
    <div class="home-grid">
      <article class="panel featured-case">
        <div>
          ${badge('Caso preparado', 'success')}
          <h3>Campo de WISE 0855</h3>
          <p class="muted">Dos épocas de SPHEREx DR1, separadas por ${Math.floor(daysBetween)} días.</p>
          <a class="text-link" href="#objetivo/wise-0855">Ver campo y fechas <span aria-hidden="true">→</span></a>
        </div>
        ${miniPair(true)}
      </article>
      <div class="panel home-shortcuts">
        <a class="shortcut" href="#visor"><span><strong>Buscar por coordenadas</strong><p>Introduce RA y Dec en el visor.</p></span><span aria-hidden="true">↗</span></a>
        <a class="shortcut" href="#perfil"><span><strong>Comparaciones recientes</strong><p>Retoma un campo visto en este navegador.</p></span><span aria-hidden="true">↗</span></a>
        <a class="shortcut" href="#ficha"><span><strong>Preparar una ficha</strong><p>Guarda tus notas junto a las dos épocas.</p></span><span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </section>
  ${published ? `<section class="home-section panel row between" aria-label="Reporte reciente">
    <div><p class="eyebrow">Reporte publicado en el prototipo</p>
      <h2>${escapeHtml(published.title)}</h2></div>
    <a class="text-link" href="#articulo/${published.id}">Leer en el Blog <span aria-hidden="true">→</span></a>
  </section>` : ''}`;
}

function targetCard(target) {
  const hasPair = target.id === 'wise-0855';
  const chart = `<div class="sky-marker" role="img" aria-label="Posición aproximada en coordenadas ICRS"
     style="--ra:${target.ra / 360 * 100}%; --dec:${(90 - target.dec) / 180 * 100}%"><span aria-hidden="true">ICRS</span></div>`;
  return `<article class="panel target-card${hasPair ? ' wide' : ''}">
    ${hasPair ? '' : chart}
    <div>
      ${hasPair ? badge('Caso preparado', 'success') : badge('Coordenadas de referencia', 'neutral', false)}
      <h2>${target.name}</h2>
      <p>${target.type}</p>
      <p class="mono">${target.ra.toFixed(6)}° / ${target.dec.toFixed(6)}°</p>
      <a class="text-link" href="#objetivo/${target.id}" aria-label="Ver detalle de ${target.name}">Ver ficha <span aria-hidden="true">→</span></a>
    </div>
    ${hasPair ? miniPair(true) : ''}
  </article>`;
}

function galleryView(params) {
  return `${pageHeading('Galería del cielo', 'Explora los cinco campos del reto y abre las observaciones disponibles.')}
    <div class="gallery-tools">
      <div class="segmented" role="group" aria-label="Filtrar objetivos">
        <button type="button" data-filter="todos" aria-pressed="true">Todos</button>
        <button type="button" data-filter="preparado" aria-pressed="false">Con secuencia</button>
        <button type="button" data-filter="coordenadas" aria-pressed="false">Solo coordenadas</button>
      </div>
      <div class="search-field"><label for="gallery-search">Buscar objetivo</label>
        <input type="search" id="gallery-search" value="${escapeHtml(params.get('buscar') ?? '')}" placeholder="Nombre del objeto" maxlength="100"></div>
    </div>
    <p class="result-count" id="gallery-count" role="status"></p>
    <div class="gallery-grid" id="gallery-results"></div>`;
}

function bindGallery() {
  const input = main.querySelector('#gallery-search');
  const buttons = [...main.querySelectorAll('[data-filter]')];
  const results = main.querySelector('#gallery-results');
  const total = main.querySelector('#gallery-count');
  let filter = 'todos';

  function update() {
    const query = fold(input.value);
    const matching = targets.filter((target) => {
      const hasPair = target.id === 'wise-0855';
      const matchesMode = filter === 'todos' || (filter === 'preparado' ? hasPair : !hasPair);
      return matchesMode && fold(`${target.name} ${target.type}`).includes(query);
    });
    total.textContent = `${matching.length} de ${targets.length} objetivos`;
    results.innerHTML = matching.length ? matching.map(targetCard).join('') :
      '<p class="muted">No se encontraron objetivos. Prueba otro nombre o cambia el filtro.</p>';
  }
  input.addEventListener('input', update);
  buttons.forEach((button) => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    update();
  }));
  update();
}

function targetView(id) {
  const target = targets.find((item) => item.id === id);
  if (!target) return missingView();
  const hasPair = id === 'wise-0855';

  return `${back('#galeria', 'Galería')}
    ${pageHeading(target.name, target.description, target.type)}
    <div class="split">
      <section class="panel">
        <div class="section-heading"><h2 class="section-title">${hasPair ? 'Épocas disponibles' : 'Campo de referencia'}</h2>
          ${hasPair ? badge('Caso preparado', 'success') : ''}</div>
        ${hasPair ? `<div class="target-frames">${miniPair(true)}</div>`
          : '<p class="muted">La galería conserva el centro del campo. Aún no hay una secuencia preparada para este objetivo en el prototipo.</p>'}
        <div class="row">
          <a class="button primary" href="#visor/${id}">${hasPair ? 'Comparar épocas' : 'Usar coordenadas'} <span aria-hidden="true">→</span></a>
          ${hasPair ? '<a class="button secondary" href="#ficha">Preparar ficha</a>' : ''}
        </div>
      </section>
      <aside class="panel evidence" aria-label="Datos del campo">
        <div class="row"><h2>Ubicación y datos</h2></div>
        ${dataRows([
          ['Ascensión recta · RA', `<span class="mono">${target.ra}°</span>`],
          ['Declinación · Dec', `<span class="mono">${target.dec}°</span>`],
          ['Marco de referencia', id === 'barnard' ? 'ICRS · J2000' : 'ICRS'],
          ...(hasPair ? [['Campo', '0.10° × 0.10°'], ['Banda aproximada', bandLabel], ['Colección', 'SPHEREx DR1']] : []),
        ])}
      </aside>
    </div>`;
}

function blogView() {
  const localPublished = readWorkspace().reports.filter((report) => report.status === 'published');
  return `${pageHeading('Blog de observación', 'Guías para usar el visor, interpretar las imágenes y documentar una observación.')}
    <div class="article-grid">
      ${articles.map((article) => `<article class="panel article-tile">
        <p class="eyebrow">${article.category}</p>
        <h2>${article.title}</h2>
        <p>${article.summary}</p>
        <a class="text-link" href="#articulo/${article.id}">Leer guía <span aria-hidden="true">→</span></a>
      </article>`).join('')}
    </div>
    ${localPublished.length ? `<section class="home-section" aria-label="Reportes de este prototipo">
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
    ${reportEvidence(report.annotations ?? {}, false)}
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

function missingView() {
  return `${pageHeading('Vista no encontrada', 'Puedes volver al inicio o abrir el caso preparado del visor.')}
    <a class="button primary" href="#inicio">Volver al inicio</a>`;
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
  inicio: { html: homeView, nav: 'inicio', title: 'Inicio' },
  visor: { html: viewerView, bind: bindViewer, nav: 'visor', title: 'Visor temporal' },
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

function renderRoute() {
  stopPlayback();
  cancelSearch();
  const [path, query = ''] = location.hash.slice(1).split('?');
  if (path === 'contenido') {
    main.focus();
    return;
  }
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

  nav.querySelectorAll('a').forEach((link) => {
    if (link.dataset.view === selected.nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  setMenu(false);
  if (search.open) search.close();
  main.innerHTML = selected.html(id, new URLSearchParams(query));
  selected.bind?.(id);
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

document.addEventListener('DOMContentLoaded', () => {
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  });
  document.querySelector('#search-open').addEventListener('click', () => {
    searchInput.value = '';
    renderSearch();
    search.showModal();
    searchInput.focus();
  });
  searchInput.addEventListener('input', renderSearch);
  searchResults.addEventListener('click', (event) => {
    if (event.target.closest('a')) search.close();
  });
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
});
