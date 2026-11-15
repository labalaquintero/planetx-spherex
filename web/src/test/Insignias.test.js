import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { badgeShelf, earnedBadges, isoWeek, nextTier, statsFromReports } from '../features/observatorio/insignias.js';

const report = (id, status, extra = {}) => ({
  id, status, title: `Ficha ${id}`, author: 'Observadora', created: '2026-11-10T12:00:00.000Z',
  notes: 'Notas', format: 'manual', annotations: {}, ...extra,
});

describe('reglas de las insignias', () => {
  it('cuentan solo las fichas aprobadas (aceptadas o publicadas)', () => {
    const reports = [
      ...Array.from({ length: 12 }, (_, i) => report(`p${i}`, i % 2 ? 'accepted' : 'published')),
      report('b', 'draft'), report('r', 'review'), report('x', 'rejected'),
    ];
    expect(statsFromReports(reports)).toEqual({ contributions: 12, weeklyPicks: [] });
  });

  it('estrella blanca con 10, plateada con 20, y la siguiente meta', () => {
    expect(earnedBadges({ contributions: 9 }).stars.map((t) => t.id)).toEqual(['primera']);
    expect(earnedBadges({ contributions: 10 }).stars.map((t) => t.id)).toEqual(['primera', 'blanca']);
    expect(earnedBadges({ contributions: 20 }).stars.map((t) => t.id)).toEqual(['primera', 'blanca', 'plateada']);
    expect(nextTier(14)).toMatchObject({ id: 'plateada', at: 20 });
    expect(nextTier(0)).toMatchObject({ id: 'primera', at: 1 });
    expect(nextTier(100)).toBeNull();
  });

  it('el emblema de la ficha de la semana es aparte y se cuenta', () => {
    const stats = statsFromReports([report('a', 'published', { weeklyPick: '2026-W40' }), report('b', 'published', { weeklyPick: '2026-W46' })]);
    expect(stats.weeklyPicks).toEqual(['2026-W46', '2026-W40']);
    document.body.innerHTML = badgeShelf(stats);
    expect(screen.getByText('Ficha de la semana')).toHaveTextContent('×2');
  });

  it('el perfil público solo muestra lo ganado; el propio, también lo bloqueado y el progreso', () => {
    document.body.innerHTML = badgeShelf({ contributions: 14, weeklyPicks: [] });
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('.insignia-name').textContent)).toEqual(['Estrella blanca', 'Primera luz']);
    document.body.innerHTML = badgeShelf({ contributions: 14, weeklyPicks: [] }, { own: true });
    expect(document.querySelectorAll('.insignia.is-locked')).toHaveLength(5);
    const meter = screen.getByRole('progressbar');
    expect(meter).toHaveAttribute('max', '20');
    expect(meter).toHaveAttribute('value', '14');
    expect(screen.getByText(/14 de 20 fichas aprobadas/)).toHaveTextContent('Estrella plateada');
  });

  it('la semana ISO coincide con la de la API', () => {
    expect(isoWeek(new Date('2026-11-15T12:00:00Z'))).toBe('2026-W46');
    expect(isoWeek(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
  });
});

describe('ficha de la semana en el modo local', () => {
  const routeListeners = [];

  async function openApp(hash, reports) {
    localStorage.setItem('planet-x-prototipo-v1', JSON.stringify({
      profile: { alias: 'Observadora', active: true, public: true, paused: false, avatar: '' },
      recent: [], reports, annotations: {},
    }));
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'hashchange') routeListeners.push(listener);
      add(type, listener, options);
    });
    const page = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
    document.body.innerHTML = page.body.innerHTML;
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    history.replaceState(null, '', hash);
    const { startObservatory } = await import('../features/observatorio/app.js');
    startObservatory({ compare: vi.fn(), mountExplorer: vi.fn() });
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    for (const listener of routeListeners.splice(0)) window.removeEventListener('hashchange', listener);
    vi.restoreAllMocks();
  });

  it('el revisor local la elige, el perfil muestra el emblema y el Blog la marca', async () => {
    const reports = [
      ...Array.from({ length: 9 }, (_, i) => report(`a${i}`, 'accepted')),
      report('pub', 'published'),
      report('otra', 'published', { weeklyPick: isoWeek() }),
    ];
    await openApp('#administracion/pub', reports);
    const pick = screen.getByRole('button', { name: 'Elegir como ficha de la semana' });
    pick.click();
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Elegir como ficha de la semana' })).toBeNull());
    const saved = JSON.parse(localStorage.getItem('planet-x-prototipo-v1')).reports;
    // Una por semana: la anterior pierde la marca.
    expect(saved.filter((item) => item.weeklyPick === isoWeek()).map((item) => item.id)).toEqual(['pub']);

    history.replaceState(null, '', '#perfil');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const shelf = screen.getByRole('list', { name: 'Insignias' });
    const earned = [...shelf.querySelectorAll('.insignia:not(.is-locked) .insignia-name')].map((item) => item.textContent.trim());
    expect(earned).toEqual(['Ficha de la semana', 'Estrella blanca', 'Primera luz']);
    expect(within(shelf).getAllByRole('listitem').filter((li) => li.matches('.is-locked'))).toHaveLength(4);
    expect(screen.getByText(/11 de 20 fichas aprobadas/)).toBeInTheDocument();

    history.replaceState(null, '', '#blog');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const card = [...document.querySelectorAll('.blog-report-card')].find((item) => item.textContent.includes('Ficha pub'));
    expect(card.querySelector('.weekly-mark')).toHaveTextContent('Ficha de la semana');
  });
});

describe('perfil de ejemplo', () => {
  const routeListeners = [];

  afterEach(() => {
    for (const listener of routeListeners.splice(0)) window.removeEventListener('hashchange', listener);
    vi.restoreAllMocks();
  });

  it('está siempre disponible, sin servidor, con la Supernova y la ficha de la semana', async () => {
    sessionStorage.clear();
    localStorage.clear();
    vi.resetModules();
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'hashchange') routeListeners.push(listener);
      add(type, listener, options);
    });
    const page = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
    document.body.innerHTML = page.body.innerHTML;
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const fetch = vi.spyOn(window, 'fetch');
    history.replaceState(null, '', '#publico/ejemplo');
    const { startObservatory } = await import('../features/observatorio/app.js');
    // Con el espacio compartido activo, el perfil de ejemplo tampoco se pide al servidor.
    startObservatory({ compare: vi.fn(), mountExplorer: vi.fn(), collaboration: true });

    expect(screen.getByRole('heading', { level: 1, name: 'Observatorio Planet X' })).toBeInTheDocument();
    expect(screen.getByText(/No es una cuenta real/)).toBeInTheDocument();
    const names = [...document.querySelectorAll('.insignia-name')].map((item) => item.textContent.trim());
    expect(names).toEqual(['Ficha de la semana', 'Supernova', 'Estrella azul', 'Estrella dorada', 'Estrella plateada', 'Estrella blanca', 'Primera luz']);
    expect(document.querySelectorAll('.insignia.is-locked')).toHaveLength(0);
    expect(screen.getByRole('link', { name: /El mismo campo/ })).toHaveAttribute('href', '#articulo/wise-0855-dos-epocas');
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/profiles/'), expect.anything());
  });
});

it('cada insignia usa su propio gradiente (si se repite el id, todas toman el mismo color)', () => {
  document.body.innerHTML = badgeShelf({ contributions: 100, weeklyPicks: ['2026-W46'] });
  const ids = [...document.querySelectorAll('linearGradient')].map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(7);
});
