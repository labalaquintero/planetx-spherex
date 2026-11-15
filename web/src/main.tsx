import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchArchiveComparison } from './features/viewer/api.ts';

const Explorar = lazy(async () => {
  const { Explorar } = await import('./features/explorar/index.ts');
  return { default: Explorar };
});

Object.assign(window, {
  planetXRuntime: {
    compare: fetchArchiveComparison,
    mountExplorer(host: HTMLElement) {
      const root = createRoot(host);
      root.render(
        <StrictMode>
          <Suspense fallback={<p className="explorer-loading" role="status">Cargando Explorar…</p>}>
            <Explorar />
          </Suspense>
        </StrictMode>,
      );
      return () => root.unmount();
    },
  },
});
