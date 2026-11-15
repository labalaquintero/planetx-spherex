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
 * - Toggle entre épocas (A, B, …)
 * - Play/Pause (no auto-play al cargar)
 * - Paso anterior/siguiente
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

  // Teclado
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
      aria-label="Comparador de épocas"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="comparison-viewer"
    >
      {/* Imagen */}
      <div className="viewer-display">
        <FrameImage
          frame={currentFrame}
          mode={data.mode}
          label={`Época ${String.fromCharCode(65 + currentIndex)} — ${currentIndex + 1} de ${frames.length}`}
        />
      </div>

      {/* Controles */}
      {canPlay && (
        <div
          className="viewer-controls"
          role="toolbar"
          aria-label="Controles de reproducción"
        >
          <button
            type="button"
            onClick={stepPrev}
            aria-label="Época anterior"
            data-testid="btn-prev"
          >
            ◀
          </button>

          {frames.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => goToFrame(i)}
              className={i === currentIndex ? 'epoch-btn active' : 'epoch-btn'}
              aria-label={`Mostrar época ${String.fromCharCode(65 + i)}`}
              aria-pressed={i === currentIndex}
              data-testid={`btn-epoch-${String.fromCharCode(97 + i)}`}
            >
              {String.fromCharCode(65 + i)}
            </button>
          ))}

          <button
            type="button"
            onClick={stepNext}
            aria-label="Época siguiente"
            data-testid="btn-next"
          >
            ▶
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir secuencia'}
            className="play-btn"
            data-testid="btn-play"
          >
            {isPlaying ? '⏸ Pausa' : '▶ Play'}
          </button>
        </div>
      )}

      {/* Indicador de frame */}
      <p className="viewer-frame-info" aria-live="polite">
        Época {String.fromCharCode(65 + currentIndex)} — {currentIndex + 1} de{' '}
        {frames.length}
      </p>

      {/* Procedencia */}
      <ProvenancePanel data={data} currentIndex={currentIndex} />
    </div>
  );
}
