import { useState } from 'react';
import type { Frame, ComparisonMode } from '../types.ts';

interface FrameImageProps {
  frame: Frame;
  mode: ComparisonMode;
  label: string;
}

export function FrameImage({ frame, mode, label }: FrameImageProps) {
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );

  const dateStr = new Date(frame.observed_at).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const altText = `Observación del ${dateStr} — ${label}`;

  return (
    <div className="frame-container" data-testid="frame-image">
      <div className="frame-wrapper">
        {imgState === 'loading' && (
          <div className="frame-placeholder" aria-hidden="true">
            Cargando imagen…
          </div>
        )}
        {imgState === 'error' && (
          <div className="frame-placeholder frame-error" role="alert">
            No se pudo cargar la imagen.
          </div>
        )}
        <img
          src={frame.image_url}
          alt={altText}
          className={`frame-image ${imgState === 'loaded' ? 'visible' : ''}`}
          onLoad={() => setImgState('loaded')}
          onError={() => setImgState('error')}
          draggable={false}
        />
      </div>
      {mode === 'fixture' && (
        <span
          className="frame-badge"
          aria-label="Datos de prueba"
          data-testid="test-data-badge"
        >
          Datos de prueba
        </span>
      )}
    </div>
  );
}
