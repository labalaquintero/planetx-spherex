import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { readyFixture } from '../features/viewer/fixtures/comparison-ready.ts';

const readWebFile = (path) => readFileSync(path, 'utf8');

it('abre el comparador desde el punto de entrada de Docker y lleva sus datos a la ficha', async () => {
  const page = new DOMParser().parseFromString(readWebFile('index.html'), 'text/html');
  document.body.innerHTML = page.body.innerHTML;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  history.replaceState(null, '', '#visor/wise-0855');
  const compare = vi.fn().mockResolvedValue({
    ...readyFixture,
    mode: 'prepared',
    query: { ...readyFixture.query, ra_deg: 133.795129166667, dec_deg: -7.245147222222 },
    frames: readyFixture.frames.map((frame) => ({
      ...frame,
      release: 'dr1',
      image_url: `/api/v1/images/${frame.id}`,
    })),
  });
  vi.stubGlobal('planetXRuntime', { compare });
  const scripts = ['datos.js', 'visor.js', 'espacio.js', 'app.js']
    .map((file) => readWebFile(`public/observatorio/${file}`)).join('\n');

  window.eval(scripts);
  document.dispatchEvent(new Event('DOMContentLoaded'));

  await vi.waitFor(() => {
    expect(document.querySelector('[data-testid="comparison-viewer"]')).toBeInTheDocument();
  });
  expect(compare).toHaveBeenCalledWith(133.795129166667, -7.245147222222, expect.any(AbortSignal));
  expect(document.querySelector('.coordinate-panel')).not.toHaveAttribute('open');
  expect(document.querySelector('a[href^="#imagen/0"]')).toHaveAttribute(
    'href', '#imagen/0?ra=133.795129166667&dec=-7.245147222222',
  );
  expect(document.querySelector('[data-testid="provenance-panel"]')).toHaveTextContent('Caso preparado');
  expect([...document.querySelectorAll('#site-nav a')].map((link) => link.textContent))
    .toEqual(['Inicio', 'Visor', 'Galería', 'Explorar', 'Blog']);

  history.replaceState(null, '', '#ficha?ra=133.795129166667&dec=-7.245147222222');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(document.querySelector('#report-form')).toBeInTheDocument();
  expect(document.querySelector('.attachment-panel img')).toHaveAttribute(
    'src', `/api/v1/images/${readyFixture.frames[0].id}`,
  );
});
