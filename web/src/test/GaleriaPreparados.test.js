import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { readyFixture } from '../features/viewer/fixtures/comparison-ready.ts';

const R_DRACONIS = { ra: 248.167611, dec: 66.754979 };

// Respuesta del catálogo del servidor para R Draconis (caso preparado, dos épocas y diferencia).
const draconisPayload = {
  ...readyFixture,
  mode: 'prepared',
  query: { ...readyFixture.query, ra_deg: R_DRACONIS.ra, dec_deg: R_DRACONIS.dec },
  frames: readyFixture.frames.map((frame) => ({ ...frame, release: 'dr1', image_url: `/api/v1/images/${frame.id}` })),
};

async function openGallery(compare) {
  const page = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
  document.body.innerHTML = page.body.innerHTML;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  history.replaceState(null, '', '#galeria');
  const { startObservatory } = await import('../features/observatorio/app.js');
  startObservatory({ compare, mountExplorer: vi.fn() });
}

const card = (name) => [...document.querySelectorAll('#gallery-results .target-card')]
  .find((item) => item.querySelector('h2')?.textContent === name);
const names = () => [...document.querySelectorAll('#gallery-results .target-card h2')].map((h) => h.textContent);
const showWithSequence = () => document.querySelector('[data-filter="preparado"]').click();

beforeEach(() => {
  // Sesión nueva: sin comparaciones guardadas ni módulos con estado de otra prueba.
  sessionStorage.clear();
  localStorage.clear();
  vi.resetModules();
});

it('desde una sesión nueva, «Con secuencia» muestra R Draconis y su tarjeta abre la comparación', async () => {
  const compare = vi.fn(async (ra, dec) => {
    if (ra === R_DRACONIS.ra && dec === R_DRACONIS.dec) return draconisPayload;
    throw new Error('La galería no debe consultar objetivos sin caso preparado');
  });
  await openGallery(compare);

  // Antes de que llegue la respuesta ya cuenta como caso preparado.
  showWithSequence();
  expect(names()).toEqual(expect.arrayContaining(['WISE 0855', 'R Draconis']));
  expect(card('R Draconis')).toHaveTextContent('Caso preparado');

  await vi.waitFor(() => expect(card('R Draconis').querySelector('.mini-pair')).toBeInTheDocument());
  expect(compare).toHaveBeenCalledTimes(1);
  expect(compare).toHaveBeenCalledWith(R_DRACONIS.ra, R_DRACONIS.dec, expect.any(AbortSignal));
  expect(names()).toEqual(expect.arrayContaining(['WISE 0855', 'R Draconis']));
  expect(names()).not.toContain('Estrella de Barnard');
  const link = card('R Draconis').querySelector('a[aria-label="Comparar épocas de R Draconis"]');
  expect(link).toHaveAttribute('href', '#visor?ra=248.167611&dec=66.754979');
  // La precarga no cambia la comparación activa ni el historial de la persona.
  expect(sessionStorage.length).toBe(0);
});

it('si el servidor no tiene el caso, R Draconis vuelve a «Coordenadas de referencia»', async () => {
  const compare = vi.fn().mockRejectedValue(new Error('503'));
  await openGallery(compare);
  showWithSequence();
  await vi.waitFor(() => expect(names()).not.toContain('R Draconis'));
  expect(names()).toContain('WISE 0855');
  document.querySelector('[data-filter="todos"]').click();
  expect(card('R Draconis')).toHaveTextContent('Coordenadas de referencia');
  expect(card('R Draconis').querySelector('a[aria-label^="Comparar épocas"]')).toBeNull();
});
