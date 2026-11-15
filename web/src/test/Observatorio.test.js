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
    difference: {
      id: 'synthetic-difference',
      image_url: '/api/v1/images/synthetic-difference',
      frame_ids: readyFixture.frames.map(({ id }) => id),
      scale_mjy_sr: 0.23,
      common_valid_fraction: 0.802,
    },
  });
  const { startObservatory } = await import('../features/observatorio/app.js');
  const mountExplorer = vi.fn();
  startObservatory({ compare, mountExplorer });

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
    .toEqual(['Inicio', 'Visor', 'Galería', 'Mapa', 'Blog']);

  const mode = document.querySelector('[data-layout="difference"]');
  const difference = document.querySelector('#live-difference');
  expect(difference).toHaveAttribute('hidden');
  mode.click();
  expect(mode).toHaveAttribute('aria-pressed', 'true');
  expect(difference).not.toHaveAttribute('hidden');
  expect(difference).toHaveTextContent('Brillo superficial en B menos A');
  expect(difference.querySelector('img')).toHaveAttribute('src', '/api/v1/images/synthetic-difference');
  expect(document.querySelector('#live-frames')).toHaveAttribute('hidden');
  document.querySelector('[data-layout="side"]').click();
  expect(difference).toHaveAttribute('hidden');
  expect(document.querySelector('#live-frames')).not.toHaveAttribute('hidden');

  history.replaceState(null, '', '#ficha?ra=133.795129166667&dec=-7.245147222222');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(document.querySelector('#report-form')).toBeInTheDocument();
  expect(document.querySelector('.attachment-panel img')).toHaveAttribute(
    'src', `/api/v1/images/${readyFixture.frames[0].id}`,
  );

  const { readWorkspace, writeWorkspace } = await import('../features/observatorio/workspace.js');
  const frameId = readyFixture.frames[0].id;
  const originalMarks = [
    { type: 'draw', points: [[.2, .3], [.6, .4]] },
    { type: 'crop', points: [[.7, .8], [.3, .4]] },
  ];
  const workspace = readWorkspace();
  workspace.annotations[frameId] = originalMarks;
  writeWorkspace(workspace);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  const frame = document.querySelector('.report-frame');
  expect(JSON.parse(frame.dataset.reportMarks)).toEqual(originalMarks);
  expect(frame.querySelector('.report-overlay')).toBeInTheDocument();
  expect(frame.querySelector('.report-crop')).toHaveTextContent('Detalle del último recorte');
  expect(frame.querySelector('a[aria-label="Anotar época A"]').getAttribute('href')).toContain('desde=manual');

  const form = document.querySelector('#report-form');
  form.elements.author.value = 'Observadora';
  form.elements.title.value = 'Detalle de WISE 0855';
  form.elements.notes.value = 'La marca indica la región que comparé.';
  form.requestSubmit(form.querySelector('[data-intent="draft"]'));
  await vi.waitFor(() => expect(document.querySelector('.report-confirmation')).toBeInTheDocument());
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  for (const image of document.querySelectorAll('.report-image img')) image.decode = vi.fn().mockResolvedValue();
  document.querySelector('#print-report').click();
  await vi.waitFor(() => expect(print).toHaveBeenCalledOnce());
  print.mockRestore();
  const saved = readWorkspace();
  const draft = saved.reports.find((report) => report.title === 'Detalle de WISE 0855');
  expect(draft.annotations[frameId]).toEqual(originalMarks);
  saved.annotations[frameId] = [];
  writeWorkspace(saved);

  history.replaceState(null, '', `#ficha?borrador=${draft.id}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(JSON.parse(document.querySelector('.report-frame').dataset.reportMarks)).toEqual(originalMarks);

  document.querySelector('#site-nav [data-view="explorar"]').click();
  await vi.waitFor(() => expect(document.querySelector('#explorer-root')).toHaveAttribute('aria-label', 'Mapa'));
  expect(location.hash).toBe('#explorar');
  expect(mountExplorer).toHaveBeenCalledWith(document.querySelector('#explorer-root'));
});
