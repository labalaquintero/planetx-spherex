import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchArchiveComparison } from './features/viewer/api.ts';
import { startObservatory } from './features/observatorio/app.js';
import './features/observatorio/observatorio.css';

const Explorar = lazy(async () => {
  const { Explorar } = await import('./features/explorar/index.ts');
  return { default: Explorar };
});

startObservatory({
  compare: fetchArchiveComparison,
  mountExplorer(host) {
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
});
