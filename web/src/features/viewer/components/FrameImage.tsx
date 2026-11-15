import { useState } from 'react';
import type { Frame, ComparisonMode } from '../types.ts';

interface FrameImageProps {
  frame: Frame;
  mode: ComparisonMode;
  index: number;
  total: number;
}

function formatUTC(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

export function FrameImage({ frame, mode, index, total }: FrameImageProps) {
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );

  const dateUTC = formatUTC(frame.observed_at);
  const altText = `Fotograma ${index + 1} de ${total}, observado ${dateUTC}`;

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
            Imagen no disponible
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
      {(!import.meta.env.PROD || mode === 'fixture') && (
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
