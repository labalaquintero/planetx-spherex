import { useState } from 'react';
import { CoordinateForm } from './features/viewer/components/CoordinateForm.tsx';
import { ComparisonViewer } from './features/viewer/components/ComparisonViewer.tsx';
import { ImageDivider } from './features/viewer/components/ImageDivider.tsx';
import { StatusMessage } from './features/viewer/components/StatusMessage.tsx';
import { useComparison } from './features/viewer/hooks/useComparison.ts';
import { WISE_0855 } from './features/viewer/preparedTarget.ts';
import './App.css';

export default function App() {
  const { state, search, retry } = useComparison();
  const [exampleStarted, setExampleStarted] = useState(false);
  const isHome = state.kind === 'idle';

  function searchExample() {
    setExampleStarted(true);
    void search(Number(WISE_0855.ra), Number(WISE_0855.dec));
  }

  return (
    <div className="app-container" id="inicio">
      <a className="skip-link" href="#buscar">Saltar a las coordenadas</a>
      <header className="app-header">
        <div className="app-header-inner">
          <a className="app-brand" href="#inicio">
            <span className="orbit-mark" aria-hidden="true" />
            <span>Planet <span className="brand-accent">X</span></span>
          </a>
          <a className="header-viewer-link" href="#buscar">Visor temporal</a>
        </div>
      </header>

      <main className="app-main" id="main-content">
        {isHome ? (
          <section className="app-hero" aria-labelledby="hero-title" data-testid="empty-state">
            <div className="hero-content">
              <p className="hero-eyebrow">Observaciones infrarrojas de SPHEREx</p>
              <h1 id="hero-title">El cielo a través <em>del tiempo</em></h1>
              <p className="hero-description">
                Vuelve a mirar la misma región del cielo en otra fecha. Compara las imágenes y
                sigue cada observación hasta su fuente original.
              </p>
              <div className="hero-actions">
                <button type="button" className="action-primary" onClick={searchExample}>
                  Comparar WISE 0855 <span aria-hidden="true">↗</span>
                </button>
                <a className="action-secondary" href="#buscar">Buscar coordenadas</a>
              </div>
            </div>
            <div className="hero-preview">
              <div className="hero-preview-heading">
                <div>
                  <p className="hero-preview-label">Arrastra para comparar</p>
                  <h2>WISE 0855</h2>
                </div>
                <span className="release-badge">SPHEREx DR1</span>
              </div>
              <ImageDivider
                label="Divisor de la vista previa de WISE 0855"
                before={<img src="/observatorio/wise-0855-a.webp" alt="WISE 0855 el 6 de mayo de 2025" draggable={false} />}
                after={<img src="/observatorio/wise-0855-b.webp" alt="WISE 0855 el 31 de octubre de 2025" draggable={false} />}
              />
              <div className="hero-dates">
                <time dateTime="2025-05-06T12:20:24.888Z"><span>A</span> 06 may 2025</time>
                <time dateTime="2025-10-31T18:55:38.358Z"><span>B</span> 31 oct 2025</time>
              </div>
            </div>
            <a className="hero-credit" href="https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/">
              Mosaico SPHEREx · NASA/JPL-Caltech ↗
            </a>
          </section>
        ) : (
          <div className="viewer-intro">
            <h1>Visor temporal</h1>
            <p>Compara observaciones de una misma región y consulta su procedencia.</p>
          </div>
        )}

        <section className="app-form-section" id="buscar" aria-labelledby="search-heading" tabIndex={-1}>
          <div className="search-heading">
            <h2 id="search-heading">Buscar una región</h2>
            <p>Coordenadas ICRS en grados decimales</p>
          </div>
          <CoordinateForm
            key={exampleStarted ? 'example' : 'default'}
            initialCoordinates={exampleStarted ? WISE_0855 : undefined}
            showPreparedShortcut={!isHome}
            onSubmit={(ra, dec) => void search(ra, dec)}
            isLoading={state.kind === 'loading'}
          />
        </section>

        {state.kind === 'loading' && <StatusMessage status="loading" />}

        {state.kind === 'error' && (
          <StatusMessage
            status="error"
            message={state.message}
            retryable={state.retryable}
            statusCode={state.statusCode}
            onRetry={retry}
          />
        )}

        {state.kind === 'success' && (
          <div className="results-container" data-testid="results-container">
            {state.data.status === 'no_coverage' && (
              <StatusMessage status="no_coverage" />
            )}

            {state.data.status === 'insufficient' && (
              <>
                <StatusMessage
                  status="insufficient"
                  reason={state.data.reason}
                />
                {state.data.frames.length > 0 && (
                  <div className="single-frame-view">
                    <p className="single-frame-notice">
                      Visualización del único fotograma disponible:
                    </p>
                    <ComparisonViewer data={state.data} />
                  </div>
                )}
              </>
            )}

            {state.data.status === 'ready' && (
              <ComparisonViewer data={state.data} />
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div>
          <strong>Planet X</strong>
          <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html">
            Datos SPHEREx · NASA/IPAC IRSA ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
