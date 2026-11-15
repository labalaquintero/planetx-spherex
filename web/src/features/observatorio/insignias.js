/*
 * Insignias del perfil. Cuentan las fichas que pasaron la revisión (aceptadas o publicadas): así una
 * insignia no se gana enviando fichas sin evidencia. Las fichas de la semana las elige un administrador
 * entre las publicadas (una por semana) y dan un emblema propio que no se puede ganar de otra forma.
 */
import { escapeHtml, featuredObservation } from './datos.js';

const STAR = 'M12 2.6l2.75 5.95 6.5.72-4.85 4.4 1.36 6.4L12 16.8l-5.76 3.27 1.36-6.4-4.85-4.4 6.5-.72z';

/** Estrellas por fichas aprobadas, de menor a mayor. */
export const starTiers = [
  { id: 'primera', at: 1, name: 'Primera luz', description: 'Tu primera ficha aprobada.', stops: ['#fff3dc', '#f4cea3'], shape: 'spark' },
  { id: 'blanca', at: 10, name: 'Estrella blanca', description: '10 fichas aprobadas.', stops: ['#ffffff', '#f1f5fc'] },
  { id: 'plateada', at: 20, name: 'Estrella plateada', description: '20 fichas aprobadas.', stops: ['#dfe5ef', '#5f6b82'] },
  { id: 'dorada', at: 30, name: 'Estrella dorada', description: '30 fichas aprobadas.', stops: ['#ffe9b0', '#d6953a'] },
  { id: 'azul', at: 50, name: 'Estrella azul', description: '50 fichas aprobadas.', stops: ['#d5e3ff', '#4f7dff'] },
  { id: 'supernova', at: 100, name: 'Supernova', description: '100 fichas aprobadas.', stops: ['#fff1c9', '#ff6f91'], shape: 'nova' },
];

export const weeklyBadge = {
  id: 'semana', name: 'Ficha de la semana',
  description: 'Un administrador eligió una de tus fichas publicadas como la ficha de la semana.',
};

function icon(kind, stops = [], key = kind) {
  // Un id de gradiente por insignia: si se repite, el navegador usa el primero para todas.
  const gradient = `insignia-${key}`;
  const defs = stops.length ? `<defs><linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient></defs>` : '';
  const fill = `url(#${gradient})`;
  const shapes = {
    spark: `<path d="M12 3.5l1.7 6.8 6.8 1.7-6.8 1.7L12 20.5l-1.7-6.8L3.5 12l6.8-1.7z" fill="${fill}"/>`,
    star: `<path d="${STAR}" fill="${fill}" stroke="#ffffff55" stroke-width=".6" stroke-linejoin="round"/>`,
    nova: `<g stroke="${stops[1]}" stroke-width="1.3" stroke-linecap="round" opacity=".85">
        <path d="M12 .8v3.2M12 20v3.2M.8 12h3.2M20 12h3.2M4.1 4.1l2.3 2.3M17.6 17.6l2.3 2.3M4.1 19.9l2.3-2.3M17.6 6.4l2.3-2.3"/></g>
      <path d="${STAR}" transform="translate(12 12) scale(.72) translate(-12 -11.6)" fill="${fill}"/>`,
    semana: `<defs><linearGradient id="insignia-semana" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#c9a7ff"/><stop offset=".55" stop-color="#f4cea3"/><stop offset="1" stop-color="#ff9fb4"/></linearGradient></defs>
      <circle cx="12" cy="12" r="10.4" fill="#1a1530" stroke="url(#insignia-semana)" stroke-width="1.6"/>
      <ellipse cx="12" cy="12" rx="8.2" ry="3.4" fill="none" stroke="#c9a7ff" stroke-width=".8" opacity=".7" transform="rotate(-24 12 12)"/>
      <path d="${STAR}" transform="translate(12 12) scale(.46) translate(-12 -11.6)" fill="url(#insignia-semana)"/>
      <circle cx="18.6" cy="8.6" r="1.25" fill="#f4cea3"/>`,
  };
  return `<svg class="insignia-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${defs}${shapes[kind]}</svg>`;
}

