import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { readyFixture } from '../src/features/viewer/fixtures/comparison-ready.ts';

/*
 * Recorrido completo por la app (index.html real, rutas por hash): entrar a WISE 0855 desde
 * «Galería → Comparar épocas →» debe abrir el mismo comparador completo que el botón de Inicio.
 */
const WISE = { ra: 133.795129166667, dec: -7.245147222222 };

// Respuesta del servidor para cualquier caso preparado: dos épocas en las coordenadas pedidas.
const compare = vi.fn(async (ra, dec) => ({
  ...readyFixture,
  mode: 'prepared',
  query: { ...readyFixture.query, ra_deg: ra, dec_deg: dec },
  frames: readyFixture.frames.map((frame) => ({ ...frame, release: 'dr1', image_url: `/api/v1/images/${frame.id}` })),
}));

// Cada prueba arranca la app en la misma ventana: se retiran los oyentes de rutas de la anterior.
const routeListeners = [];

async function openApp(hash) {
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'hashchange') routeListeners.push(listener);
    add(type, listener, options);
  });
  const page = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
  document.body.innerHTML = page.body.innerHTML;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // jsdom no trae matchMedia; Inicio lo usa para el parallax del héroe.
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  history.replaceState(null, '', hash);
  const { startObservatory } = await import('../src/features/observatorio/app.js');
  startObservatory({ compare, mountExplorer: vi.fn() });
}

const wiseCard = () => [...document.querySelectorAll('#gallery-results .target-card')]
  .find((card) => card.querySelector('h2')?.textContent === 'WISE 0855');

async function expectFullComparison() {
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Lado a lado' })).toBeInTheDocument());
  for (const mode of ['Lado a lado', 'Alternar', 'Deslizar']) {
    expect(screen.getByRole('button', { name: mode })).toBeInTheDocument();
  }
  expect(screen.getByRole('heading', { name: 'Línea de tiempo' })).toBeInTheDocument();
  expect(screen.getByTestId('provenance-panel')).toBeInTheDocument();
  // No es la vista de una sola época con herramientas de anotación.
  expect(document.querySelector('#inspector-date')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Dibujar' })).toBeNull();
  // Coordenadas exactas del objetivo.
  expect(compare).toHaveBeenCalledWith(WISE.ra, WISE.dec, expect.any(AbortSignal));
  expect(document.querySelector('#ra').value).toBe(String(WISE.ra));
  expect(document.querySelector('#dec').value).toBe(String(WISE.dec));
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  compare.mockClear();
  vi.resetModules();
});

afterEach(() => {
  for (const listener of routeListeners.splice(0)) window.removeEventListener('hashchange', listener);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('Inicio → «Comparar WISE 0855» abre el comparador completo', async () => {
  await openApp('#inicio');
  const link = screen.getByRole('link', { name: /Comparar WISE 0855/ });
  expect(link).toHaveAttribute('href', '#visor/wise-0855');
  link.click();
  await expectFullComparison();
});

it('Galería → «Comparar épocas →» de WISE 0855 abre el mismo comparador completo que Inicio', async () => {
  await openApp('#galeria');
  const link = wiseCard().querySelector('a[aria-label="Comparar épocas de WISE 0855"]');
  expect(link).toHaveAttribute('href', '#visor/wise-0855');
  link.click();
  await vi.waitFor(() => expect(location.hash).toBe('#visor/wise-0855'));
  await expectFullComparison();
});

it('las miniaturas de la tarjeta también abren el comparador completo, no la imagen ampliada', async () => {
  await openApp('#galeria');
  const thumbnails = [...wiseCard().querySelectorAll('.mini-pair a')];
  expect(thumbnails).toHaveLength(2);
  for (const thumbnail of thumbnails) expect(thumbnail).toHaveAttribute('href', '#visor/wise-0855');
  thumbnails[1].click();
  await expectFullComparison();
});

it('«Ver ficha →» sigue llevando al detalle, donde cada época se amplía para anotarla', async () => {
  await openApp('#galeria');
  const ficha = wiseCard().querySelector('a[aria-label="Ver detalle de WISE 0855"]');
  expect(ficha).toHaveAttribute('href', '#objetivo/wise-0855');
  ficha.click();
  await vi.waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'WISE 0855' })).toBeInTheDocument());
  const ampliar = screen.getByRole('link', { name: 'Ampliar época A' });
  expect(ampliar.getAttribute('href')).toMatch(/^#imagen\/0\?/);
  expect(screen.getByRole('link', { name: /Comparar épocas/ })).toHaveAttribute('href', '#visor/wise-0855');
});
