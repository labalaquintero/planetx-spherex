import { useState, useCallback, useEffect, useRef } from 'react';
import type { ComparisonResponse } from '../types.ts';
import { FrameImage } from './FrameImage.tsx';
import { ProvenancePanel } from './ProvenancePanel.tsx';

interface ComparisonViewerProps {
  data: ComparisonResponse;
}

const PLAY_INTERVAL_MS = 1500;

/**
 * Visor A/B con reproducción manual.
 *
 * - Toggle entre épocas: Ver A, Ver B (modo A/B)
 * - Play/Pause: "Reproducir" / "Pausar" (sin auto-play al cargar)
 * - Paso: "Fotograma anterior" / "Fotograma siguiente"
 * - Teclado: ←/→ para pasos, Espacio para play/pause
 */
export function ComparisonViewer({ data }: ComparisonViewerProps) {
  const [prevData, setPrevData] = useState(data);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Reiniciar estado si cambian los datos de consulta
  if (prevData !== data) {
    setPrevData(data);
    setCurrentIndex(0);
    setIsPlaying(false);
  }

  const frames = data.frames;
  const canPlay = frames.length >= 2;

  // Intervalo de reproducción
  useEffect(() => {
    if (isPlaying && canPlay) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % frames.length);
      }, PLAY_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, canPlay, frames.length]);

  const stepPrev = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + frames.length) % frames.length);
  }, [frames.length]);

  const stepNext = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % frames.length);
  }, [frames.length]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const goToFrame = useCallback((index: number) => {
    setIsPlaying(false);
    setCurrentIndex(index);
  }, []);

  // Teclado accesible
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          stepPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepNext();
          break;
        case ' ':
          e.preventDefault();
          if (canPlay) togglePlay();
          break;
      }
    },
    [stepPrev, stepNext, togglePlay, canPlay],
  );

  const currentFrame = frames[currentIndex];
  if (!currentFrame) return null;

  return (
    <div
      ref={viewerRef}
      className="comparison-viewer"
      role="region"
      aria-label="Comparación"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="comparison-viewer"
    >
      <h2 className="sr-only">Resultado</h2>

      {/* Imagen */}
      <div className="viewer-display">
        <FrameImage
          frame={currentFrame}
          mode={data.mode}
          index={currentIndex}
          total={frames.length}
        />
      </div>

      {/* Controles de reproducción */}
      {canPlay && (
        <div
          className="viewer-controls"
          role="toolbar"
          aria-label="Controles del reproductor"
        >
          <button
            type="button"
            onClick={stepPrev}
            aria-label="Fotograma anterior"
            title="Fotograma anterior (←)"
            data-testid="btn-prev"
          >
            ◀ Anterior
          </button>

          {frames.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => goToFrame(i)}
              className={i === currentIndex ? 'epoch-btn active' : 'epoch-btn'}
              aria-label={`Ver ${String.fromCharCode(65 + i)}`}
              aria-pressed={i === currentIndex}
              data-testid={`btn-epoch-${String.fromCharCode(97 + i)}`}
            >
              Ver {String.fromCharCode(65 + i)}
            </button>
          ))}

          <button
            type="button"
            onClick={stepNext}
            aria-label="Fotograma siguiente"
            title="Fotograma siguiente (→)"
            data-testid="btn-next"
          >
            Siguiente ▶
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!canPlay}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
            className="play-btn"
            data-testid="btn-play"
          >
            {isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
          </button>
        </div>
      )}

      {/* Región anunciable con información del fotograma */}
      <p className="viewer-frame-info" aria-live="polite">
        Fotograma {currentIndex + 1} de {frames.length} (Época {String.fromCharCode(65 + currentIndex)})
      </p>

      {/* Procedencia */}
      <ProvenancePanel data={data} currentIndex={currentIndex} />
    </div>
  );
}
