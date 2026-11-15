interface StatusMessageProps {
  status: 'loading' | 'error' | 'insufficient' | 'no_coverage';
  message?: string;
  reason?: string | null;
  retryable?: boolean;
  statusCode?: number;
  onRetry?: () => void;
}

const REASON_LABELS: Record<string, string> = {
  single_epoch: 'Solo se encontró una época de observación para esta región.',
  no_common_band: 'No se encontraron épocas con una banda espectral comparable.',
  no_usable_frames: 'No se encontraron fotogramas válidos para esta región.',
  search_limit_reached:
    'Se alcanzó el límite de búsqueda antes de completar la exploración.',
};

export function StatusMessage({
  status,
  message,
  reason,
  retryable,
  statusCode,
  onRetry,
}: StatusMessageProps) {
  switch (status) {
    case 'loading':
      return (
        <div
          className="status-message status-loading"
          role="status"
          aria-live="polite"
          data-testid="status-loading"
        >
          <span className="spinner" aria-hidden="true" />
          <p>Buscando observaciones…</p>
        </div>
      );

    case 'error':
      return (
        <div
          className="status-message status-error"
          role="alert"
          data-testid="status-error"
        >
          <p>
            <strong>Error{statusCode ? ` (${statusCode})` : ''}:</strong>{' '}
            {message ?? 'Ocurrió un error inesperado.'}
          </p>
          {retryable && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="retry-btn"
              data-testid="retry-btn"
            >
              Reintentar búsqueda
            </button>
          )}
        </div>
      );

    case 'insufficient':
      return (
        <div
          className="status-message status-info"
          role="status"
          data-testid="status-insufficient"
        >
          <p>
            <strong>Cobertura insuficiente.</strong>{' '}
            {reason && REASON_LABELS[reason]
              ? REASON_LABELS[reason]
              : 'No hay suficientes observaciones comparables para esta región.'}
          </p>
          <p className="status-note">
            Esto no significa que la región carezca de datos en todo el archivo;
            la búsqueda se limitó a los parámetros consultados.
          </p>
        </div>
      );

    case 'no_coverage':
      return (
        <div
          className="status-message status-info"
          role="status"
          data-testid="status-no-coverage"
        >
          <p>
            <strong>Sin cobertura.</strong> No se encontraron observaciones en la
            región consultada dentro del ámbito de búsqueda actual.
          </p>
          <p className="status-note">
            La ausencia de resultados en esta consulta no implica ausencia global
            de datos para estas coordenadas.
          </p>
        </div>
      );
  }
}
