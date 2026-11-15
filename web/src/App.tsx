import { CoordinateForm } from './features/viewer/components/CoordinateForm.tsx';
import { ComparisonViewer } from './features/viewer/components/ComparisonViewer.tsx';
import { StatusMessage } from './features/viewer/components/StatusMessage.tsx';
import { useComparison } from './features/viewer/hooks/useComparison.ts';
import './App.css';

export default function App() {
  const { state, search, retry } = useComparison();

  return (
    <div className="app-container">
      {/* Encabezado principal */}
      <header className="app-header">
        <div className="header-badge">Planet X / SPHEREx</div>
        <h1>Visor Temporal de Regiones Celestes</h1>
        <p className="header-description">
          Consulta y compara observaciones infrarrojas de SPHEREx en una misma región del cielo.
          Ingrese coordenadas en grados decimales ICRS para alternar entre épocas de observación
          y verificar metadatos de procedencia.
        </p>
      </header>

      {/* Formulario de entrada */}
      <section className="app-form-section" aria-labelledby="search-heading">
        <h2 id="search-heading" className="sr-only">
          Búsqueda de coordenadas
        </h2>
        <CoordinateForm
          onSubmit={(ra, dec) => void search(ra, dec)}
          isLoading={state.kind === 'loading'}
        />
      </section>

      {/* Área principal de resultados y estados */}
      <main className="app-main" id="main-content">
        {state.kind === 'idle' && (
          <div className="empty-state" data-testid="empty-state">
            <p>
              Introduzca coordenadas o seleccione uno de los ejemplos para iniciar la comparación.
            </p>
          </div>
        )}

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

      {/* Pie de página con créditos e información de misión */}
      <footer className="app-footer">
        <p>
          Datos de archivo de la misión SPHEREx (NASA/IPAC IRSA). Este visor es una herramienta
          de exploración comparativa; un cambio aparente no constituye por sí solo evidencia de
          un hallazgo astronómico.
        </p>
      </footer>
    </div>
  );
}