const tierIcon = (tier) => icon(tier.shape ?? 'star', tier.stops, tier.id);

/** Datos de las insignias a partir de una lista de fichas (perfil propio o local). */
export function statsFromReports(reports) {
  return {
    contributions: reports.filter((report) => ['accepted', 'published'].includes(report.status)).length,
    weeklyPicks: reports.map((report) => report.weeklyPick).filter(Boolean).sort().reverse(),
  };
}

export function earnedBadges({ contributions = 0, weeklyPicks = [] } = {}) {
  const stars = starTiers.filter((tier) => contributions >= tier.at);
  return { stars, weekly: weeklyPicks.length };
}

export function nextTier(contributions = 0) {
  return starTiers.find((tier) => contributions < tier.at) ?? null;
}

function insignia(name, description, svg, { locked = false, count = 0 } = {}) {
  return `<li class="insignia${locked ? ' is-locked' : ''}" title="${escapeHtml(description)}">
    ${svg}<span class="insignia-name">${escapeHtml(name)}${count > 1 ? ` <b>×${count}</b>` : ''}</span>
    <span class="sr-only">${locked ? 'Bloqueada: ' : ''}${escapeHtml(description)}</span>
  </li>`;
}

/**
 * Vitrina de insignias. En el perfil propio (`own`) muestra también las que faltan, atenuadas, y
 * cuánto falta para la siguiente estrella; en el perfil público, solo las ganadas.
 */
export function badgeShelf(stats, { own = false } = {}) {
  const { contributions = 0, weeklyPicks = [] } = stats ?? {};
  const { stars, weekly } = earnedBadges(stats);
  const items = [];
  if (weekly) items.push(insignia(weeklyBadge.name, `${weeklyBadge.description} Semanas: ${weeklyPicks.join(', ')}.`, icon('semana'), { count: weekly }));
  for (const tier of [...stars].reverse()) items.push(insignia(tier.name, tier.description, tierIcon(tier)));
  if (own) {
    for (const tier of starTiers.filter((item) => contributions < item.at)) {
      items.push(insignia(tier.name, tier.description, tierIcon(tier), { locked: true }));
    }
    if (!weekly) items.push(insignia(weeklyBadge.name, weeklyBadge.description, icon('semana'), { locked: true }));
  }
  const next = nextTier(contributions);
  const progress = own && next ? `<div class="insignia-progress">
      <label for="insignia-meter">Siguiente: <strong>${escapeHtml(next.name)}</strong> · ${contributions} de ${next.at} fichas aprobadas</label>
      <progress id="insignia-meter" max="${next.at}" value="${contributions}">${contributions} de ${next.at}</progress>
    </div>` : '';
  if (!items.length) return '<p class="muted">Aún no hay insignias.</p>';
  return `<div class="insignias">
    <ul class="insignia-list" aria-label="Insignias">${items.join('')}</ul>
    ${progress}
    ${own ? '<p class="input-hint">Cuentan las fichas aceptadas o publicadas. Cada semana, el equipo elige una ficha publicada como ficha de la semana.</p>' : ''}
  </div>`;
}

/** Marca pequeña para listas y el Blog. */
export function weeklyMark(week) {
  return week ? `<span class="weekly-mark" title="Ficha de la semana ${escapeHtml(week)}">${icon('semana')}Ficha de la semana</span>` : '';
}

/** Semana ISO 8601 en UTC, p. ej. «2026-W46» (la misma clave que usa la API). */
export function isoWeek(date = new Date()) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Perfil de ejemplo integrado en la app (#publico/ejemplo), siempre disponible: muestra cómo se ve un
 * perfil con todas las estrellas (Supernova) y el emblema de ficha de la semana. No es una cuenta real
 * y la vista lo dice; su ficha publicada es el caso de muestra de WISE 0855.
 */
export const exampleProfile = {
  id: 'ejemplo',
  example: true,
  profile: { id: 'ejemplo', alias: 'Observatorio Planet X', avatar: '', public: true },
  stats: { contributions: 100, weeklyPicks: ['2026-W46'] },
  reports: [{ id: featuredObservation.id, title: featuredObservation.title, status: 'published', weeklyPick: '2026-W46' }],
};
